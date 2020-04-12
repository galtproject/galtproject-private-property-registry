const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPACL = contract.fromArtifact('PPACL');
const PPToken = contract.fromArtifact('PPToken');
const PPTokenController = contract.fromArtifact('PPTokenController');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const MockPPToken = contract.fromArtifact('MockPPToken');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
const PPLockerFactory = contract.fromArtifact('PPLockerFactory');
const PPLocker = contract.fromArtifact('PPLocker');
const galt = require('@galtproject/utils');
const _ = require('lodash');

PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const {
  ether,
  assertRevert,
  evmIncreaseTime,
  assertErc20BalanceChanged,
  assertEthBalanceChanged,
  numberToEvmWord,
  getEventArg,
  hex
} = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex, hexToUtf8 } = web3.utils;

const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;
const TWO_HOURS = 60 * 60 * 2;

const ProposalStatus = {
  NULL: 0,
  PENDING: 1,
  APPROVED: 2,
  EXECUTED: 3,
  REJECTED: 4,
  CANCELLED: 5
};

describe('PPToken and PPTokenController', () => {
  const [
    systemOwner,
    registryOwner,
    minter,
    geoDataManager,
    lockerFeeManager,
    burner,
    alice,
    bob,
    charlie,
    dan
  ] = accounts;
  const unknown = defaultSender;

  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(systemOwner, galtFee);
    await this.galtToken.mint(registryOwner, galtFee);
    await this.galtToken.mint(alice, ether(1000));

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
  });

  it('should reject any write method from unknown with random data', async function() {
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    res = await controller.mint(alice, { from: registryOwner });
    const randomTokenId = res.logs[0].args.tokenId;

    const methodsAbis = token.abi.filter(m => m.stateMutability && m.stateMutability.indexOf('payable') !== -1);

    for (let index = 0; index < methodsAbis.length; index++) {
      const method = methodsAbis[index];
      if (!method.name) {
        continue;
      }

      // console.log(method.name, 'method');

      const inputs = method.inputs.map(input => {
        if (input.name === '_tokenId') {
          return randomTokenId;
        }
        if (_.includes(input.type, '[]')) {
          return [];
        }
        if (input.type === 'address') {
          return unknown;
        }
        if (_.includes(input.type, 'int')) {
          return '0';
        }
        if (input.type === 'string') {
          return '';
        }
        if (input.type === 'bytes' || input.type === 'bytes32') {
          return hex('');
        }
        return null;
      });

      await assertRevert(token[method.name](...inputs));
    }
  });

  it('should allow an owner setting legal agreement ipfs hash', async function() {
    const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner
    });
    const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);

    await assertRevert(
      token.setLegalAgreementIpfsHash(numberToEvmWord(42), { from: alice }),
      'Ownable: caller is not the owner'
    );
    await token.setLegalAgreementIpfsHash(numberToEvmWord(42), { from: registryOwner });

    assert.equal(await token.getLastLegalAgreementIpfsHash(), numberToEvmWord(42));
  });

  describe('token creation', () => {
    it('should allow the minter minting a new token', async function() {
      let res = await this.ppTokenFactory.build(
        'Buildings',
        'BDL',
        'dataLink',
        ONE_HOUR,
        [bytes32('PROPOSAL_ETH_FEE_KEY')],
        [ether(0.1)],
        utf8ToHex(''),
        {
          from: registryOwner
        }
      );
      const token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      await assertRevert(controller.mint(alice, { from: alice }), 'Only minter allowed');
      await assertRevert(token.mint(alice, { from: alice }), 'Only controller allowed');
      await assertRevert(token.mint(alice, { from: minter }), 'Only controller allowed');

      res = await controller.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.tokenId;
      const createdAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp;

      await assertRevert(
        controller.setInitialDetails(
          123123,
          // tokenType
          2,
          1,
          123,
          utf8ToHex('foo'),
          'bar',
          'buzz',
          false,
          { from: minter }
        ),
        'ERC721: owner query for nonexistent token'
      );

      await assertRevert(
        token.setDetails(
          123123,
          // tokenType
          2,
          1,
          123,
          utf8ToHex('foo'),
          'bar',
          'buzz',
          { from: minter }
        ),
        'Only controller allowed'
      );

      await assertRevert(
        token.setDetails(
          123123,
          // tokenType
          2,
          1,
          123,
          utf8ToHex('foo'),
          'bar',
          'buzz',
          { from: alice }
        ),
        'Only controller allowed'
      );

      // SET DETAILS
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

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      await assertRevert(token.incrementSetupStage(aliceTokenId, { from: alice }), 'Only controller allowed');

      await assertRevert(token.incrementSetupStage(aliceTokenId, { from: minter }), 'Only controller allowed');

      await assertRevert(token.setContour(aliceTokenId, contour, -42, { from: alice }), 'Only controller allowed');

      await assertRevert(token.setContour(aliceTokenId, contour, -42, { from: minter }), 'Only controller allowed');

      // SET CONTOUR
      await controller.setInitialContour(
        aliceTokenId,
        contour,
        // highestPoint
        -42,
        { from: minter }
      );

      assert.sameMembers(await token.getContour(aliceTokenId), contour);
      assert.equal(await token.getHighestPoint(aliceTokenId), -42);

      assert.equal(await token.propertyCreatedAt(aliceTokenId), createdAt);
    });
  });

  describe('token update', () => {
    let res;
    let token;
    let controller;
    let aliceTokenId;
    let data;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build(
        'Buildings',
        'BDL',
        'dataLink',
        ONE_HOUR,
        [bytes32('CONTROLLER_PROPOSAL_ETH')],
        [ether(0.1)],
        utf8ToHex(''),
        {
          from: registryOwner
        }
      );
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      data = token.contract.methods
        .setDetails(
          aliceTokenId,
          // tokenType
          2,
          1,
          123,
          utf8ToHex('foo'),
          'bar',
          'buzz'
        )
        .encodeABI();
    });

    it('should allow a token owner rejecting token update proposals', async function() {
      res = await controller.propose(data, 'foo', { from: geoDataManager });
      const proposalId = res.logs[0].args.proposalId;

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.PENDING);

      await controller.reject(proposalId, { from: alice });

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.REJECTED);

      await assertRevert(controller.approve(proposalId), 'Expect PENDING status');
      await assertRevert(controller.execute(proposalId), 'Token owner approval required');
    });

    it('should allow a token owner submitting token update proposals', async function() {
      await assertRevert(controller.propose(data, 'foo', { from: bob }), 'Missing permissions');

      res = await controller.propose(data, 'foo', { from: alice, value: ether(0.1) });
      let proposalId = res.logs[0].args.proposalId;

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.PENDING);

      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);
      assert.equal(res.creator, alice);
      assert.equal(res.tokenOwnerApproved, true);
      assert.equal(res.status, ProposalStatus.EXECUTED);
      assert.equal(res.data, data);
      assert.equal(res.dataLink, 'foo');

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      const newContour = contour.concat([galt.geohashToNumber('qwerqwereeee').toString(10)]);

      data = token.contract.methods.setContour(aliceTokenId, newContour, -43).encodeABI();

      res = await controller.propose(data, 'foo', { from: alice, value: ether(0.1) });
      proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);

      assert.sameMembers(await token.getContour(aliceTokenId), newContour);
      assert.equal(await token.getHighestPoint(aliceTokenId), -43);
    });

    it('should allow a token owner cancelling his own proposals', async function() {
      res = await controller.propose(data, 'foo', { from: alice, value: ether(0.1) });
      const proposalId = res.logs[0].args.proposalId;

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.PENDING);

      await assertRevert(
        controller.cancel(proposalId, { from: geoDataManager }),
        'Only own proposals can be cancelled.'
      );
      await assertRevert(controller.cancel(proposalId, { from: bob }), ' Missing permissions.');
      await controller.cancel(proposalId, { from: alice });

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.CANCELLED);

      await assertRevert(controller.cancel(proposalId, { from: alice }), 'Expect PENDING status');
    });

    it('should allow geoDataManager cancelling his proposals', async function() {
      res = await controller.propose(data, 'foo', { from: geoDataManager });
      const proposalId = res.logs[0].args.proposalId;

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.PENDING);

      await assertRevert(controller.cancel(proposalId, { from: alice }), 'Only own proposals can be cancelled');
      await assertRevert(controller.cancel(proposalId, { from: bob }), ' Missing permissions.');
      await controller.cancel(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);
      assert.equal(res.status, ProposalStatus.CANCELLED);
    });
  });

  describe('token burn', () => {
    let token;
    let controller;
    let res;
    let aliceTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build(
        'Buildings',
        'BDL',
        'dataLink',
        ONE_HOUR,
        [bytes32('CONTROLLER_PROPOSAL_ETH')],
        [ether(0.1)],
        utf8ToHex(''),
        {
          from: registryOwner
        }
      );
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await controller.setMinter(minter, { from: registryOwner });
      await controller.setBurner(burner, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;
    });

    it('should remove data on burn', async function() {
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

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      // SET CONTOUR
      await controller.setInitialContour(
        aliceTokenId,
        contour,
        // highestPoint
        -42,
        { from: minter }
      );
      assert.sameMembers(await token.getContour(aliceTokenId), contour);
      assert.equal(await token.getHighestPoint(aliceTokenId), -42);

      // burn
      res = await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + ONE_HOUR;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await evmIncreaseTime(ONE_HOUR + 2);

      await controller.burnTokenByTimeout(aliceTokenId);

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.area, 0);
      assert.equal(res.tokenType, 0);
      assert.equal(res.contour.length, 0);
      assert.equal(await token.getHighestPoint(aliceTokenId), 0);
    });

    it('should allow token burn after a custom timeout', async function() {
      await assertRevert(
        controller.setBurnTimeoutDuration(aliceTokenId, TWO_HOURS, { from: bob }),
        'Only token owner allowed'
      );
      await assertRevert(
        controller.setBurnTimeoutDuration(aliceTokenId, 0, { from: alice }),
        'Invalid timeout duration'
      );
      await controller.setBurnTimeoutDuration(aliceTokenId, TWO_HOURS, { from: alice });

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: registryOwner }), 'Only burner allowed');
      await assertRevert(
        controller.initiateTokenBurn(123123, { from: burner }),
        'ERC721: owner query for nonexistent token'
      );
      res = await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + TWO_HOURS;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: burner }), 'Burn already initiated');

      assert.equal(await controller.defaultBurnTimeoutDuration(), ONE_HOUR);
      assert.equal(await controller.burnTimeoutAt(123123), 0);
      assert.equal(await controller.burnTimeoutAt(aliceTokenId), timeoutAt);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR + 1);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR + 1);

      await controller.burnTokenByTimeout(aliceTokenId);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'ERC721: owner query for nonexistent token');
      await assertRevert(token.ownerOf(aliceTokenId), 'ERC721: owner query for nonexistent token');
    });

    it('should allow token burn by a default timeout', async function() {
      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: bob }), 'Only burner allowed');
      await assertRevert(
        controller.initiateTokenBurn(123123, { from: burner }),
        'ERC721: owner query for nonexistent token'
      );
      res = await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + ONE_HOUR;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: burner }), 'Burn already initiated');

      assert.equal(await controller.defaultBurnTimeoutDuration(), ONE_HOUR);
      assert.equal(await controller.burnTimeoutAt(123123), 0);
      assert.equal(await controller.burnTimeoutAt(aliceTokenId), timeoutAt);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR + 1);

      await controller.burnTokenByTimeout(aliceTokenId);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'ERC721: owner query for nonexistent token');
      await assertRevert(token.ownerOf(aliceTokenId), 'ERC721: owner query for nonexistent token');
    });

    it('should allow a token owner cancelling already initiated token burn', async function() {
      res = await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + ONE_HOUR;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: burner }), 'Burn already initiated');

      assert.equal(await controller.defaultBurnTimeoutDuration(), ONE_HOUR);
      assert.equal(await controller.burnTimeoutAt(123123), 0);
      assert.equal(await controller.burnTimeoutAt(aliceTokenId), timeoutAt);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR - 2);

      await assertRevert(controller.cancelTokenBurn(123123), 'Burn not initiated');
      await assertRevert(controller.cancelTokenBurn(aliceTokenId, { from: bob }), 'Only token owner allowed');
      await controller.cancelTokenBurn(aliceTokenId, { from: alice });
      await assertRevert(controller.cancelTokenBurn(aliceTokenId, { from: alice }), 'Burn not initiated');

      await evmIncreaseTime(3);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout not set');

      assert.equal(await token.ownerOf(aliceTokenId), alice);

      // burn from the second attempt
      await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      await evmIncreaseTime(ONE_HOUR + 1);

      await controller.burnTokenByTimeout(aliceTokenId, { from: unknown });
      await assertRevert(
        controller.cancelTokenBurn(aliceTokenId, { from: alice }),
        'ERC721: owner query for nonexistent token'
      );
    });

    it.skip('should allow cancelling already initiated token burn when a token is locked', async function() {
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

      this.ppLockerRegistry = await PPLockerRegistry.new();
      await this.ppLockerRegistry.initialize(this.ppgr.address);
      this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, 0, 0);
      await this.ppgr.setContract(await this.ppgr.PPGR_LOCKER_REGISTRY(), this.ppLockerRegistry.address);
      await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), this.ppLockerFactory.address, true);

      await this.ppLockerFactory.setFeeManager(lockerFeeManager);
      await this.ppLockerFactory.setEthFee(ether(10), { from: lockerFeeManager });
      await this.ppLockerFactory.setGaltFee(galtFee, { from: lockerFeeManager });

      res = await this.ppLockerFactory.build({ from: alice, value: ether(10) });
      const lockerAddress = res.logs[0].args.locker;
      const locker = await PPLocker.at(lockerAddress);

      await token.approve(locker.address, aliceTokenId, { from: alice });
      await locker.deposit(token.address, aliceTokenId, [alice], ['1'], '1', { from: alice });

      res = await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + ONE_HOUR;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: burner }), 'Burn already initiated');

      assert.equal(await controller.defaultBurnTimeoutDuration(), ONE_HOUR);
      assert.equal(await controller.burnTimeoutAt(123123), 0);
      assert.equal(await controller.burnTimeoutAt(aliceTokenId), timeoutAt);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR - 2);

      await assertRevert(controller.cancelTokenBurn(123123), 'Burn not initiated');
      await assertRevert(controller.cancelTokenBurn(aliceTokenId, { from: bob }), 'Only token owner allowed');
      await locker.cancelTokenBurn({ from: alice });
      await assertRevert(locker.cancelTokenBurn({ from: alice }), 'Burn not initiated');

      await evmIncreaseTime(3);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout not set');

      assert.equal(await token.ownerOf(aliceTokenId), locker.address);

      // burn from the second attempt
      await controller.initiateTokenBurn(aliceTokenId, { from: burner });
      await evmIncreaseTime(ONE_HOUR + 1);

      await controller.burnTokenByTimeout(aliceTokenId, { from: unknown });
      await assertRevert(locker.cancelTokenBurn({ from: alice }), 'ERC721: owner query for nonexistent token');
    });

    it('should allow token burn by an owner proposal', async function() {
      await assertRevert(token.burn(aliceTokenId, { from: alice }), 'Only controller allowed');

      const data = token.contract.methods.burn(aliceTokenId).encodeABI();
      res = await controller.propose(data, 'foo', { from: alice, value: ether(0.1) });
      const proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);
      assert.equal(res.creator, alice);
      assert.equal(res.tokenOwnerApproved, true);
      assert.equal(res.status, ProposalStatus.EXECUTED);
      assert.equal(res.data, data);
      assert.equal(res.dataLink, 'foo');
    });
  });

  describe('tokenURI', () => {
    let res;
    let token;
    let controller;
    let mintableToken;
    let aliceTokenId;
    let bobTokenId;
    let charlieTokenId;
    let danTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
      mintableToken = await MockPPToken.new('Foo', 'BAR');

      await controller.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;
      res = await controller.mint(bob, { from: minter });
      bobTokenId = res.logs[0].args.tokenId;
      res = await controller.mint(charlie, { from: minter });
      charlieTokenId = res.logs[0].args.tokenId;

      danTokenId = 9999999999;
      res = await mintableToken.hackMint(dan, danTokenId);
    });

    it('should return only ID as a tokenURI by default', async function() {
      assert.equal(await token.tokenURI(1), aliceTokenId);
      assert.equal(await token.tokenURI(2), bobTokenId);
      assert.equal(await token.tokenURI(3), charlieTokenId);

      assert.equal(await mintableToken.tokenURI(9999999999), danTokenId);
    });

    it('should generate correct tokenURI', async function() {
      await assertRevert(token.setBaseURI('https://galtproject.io/foo/bar/'), 'Ownable: caller is not the owner');
      await token.setBaseURI('https://galtproject.io/foo/bar/', { from: registryOwner });
      await mintableToken.setBaseURI('https://galtproject.io/buzz/bar/');

      assert.equal(await token.tokenURI(1), `https://galtproject.io/foo/bar/1`);
      assert.equal(await token.tokenURI(2), `https://galtproject.io/foo/bar/2`);
      assert.equal(await token.tokenURI(3), `https://galtproject.io/foo/bar/3`);
      assert.equal(await mintableToken.tokenURI(9999999999), `https://galtproject.io/buzz/bar/9999999999`);
    });
  });

  describe('extra data', () => {
    let res;
    let token;
    let controller;
    let aliceTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);

      await controller.setMinter(minter, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      await token.setController(bob, { from: registryOwner });
    });

    it('should allow controller setting extraData', async function() {
      assert.equal(hexToUtf8(await token.extraData(bytes32('foo'))), '');

      await assertRevert(
        token.setExtraData(bytes32('foo'), bytes32('bar'), { from: alice }),
        'Only controller allowed'
      );
      await token.setExtraData(bytes32('foo'), bytes32('bar'), { from: bob });

      assert.equal(hexToUtf8(await token.extraData(bytes32('foo'))), 'bar');
    });

    it('should allow controller setting property extraData', async function() {
      assert.equal(hexToUtf8(await token.propertyExtraData(aliceTokenId, bytes32('foo'))), '');

      await assertRevert(
        token.setPropertyExtraData(aliceTokenId, bytes32('foo'), bytes32('bar'), { from: alice }),
        'Only controller allowed'
      );
      await token.setPropertyExtraData(aliceTokenId, bytes32('foo'), bytes32('bar'), { from: bob });

      assert.equal(hexToUtf8(await token.propertyExtraData(aliceTokenId, bytes32('foo'))), 'bar');
      assert.equal(hexToUtf8(await token.propertyExtraData(123, bytes32('foo'))), '');
    });
  });

  describe('commission withdrawals', () => {
    it('should allow ETH withdrawals', async function() {
      const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await web3.eth.sendTransaction({ from: alice, to: controller.address, value: ether(42) });

      assert.equal(await web3.eth.getBalance(controller.address), ether(42));

      const bobBalanceBefore = await web3.eth.getBalance(bob);

      await assertRevert(controller.withdrawEth(bob, { from: bob }), 'Missing permissions');

      await controller.withdrawEth(bob, { from: registryOwner });

      const bobBalanceAfter = await web3.eth.getBalance(bob);

      assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(42));

      assert.equal(await web3.eth.getBalance(controller.address), ether(0));
    });

    it('should allow GALT withdrawals', async function() {
      const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      await this.galtToken.transfer(controller.address, ether(42), { from: alice });

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(42));

      const bobBalanceBefore = await this.galtToken.balanceOf(bob);

      await assertRevert(controller.withdrawErc20(this.galtToken.address, bob, { from: bob }), 'Missing permissions');

      await controller.withdrawErc20(this.galtToken.address, bob, { from: registryOwner });

      const bobBalanceAfter = await this.galtToken.balanceOf(bob);

      assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(42));

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(0));
    });
  });

  describe('update timestamps', () => {
    it('should set initial updatedAt timestamps when minting a token', async function() {
      // CREATE REGISTRIES
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: alice
      });
      const registryX = await PPToken.at(getEventArg(res, 'Build', 'controller'));
      const controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

      await controllerX.setMinter(minter, { from: alice });
      await controllerX.setGeoDataManager(geoDataManager, { from: alice });

      res = await controllerX.mint(charlie, { from: minter });
      const token1 = getEventArg(res, 'Mint', 'tokenId');

      assert.equal(await controllerX.getDetailsUpdatedAt(token1), 0);
      assert.equal(await controllerX.getContourUpdatedAt(token1), 0);

      // setInitialDetails
      await evmIncreaseTime(10);
      res = await controllerX.setInitialDetails(
        token1,
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
      let detailsUpdatedAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp;

      assert.equal(await controllerX.getDetailsUpdatedAt(token1), detailsUpdatedAt);
      assert.equal(await controllerX.getContourUpdatedAt(token1), 0);

      // setInitialContour
      await evmIncreaseTime(10);
      res = await controllerX.setInitialContour(
        token1,
        contour,
        // highestPoint
        -42,
        { from: minter }
      );
      let contourUpdatedAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp;

      assert.equal(await controllerX.getDetailsUpdatedAt(token1), detailsUpdatedAt);
      assert.equal(await controllerX.getContourUpdatedAt(token1), contourUpdatedAt);

      // proposal for details update
      await evmIncreaseTime(10);
      let data = registryX.contract.methods
        .setDetails(
          token1,
          // tokenType
          2,
          1,
          456,
          utf8ToHex('foo'),
          'bar',
          'buzz'
        )
        .encodeABI();

      res = await controllerX.propose(data, 'foo', { from: charlie });
      let proposalId = getEventArg(res, 'NewProposal', 'tokenId');

      res = await controllerX.approve(proposalId, { from: geoDataManager });
      detailsUpdatedAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp;

      assert.equal(await controllerX.getDetailsUpdatedAt(token1), detailsUpdatedAt);
      assert.equal(await controllerX.getContourUpdatedAt(token1), contourUpdatedAt);

      // proposal for contour update
      await evmIncreaseTime(10);
      data = registryX.contract.methods
        .setContour(
          token1,
          contour,
          // highestPoint
          42
        )
        .encodeABI();

      res = await controllerX.propose(data, 'foo', { from: charlie });
      proposalId = getEventArg(res, 'NewProposal', 'proposalId');

      res = await controllerX.approve(proposalId, { from: geoDataManager });
      contourUpdatedAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp;

      assert.equal(await controllerX.getDetailsUpdatedAt(token1), detailsUpdatedAt);
      assert.equal(await controllerX.getContourUpdatedAt(token1), contourUpdatedAt);
    });
  });

  describe('set/unset token uniqueness', () => {
    it('should allow setting/unsetting claim contour uniqueness flag', async function() {
      // CREATE REGISTRIES
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: alice
      });
      const registryX = await PPToken.at(getEventArg(res, 'Build', 'controller'));
      const controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

      await controllerX.setMinter(minter, { from: alice });
      await controllerX.setGeoDataManager(geoDataManager, { from: alice });

      res = await controllerX.mint(charlie, { from: minter });
      const tokenA = getEventArg(res, 'Mint', 'tokenId');

      assert.equal(await controllerX.getClaimUniquenessFlag(tokenA), false);

      // set true
      let data = registryX.contract.methods
        .setPropertyExtraData(tokenA, await controllerX.CLAIM_UNIQUENESS_KEY(), numberToEvmWord(1))
        .encodeABI();

      await assertRevert(controllerX.propose(data, 'foo', { from: alice }), 'Missing permissions');

      res = await controllerX.propose(data, 'foo', { from: charlie });
      let proposalId = getEventArg(res, 'NewProposal', 'proposalId');
      await controllerX.approve(proposalId, { from: geoDataManager });

      assert.equal(await controllerX.getClaimUniquenessFlag(tokenA), true);

      // set false
      data = registryX.contract.methods
        .setPropertyExtraData(tokenA, await controllerX.CLAIM_UNIQUENESS_KEY(), numberToEvmWord(0))
        .encodeABI();

      res = await controllerX.propose(data, 'foo', { from: charlie });
      proposalId = getEventArg(res, 'NewProposal', 'proposalId');
      await controllerX.approve(proposalId, { from: geoDataManager });

      assert.equal(await controllerX.getClaimUniquenessFlag(tokenA), false);
    });
  });
});
