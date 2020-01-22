const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPTokenController = artifacts.require('PPTokenController.sol');
const PPTokenControllerFactory = artifacts.require('PPTokenControllerFactory.sol');
const PPToken = artifacts.require('PPToken.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const PPLockerFactory = artifacts.require('PPLockerFactory.sol');
const PPLockerRegistry = artifacts.require('PPLockerRegistry.sol');
const PPLocker = artifacts.require('PPLocker.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const MockRA = artifacts.require('MockRA.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');
const _ = require('lodash');

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { ether, assertRevert, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

contract('PPLockers', accounts => {
  const [owner, alice, registryOwner, minter, lockerFeeManager] = accounts;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppLockerRegistry = await PPLockerRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);
    await this.ppLockerRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_LOCKER_REGISTRY(), this.ppLockerRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
    await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), this.ppLockerFactory.address, true);

    // Fees setup
    await this.ppTokenFactory.setFeeManager(lockerFeeManager);
    await this.ppTokenFactory.setEthFee(ethFee, { from: lockerFeeManager });
    await this.ppTokenFactory.setGaltFee(galtFee, { from: lockerFeeManager });

    await this.ppLockerFactory.setFeeManager(lockerFeeManager);
    await this.ppLockerFactory.setEthFee(ethFee, { from: lockerFeeManager });
    await this.ppLockerFactory.setGaltFee(galtFee, { from: lockerFeeManager });
  });

  it('should correctly build a locker with no fee', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    await controller.setMinter(minter, { from: registryOwner });

    res = await controller.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.tokenId;

    await controller.setInitialDetails(
      aliceTokenId,
      // tokenType
      2,
      1,
      123,
      utf8ToHex('foo'),
      'bar',
      'buzz',
      { from: minter }
    );

    res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
    const lockerAddress = res.logs[0].args.locker;
    const locker = await PPLocker.at(lockerAddress);

    assert.equal(await this.ppLockerRegistry.isValid(lockerAddress), true);
    assert.sameMembers(await this.ppLockerRegistry.getLockerListByOwner(alice), [lockerAddress]);

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, { from: alice });

    assert.equal(await token.ownerOf(aliceTokenId), locker.address);
    assert.equal(await locker.tokenContract(), token.address);
    assert.equal(await locker.tokenId(), aliceTokenId);
    assert.equal(await locker.tokenDeposited(), true);
    assert.equal(await locker.owner(), alice);
    assert.equal(await locker.reputation(), 123);

    // create fake RA contract and mint reputation to it
    const ra = await MockRA.new('MockRA');
    await locker.approveMint(ra.address, { from: alice });

    await assertRevert(locker.withdraw({ from: alice }), 'RAs counter should be 0');

    assert.sameMembers(await locker.getTras(), [ra.address]);

    await ra.setMinted(token.address, aliceTokenId, true);
    await assertRevert(locker.burn(ra.address, { from: alice }), 'Reputation not completely burned');
    await ra.setMinted(token.address, aliceTokenId, false);

    // burn reputation and withdraw token back
    await locker.burn(ra.address, { from: alice });
    await locker.withdraw({ from: alice });

    assert.equal(await token.ownerOf(aliceTokenId), alice);
  });

  describe('deposit commission', () => {
    let token;
    let anotherToken;
    let lockerAddress;
    let controller;
    let anotherController;
    let locker;
    let aliceTokenId;
    let res;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
      res = await this.ppTokenFactory.build('Land Plots', 'LPL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      anotherToken = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      anotherController = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });
      await anotherController.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      lockerAddress = res.logs[0].args.locker;
      locker = await PPLocker.at(lockerAddress);
    });

    it('could accept only ETH payments', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), zeroAddress);

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(locker.deposit(token.address, aliceTokenId, { from: alice }), 'GALT_TOKEN not set');
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, { from: alice, value: ether(3) }),
        'Invalid ETH fee'
      );
      await locker.deposit(token.address, aliceTokenId, { from: alice, value: ether(4) });
    });

    it('could accept only GALT payments', async function() {
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(
        locker.deposit(token.address, aliceTokenId, { from: alice, value: ether(123123) }),
        'Invalid ETH fee'
      );
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, { from: alice });
    });

    it('should require another ETH payment for another registry after withdrawal', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.ETH_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await locker.deposit(token.address, aliceTokenId, { from: alice, value: ether(4) });

      await locker.withdraw({ from: alice });

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, { from: alice, value: ether(4) }),
        'Invalid ETH fee'
      );

      await locker.deposit(anotherToken.address, anotherAliceTokenId, { from: alice, value: ether(42) });

      assert.equal(await web3.eth.getBalance(controller.address), ether(4));
      assert.equal(await web3.eth.getBalance(anotherController.address), ether(42));
    });

    it('should require another GALT payment for another registry after withdrawal', async function() {
      // marketGalt,marketEth,lockerGalt,lockerEth
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.GALT_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, { from: alice });

      await locker.withdraw({ from: alice });

      await this.galtToken.mint(alice, ether(42));

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(42), { from: alice });
      await locker.deposit(anotherToken.address, anotherAliceTokenId, { from: alice });

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(4));
      assert.equal(await this.galtToken.balanceOf(anotherController.address), ether(42));
    });
  });
});
