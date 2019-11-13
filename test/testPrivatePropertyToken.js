const PrivatePropertyFactory = artifacts.require('PrivatePropertyFactory.sol');
const PrivatePropertyGlobalRegistry = artifacts.require('PrivatePropertyGlobalRegistry.sol');
const PrivatePropertyToken = artifacts.require('PrivatePropertyToken.sol');
const PrivatePropertyTokenController = artifacts.require('PrivatePropertyTokenController.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');
const galt = require('@galtproject/utils');

PrivatePropertyToken.numberFormat = 'String';
PrivatePropertyTokenController.numberFormat = 'String';

const { ether, assertRevert } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex, hexToUtf8 } = web3.utils;

contract('PrivatePropertyToken and PrivatePropertyTokenController', accounts => {
  const [systemOwner, registryOwner, minter, geoDataManager, alice, bob] = accounts;

  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(systemOwner, galtFee);
    await this.galtToken.mint(registryOwner, galtFee);

    this.propertyRegistry = await PrivatePropertyGlobalRegistry.new();
    this.propertyFactory = await PrivatePropertyFactory.new(
      this.propertyRegistry.address,
      this.galtToken.address,
      0,
      0
    );
    await this.propertyRegistry.setFactory(this.propertyFactory.address);
  });

  describe('token creation', () => {
    it('should allow the minter minting a new token', async function() {
      let res = await this.propertyFactory.build('Buildings', 'BDL', 'dataLink', { from: registryOwner });
      const token = await PrivatePropertyToken.at(res.logs[4].args.token);
      const controller = await PrivatePropertyTokenController.at(res.logs[4].args.controller);

      await token.setMinter(minter, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      res = await token.mint(alice, { from: minter });
      const aliceTokenId = res.logs[0].args.privatePropertyId;

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
      let res = await this.propertyFactory.build('Buildings', 'BDL', 'dataLink', { from: registryOwner });
      const token = await PrivatePropertyToken.at(res.logs[4].args.token);
      const controller = await PrivatePropertyTokenController.at(res.logs[4].args.controller);

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
      assert.equal(res.description, 'foo');

      res = await token.getDetails(aliceTokenId);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');
    });
  });
});
