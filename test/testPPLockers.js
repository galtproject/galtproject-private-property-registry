const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPToken = artifacts.require('PPToken.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const PPLockerFactory = artifacts.require('PPLockerFactory.sol');
const PPLockerRegistry = artifacts.require('PPLockerRegistry.sol');
const PPLocker = artifacts.require('PPLocker.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const MockRA = artifacts.require('MockRA.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';

const { ether, assertRevert } = require('@galtproject/solidity-test-chest')(web3);

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

    this.ppTokenFactory = await PPTokenFactory.new(this.ppgr.address, this.galtToken.address, 0, 0);
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, this.galtToken.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
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

  it('should correctly build locker', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, {
      from: registryOwner,
      value: ether(10)
    });
    const token = await PPToken.at(res.logs[4].args.token);
    // TODO: mint

    await token.setMinter(minter, { from: registryOwner });

    res = await token.mint(alice, { from: minter });
    const aliceTokenId = res.logs[0].args.privatePropertyId;

    await token.setDetails(
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

    // burn reputation and withdraw token back
    await locker.burn(ra.address, { from: alice });
    await locker.withdraw({ from: alice });

    assert.equal(await token.ownerOf(aliceTokenId), alice);
  });
});
