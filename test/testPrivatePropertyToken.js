const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPTokenControllerFactory = artifacts.require('PPTokenControllerFactory.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const PPToken = artifacts.require('PPToken.sol');
const PPTokenController = artifacts.require('PPTokenController.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');
const MockPPToken = artifacts.require('MockPPToken.sol');
const galt = require('@galtproject/utils');

PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { web3 } = PPToken;

const {
  ether,
  assertRevert,
  evmIncreaseTime,
  assertErc20BalanceChanged,
  assertEthBalanceChanged,
  numberToEvmWord
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
  REJECTED: 4
};

contract('PPToken and PPTokenController', accounts => {
  const [unknown, systemOwner, registryOwner, minter, geoDataManager, burner, alice, bob, charlie, dan] = accounts;

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
    this.ppTokenFactory = await PPTokenFactory.new(
      this.ppTokenControllerFactory.address,
      this.ppgr.address,
      this.galtToken.address,
      0,
      0
    );

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
  });

  it('should allow an owner setting legal agreement ipfs hash', async function() {
    const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner
    });
    const token = await PPToken.at(res.logs[5].args.token);

    await assertRevert(
      token.setLegalAgreementIpfsHash(numberToEvmWord(42), { from: alice }),
      'Ownable: caller is not the owner'
    );
    await token.setLegalAgreementIpfsHash(numberToEvmWord(42), { from: registryOwner });

    assert.equal(await token.getLastLegalAgreementIpfsHash(), numberToEvmWord(42));
  });

  describe('token creation', () => {
    it('should allow the minter minting a new token', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const token = await PPToken.at(res.logs[5].args.token);
      const controller = await PPTokenController.at(res.logs[5].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

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
        'ERC721: owner query for nonexistent token'
      );

      // SET DETAILS
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

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      // SET CONTOUR
      await token.setContour(
        aliceTokenId,
        contour,
        // highestPoint
        -42,
        { from: minter }
      );

      assert.sameMembers(await token.getContour(aliceTokenId), contour);
      assert.equal(await token.getHighestPoint(aliceTokenId), -42);
    });
  });

  describe('token update', () => {
    it('should allow a token owner rejecting token update proposals', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const token = await PPToken.at(res.logs[5].args.token);
      const controller = await PPTokenController.at(res.logs[5].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

      const data = token.contract.methods
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
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const token = await PPToken.at(res.logs[5].args.token);
      const controller = await PPTokenController.at(res.logs[5].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

      let data = token.contract.methods
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

      await assertRevert(controller.propose(data, 'foo', { from: bob }), 'Missing permissions');

      res = await controller.propose(data, 'foo', { from: alice });
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

      res = await controller.propose(data, 'foo', { from: alice });
      proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);

      assert.sameMembers(await token.getContour(aliceTokenId), newContour);
      assert.equal(await token.getHighestPoint(aliceTokenId), -43);
    });
  });

  describe('token burn', () => {
    let token;
    let controller;
    let res;
    let aliceTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      token = await PPToken.at(res.logs[5].args.token);
      controller = await PPTokenController.at(res.logs[5].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setBurner(burner, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.privatePropertyId;
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

    it('should allow token burn by an owner proposal', async function() {
      await assertRevert(token.burn(aliceTokenId, { from: alice }), 'Only controller allowed');

      const data = token.contract.methods.burn(aliceTokenId).encodeABI();
      res = await controller.propose(data, 'foo', { from: alice });
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
    let mintableToken;
    let aliceTokenId;
    let bobTokenId;
    let charlieTokenId;
    let danTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      token = await PPToken.at(res.logs[5].args.token);
      mintableToken = await MockPPToken.new('Foo', 'BAR');

      await token.setMinter(minter, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.privatePropertyId;
      res = await token.mint(bob, { from: minter });
      bobTokenId = res.logs[0].args.privatePropertyId;
      res = await token.mint(charlie, { from: minter });
      charlieTokenId = res.logs[0].args.privatePropertyId;

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

  describe('commission withdrawals', () => {
    it('should allow ETH withdrawals', async function() {
      const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const controller = await PPTokenController.at(res.logs[5].args.controller);

      await web3.eth.sendTransaction({ from: alice, to: controller.address, value: ether(42) });

      assert.equal(await web3.eth.getBalance(controller.address), ether(42));

      const bobBalanceBefore = await web3.eth.getBalance(bob);

      await controller.withdrawEth(bob, { from: registryOwner });

      const bobBalanceAfter = await web3.eth.getBalance(bob);

      assertEthBalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(42));

      assert.equal(await web3.eth.getBalance(controller.address), ether(0));
    });

    it('should allow GALT withdrawals', async function() {
      const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
        from: registryOwner
      });
      const controller = await PPTokenController.at(res.logs[5].args.controller);

      await this.galtToken.transfer(controller.address, ether(42), { from: alice });

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(42));

      const bobBalanceBefore = await this.galtToken.balanceOf(bob);

      await controller.withdrawErc20(this.galtToken.address, bob, { from: registryOwner });

      const bobBalanceAfter = await this.galtToken.balanceOf(bob);

      assertErc20BalanceChanged(bobBalanceBefore, bobBalanceAfter, ether(42));

      assert.equal(await this.galtToken.balanceOf(controller.address), ether(0));
    });
  });
});
