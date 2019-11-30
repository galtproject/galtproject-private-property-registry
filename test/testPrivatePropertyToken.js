const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const PPToken = artifacts.require('PPToken.sol');
const PPTokenController = artifacts.require('PPTokenController.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');
const galt = require('@galtproject/utils');

PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { web3 } = PPToken;

const { ether, assertRevert, evmIncreaseTime } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex, hexToUtf8 } = web3.utils;

const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;
const TWO_HOURS = 60 * 60 * 2;

contract('PPToken and PPTokenController', accounts => {
  const [systemOwner, registryOwner, minter, geoDataManager, alice, bob] = accounts;

  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(systemOwner, galtFee);
    await this.galtToken.mint(registryOwner, galtFee);

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenFactory = await PPTokenFactory.new(this.ppgr.address, this.galtToken.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
  });

  describe('token creation', () => {
    it('should allow the minter minting a new token', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      const token = await PPToken.at(res.logs[4].args.token);
      const controller = await PPTokenController.at(res.logs[4].args.controller);

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
    it('should allow a token owner submitting token update proposals', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      const token = await PPToken.at(res.logs[4].args.token);
      const controller = await PPTokenController.at(res.logs[4].args.controller);

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

      await assertRevert(controller.propose(data, 'foo', { from: bob }), 'Missing permissions');

      res = await controller.propose(data, 'foo', { from: alice });
      const proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);
      assert.equal(res.creator, alice);
      assert.equal(res.tokenOwnerApproved, true);
      assert.equal(res.executed, true);
      assert.equal(res.data, data);
      assert.equal(res.dataLink, 'foo');

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');
    });
  });

  describe('token burn', () => {
    it('should allow token burn after a custom timeout', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      const token = await PPToken.at(res.logs[4].args.token);
      const controller = await PPTokenController.at(res.logs[4].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

      await assertRevert(
        controller.setBurnTimeoutDuration(aliceTokenId, TWO_HOURS, { from: bob }),
        'Only token owner allowed'
      );
      await assertRevert(
        controller.setBurnTimeoutDuration(aliceTokenId, 0, { from: alice }),
        'Invalid timeout duration'
      );
      await controller.setBurnTimeoutDuration(aliceTokenId, TWO_HOURS, { from: alice });

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: bob }), 'Ownable: caller is not the owner');
      await assertRevert(
        controller.initiateTokenBurn(123123, { from: registryOwner }),
        'ERC721: owner query for nonexistent token'
      );
      res = await controller.initiateTokenBurn(aliceTokenId, { from: registryOwner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + TWO_HOURS;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: registryOwner }), 'Burn already initiated');

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
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      const token = await PPToken.at(res.logs[4].args.token);
      const controller = await PPTokenController.at(res.logs[4].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: bob }), 'Ownable: caller is not the owner');
      await assertRevert(
        controller.initiateTokenBurn(123123, { from: registryOwner }),
        'ERC721: owner query for nonexistent token'
      );
      res = await controller.initiateTokenBurn(aliceTokenId, { from: registryOwner });
      const timeoutAt = (await web3.eth.getBlock(res.receipt.blockNumber)).timestamp + ONE_HOUR;
      assert.equal(res.logs[0].args.timeoutAt, timeoutAt);

      await assertRevert(controller.initiateTokenBurn(aliceTokenId, { from: registryOwner }), 'Burn already initiated');

      assert.equal(await controller.defaultBurnTimeoutDuration(), ONE_HOUR);
      assert.equal(await controller.burnTimeoutAt(123123), 0);
      assert.equal(await controller.burnTimeoutAt(aliceTokenId), timeoutAt);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'Timeout has not passed yet');

      await evmIncreaseTime(ONE_HOUR + 1);

      await controller.burnTokenByTimeout(aliceTokenId);

      await assertRevert(controller.burnTokenByTimeout(aliceTokenId), 'ERC721: owner query for nonexistent token');
      await assertRevert(token.ownerOf(aliceTokenId), 'ERC721: owner query for nonexistent token');
    });

    it('should allow token burn by an owner proposal', async function() {
      let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, { from: registryOwner });
      const token = await PPToken.at(res.logs[4].args.token);
      const controller = await PPTokenController.at(res.logs[4].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

      await assertRevert(token.burn(aliceTokenId, { from: alice }), 'Only controller allowed');

      const data = token.contract.methods.burn(aliceTokenId).encodeABI();
      res = await controller.propose(data, 'foo', { from: alice });
      const proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      res = await controller.proposals(proposalId);
      assert.equal(res.creator, alice);
      assert.equal(res.tokenOwnerApproved, true);
      assert.equal(res.executed, true);
      assert.equal(res.data, data);
      assert.equal(res.dataLink, 'foo');
    });
  });
});
