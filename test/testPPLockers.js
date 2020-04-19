const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPToken = contract.fromArtifact('PPToken');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPLockerFactory = contract.fromArtifact('PPLockerFactory');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
const PPLocker = contract.fromArtifact('PPLocker');
// const LockerProposalManager = contract.fromArtifact('LockerProposalManager');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPBridgedLockerFactory = contract.fromArtifact('PPBridgedLockerFactory');
const PPACL = contract.fromArtifact('PPACL');
const MockRA = contract.fromArtifact('MockRA');
const LockerProposalManagerFactory = contract.fromArtifact('LockerProposalManagerFactory');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const _ = require('lodash');
const { ether, assertRevert, zeroAddress } = require('@galtproject/solidity-test-chest')(web3);
const {
  withdrawLockerProposal,
  approveMintLockerProposal,
  burnLockerProposal,
  validateProposalError
} = require('./proposalHelpers');

PPToken.numberFormat = 'String';
PPLocker.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe('PPLockers', () => {
  const [alice, bob, dan, registryOwner, minter, lockerFeeManager] = accounts;
  const owner = defaultSender;

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

    const lockerProposalManagerFactory = await LockerProposalManagerFactory.new();
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, lockerProposalManagerFactory.address, 0, 0);

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
      false,
      { from: minter }
    );

    res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
    const lockerAddress = res.logs[0].args.locker;
    const locker = await PPLocker.at(lockerAddress);

    assert.equal(await this.ppLockerRegistry.isValid(lockerAddress), true);

    const blockNumberBeforeDeposit = await web3.eth.getBlockNumber();

    // deposit token
    await token.approve(locker.address, aliceTokenId, { from: alice });
    await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });

    const blockNumberAfterDeposit = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), 123);

    assert.equal(await token.ownerOf(aliceTokenId), locker.address);
    assert.equal(await locker.tokenContract(), token.address);
    assert.equal(await locker.tokenId(), aliceTokenId);
    assert.equal(await locker.tokenDeposited(), true);
    assert.equal(await locker.reputationOf(alice), 123);
    assert.equal(await locker.totalReputation(), 123);
    const lockerInfo = await locker.getLockerInfo();
    assert.sameMembers(lockerInfo._owners, [alice]);
    assert.sameMembers(lockerInfo._ownersReputation, ['123']);

    // create fake RA contract and mint reputation to it
    const ra = await MockRA.new('MockRA');
    await approveMintLockerProposal(locker, ra, { from: alice });

    await assertRevert(locker.withdraw(alice, alice, { from: alice }), 'Not the proposal manager');

    const withdrawProposalId = await withdrawLockerProposal(locker, bob, dan, { from: alice });
    await validateProposalError(locker, withdrawProposalId, 'RAs counter should be 0');

    assert.sameMembers(await locker.getTras(), [ra.address]);

    await ra.setMinted(token.address, aliceTokenId, '1');
    await assertRevert(locker.burn(ra.address, { from: alice }), 'Not the proposal manager');
    const burnProposalId = await burnLockerProposal(locker, ra, { from: alice });
    await validateProposalError(locker, burnProposalId, 'Reputation not completely burned');
    await ra.setMinted(token.address, aliceTokenId, '0');

    // burn reputation and withdraw token back
    await burnLockerProposal(locker, ra, { from: alice });
    await withdrawLockerProposal(locker, bob, dan, { from: alice });

    const blockNumberAfterBurn = await web3.eth.getBlockNumber();

    assert.equal(await locker.reputationOfAt(alice, blockNumberBeforeDeposit), 0);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterDeposit), 123);
    assert.equal(await locker.reputationOfAt(alice, blockNumberAfterBurn), 0);

    assert.equal(await locker.reputationOf(alice), 0);
    assert.equal(await locker.totalReputation(), 0);

    assert.equal(await token.ownerOf(aliceTokenId), bob);
    assert.equal(await locker.depositManager(), dan);
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

      await controller.setInitialDetails(aliceTokenId, 2, 1, 123, utf8ToHex('foo'), 'bar', 'buzz', false, {
        from: minter
      });

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      lockerAddress = res.logs[0].args.locker;
      locker = await PPLocker.at(lockerAddress);
    });

    it('could accept only ETH payments', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), zeroAddress);

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'GALT_TOKEN not set'
      );
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(3) }),
        'Invalid ETH fee'
      );

      const ra = await MockRA.new('MockRA');
      await assertRevert(
        locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, {
          from: alice,
          value: ether(3)
        }),
        'Invalid ETH fee'
      );

      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(4) });
    });

    it('could accept only GALT payments', async function() {
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(123123) }),
        'Invalid ETH fee'
      );
      await assertRevert(
        locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });
    });

    it('should require another ETH payment for another registry after withdrawal', async function() {
      await controller.setFee(await locker.ETH_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.ETH_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      await anotherController.setInitialDetails(
        anotherAliceTokenId,
        2,
        1,
        123,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice, value: ether(4) });

      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', {
          from: alice,
          value: ether(4)
        }),
        'Invalid ETH fee'
      );

      await locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', {
        from: alice,
        value: ether(42)
      });

      assert.equal(await web3.eth.getBalance(controller.address), ether(4));
      assert.equal(await web3.eth.getBalance(anotherController.address), ether(42));
    });

    it('should require another GALT payment for another registry after withdrawal', async function() {
      // marketGalt,marketEth,lockerGalt,lockerEth
      await controller.setFee(await locker.GALT_FEE_KEY(), ether(4), { from: registryOwner });
      await anotherController.setFee(await locker.GALT_FEE_KEY(), ether(42), { from: registryOwner });

      res = await anotherController.mint(alice, { from: minter });
      const anotherAliceTokenId = res.logs[0].args.tokenId;

      await anotherController.setInitialDetails(
        anotherAliceTokenId,
        2,
        1,
        123,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });

      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });

      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      await this.galtToken.mint(alice, ether(42));

      await anotherToken.approve(locker.address, anotherAliceTokenId, { from: alice });
      await this.galtToken.approve(locker.address, ether(4), { from: alice });
      await assertRevert(
        locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', { from: alice }),
        'ERC20: transfer amount exceeds allowance'
      );

      await this.galtToken.approve(locker.address, ether(42), { from: alice });
      await locker.deposit(anotherToken.address, anotherAliceTokenId, [alice], ['1'], '1', { from: alice });

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(4));
      assert.equal(await this.galtToken.balanceOf(anotherController.address), ether(42));
    });

    it('should correctly deposit to locker by depositAndMint', async function() {
      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });
      const ra = await MockRA.new('MockRA');
      await assertRevert(
        locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, { from: minter }),
        'Not the deposit manager'
      );
      await locker.depositAndMint(token.address, aliceTokenId, [alice], ['1'], '1', ra.address, false, { from: alice });

      assert.equal(await token.ownerOf(aliceTokenId), locker.address);
      assert.equal(await locker.tokenContract(), token.address);
      assert.equal(await locker.tokenId(), aliceTokenId);
      assert.equal(await locker.tokenDeposited(), true);
      assert.equal(await locker.totalReputation(), 123);

      const lockerInfo = await locker.getLockerInfo();
      assert.sameMembers(lockerInfo._owners, [alice]);
      assert.sameMembers(lockerInfo._ownersReputation, ['123']);

      assert.sameMembers(await locker.getTras(), [ra.address]);

      // burn reputation and withdraw token back
      await burnLockerProposal(locker, ra, { from: alice });
      await withdrawLockerProposal(locker, alice, alice, { from: alice });

      assert.equal(await token.ownerOf(aliceTokenId), alice);
    });

    it('should prevent use bridged locker for regular token', async function() {
      const lockerProposalManagerFactory = await LockerProposalManagerFactory.new();
      const ppBridgedLockerFactory = await PPBridgedLockerFactory.new(
        this.ppgr.address,
        lockerProposalManagerFactory.address,
        1,
        1
      );
      await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), ppBridgedLockerFactory.address, true);

      res = await ppBridgedLockerFactory.build({ from: alice, value: 1 });
      const bridgedLockerAddress = res.logs[0].args.locker;
      const bridgedLocker = await PPLocker.at(bridgedLockerAddress);

      await token.approve(bridgedLocker.address, aliceTokenId, { from: alice });
      await assertRevert(
        bridgedLocker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice }),
        'Token type is invalid'
      );
    });

    it.skip('proposal fee should work', async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner,
        value: ether(10)
      });
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      await controller.setInitialDetails(
        aliceTokenId,
        // tokenType
        2,
        1,
        123,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      await this.ppLockerFactory.setFeeManager(owner, { from: owner });

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      lockerAddress = res.logs[0].args.locker;
      locker = await PPLocker.at(lockerAddress);

      await locker.setEthFee(ether(0.1), { from: owner });

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice, bob], ['1', '1'], '2', { from: alice });

      // const proposalData = locker.contract.methods.withdraw(_newOwner, _newDepositManager).encodeABI();
      // const proposalManager = await LockerProposalManager.at(await locker.proposalManager());
      // res = await proposalManager.propose(locker.address, '0', true, true, proposalData, '', options);
      // const proposalId = _.find(res.logs, l => l.args.proposalId).args.proposalId;
    });
  });
});
