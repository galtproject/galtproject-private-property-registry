const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const contractPoint = require('@galtproject/utils').contractPoint;
const {
  now,
  ether,
  assertRevert,
  getEventArg,
  numberToEvmWord,
  assertErc20BalanceChanged,
  evmIncreaseTime
} = require('@galtproject/solidity-test-chest')(web3);
const { addHeightToContour } = require('./localHelpers');

const PPACL = contract.fromArtifact('PPACL');
const PPDepositHolder = contract.fromArtifact('PPDepositHolder');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPContourVerification = contract.fromArtifact('PPContourVerification');
const PPContourVerificationFactory = contract.fromArtifact('PPContourVerificationFactory');
const PPContourVerificationPublicLib = contract.fromArtifact('PPContourVerificationPublicLib');
const PPToken = contract.fromArtifact('PPToken');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');

PPDepositHolder.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 3600;

const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
const contour1 = rawContour1.map(contractPoint.encodeFromGeohash);
// console.log('contour1', contour1);
const rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
const contour2 = rawContour2.map(contractPoint.encodeFromGeohash);
// console.log('contour2', contour2);
const contour1Contour2Point = contractPoint.encodeFromLatLng(40.5948365051, -73.9496169672);
const contour2Point = contractPoint.encodeFromLatLng(40.5948365392, -73.9495732865);
const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
const contour3 = rawContour3.map(contractPoint.encodeFromGeohash);
// console.log('contour3', contour3);
const contour1Contour3Point = contractPoint.encodeFromLatLng(40.5948074835, -73.9497317122);
const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
const contour4 = rawContour4.map(contractPoint.encodeFromGeohash);
// console.log('contour4', contour4);
const contour1Contour4Point = contractPoint.encodeFromLatLng(40.5948232658, -73.9498220612);
const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
const contour5 = rawContour5.map(contractPoint.encodeFromGeohash);
// console.log('contour5', contour5);
const contour1Contour5Point = contractPoint.encodeFromLatLng(40.5948079809, -73.9497188934);
// const rawContour6 = ['dr5qvnpda9gb', 'dr5qvnpda9gv', 'dr5qvnpda9gt', 'dr5qvnpda9g2'];
// const contour6 = rawContour6.map(contractPoint.encodeFromGeohash);
// const rawContour7 = ['dr5qvnpda9gu', 'dr5qvnpda9gf', 'dr5qvnpda9g3', 'dr5qvnpda9g5'];
// const contour7 = rawContour7.map(contractPoint.encodeFromGeohash);

const TokenType = {
  NULL: 0,
  LAND_PLOT: 1,
  BUILDING: 2,
  ROOM: 3,
  PACKAGE: 4
};

describe('PPContourVerification', () => {
  const [alice, bob, charlie, dan, minter, geoDataManager] = accounts;
  let hodler;
  let token3;
  let controllerX;
  let contourVerificationX;
  let registryX;
  let galtToken;

  /**
   * @param {number[]} contour
   * @param {TokenType} tokenType
   * @param {number} highestPoint
   * @param {boolean} claimUniqueness
   * @returns {number} tokenId
   */
  async function mintToken(contour, tokenType, highestPoint = -42, claimUniqueness = false, humanAddress = 'bar') {
    const res = await controllerX.mint(charlie, { from: minter });
    const localTokenId = getEventArg(res, 'Mint', 'tokenId');

    await controllerX.setInitialDetails(
      localTokenId,
      tokenType,
      1,
      123,
      utf8ToHex('foo'),
      humanAddress,
      'buzz',
      claimUniqueness,
      { from: minter }
    );

    await controllerX.setInitialContour(
      localTokenId,
      contour,
      // highestPoint
      highestPoint,
      { from: minter }
    );

    await galtToken.approve(hodler.address, ether(42), { from: alice });
    await hodler.deposit(await controllerX.tokenContract(), localTokenId, ether(42), { from: alice });

    return parseInt(localTokenId, 10);
  }

  before(async function() {
    galtToken = await MintableErc20Token.new();
    await galtToken.mint(alice, ether(10000));
    await galtToken.mint(bob, ether(10000));
    await galtToken.mint(charlie, ether(10000));

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppContourVerificationLib = await PPContourVerificationPublicLib.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);
    hodler = await PPDepositHolder.new(this.ppgr.address);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(bytes32('deposit_holder'), hodler.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);

    // CREATE REGISTRIES
    const res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice
    });
    registryX = await PPToken.at(getEventArg(res, 'Build', 'token'));
    controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

    await controllerX.setMinter(minter, { from: alice });
    await controllerX.setGeoDataManager(geoDataManager, { from: alice });
    await controllerX.setFee(bytes32('LOCKER_ETH'), ether(0.1), { from: alice });

    this.contourVerificationFactory = await PPContourVerificationFactory.new(this.ppContourVerificationLib.address);
  });

  beforeEach(async function() {
    let res = await controllerX.mint(charlie, { from: minter });
    token3 = getEventArg(res, 'Mint', 'tokenId');

    // SETUP CONTOUR VERIFICATION MANAGER
    res = await this.contourVerificationFactory.build(controllerX.address, ONE_HOUR, ONE_HOUR);

    contourVerificationX = await PPContourVerification.at(
      getEventArg(res, 'NewPPContourVerification', 'contourVerificationContract')
    );

    await controllerX.setContourVerificationManager(contourVerificationX.address, { from: alice });
  });

  // TEST case:
  // - deposit < required
  // - enabled/disabled
  describe('management', async function() {
    it('should not allow enabling already enabled verification', async function() {
      await contourVerificationX.enableVerification(ether(50), 3600);
      await assertRevert(contourVerificationX.enableVerification(ether(50), 3600), 'Verification is already enabled');
      assert.equal((await contourVerificationX.activeFrom()) <= now() + 3600, true);
      assert.equal(await contourVerificationX.minimalDeposit(), ether(50));
    });

    it('should not allow enabling verification with not big enough timeout', async function() {
      await assertRevert(contourVerificationX.enableVerification(ether(50), 3599), 'Timeout is not big enough');
    });

    it('should allow enabling verification with not big enough timeout', async function() {
      await contourVerificationX.enableVerification(ether(50), 3601);
    });

    it('should allow enabling verification again after its being disabled', async function() {
      await contourVerificationX.enableVerification(ether(50), 3600);
      await contourVerificationX.disableVerification();
      await contourVerificationX.enableVerification(ether(50), 4000);
    });
  });

  describe('lack of sufficient deposit reporting', () => {
    beforeEach(async function() {
      await galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(registryX.address, token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(registryX.address, token3), ether(42));
      assert.equal(await registryX.exists(token3), true);

      await contourVerificationX.enableVerification(ether(50), 3600);
    });

    it('should allow burning only after timeout passes', async function() {
      await evmIncreaseTime(3598);

      await assertRevert(contourVerificationX.reportNoDeposit(token3, { from: dan }), 'Verification is disabled');

      await evmIncreaseTime(2);

      await contourVerificationX.reportNoDeposit(token3, { from: dan });

      assert.equal(await registryX.exists(token3), false);

      const res = await controllerX.mint(charlie, { from: minter });
      const newToken = getEventArg(res, 'Mint', 'tokenId');

      assert.equal(await registryX.exists(newToken), true);

      await assertRevert(
        contourVerificationX.reportNoDeposit(newToken, { from: alice }),
        'newTokenTimeout not passed yet'
      );

      await evmIncreaseTime(3601);

      await contourVerificationX.reportNoDeposit(newToken, { from: alice });

      assert.equal(await registryX.exists(newToken), false);
    });

    it('should ignore uniqueness flag for non-room token', async function() {
      await evmIncreaseTime(3601);

      const data = registryX.contract.methods
        .setPropertyExtraData(token3.toString(), await controllerX.CLAIM_UNIQUENESS_KEY(), numberToEvmWord(1))
        .encodeABI();
      const res = await controllerX.propose(data, 'foo', { from: charlie });
      const proposalId = getEventArg(res, 'NewProposal', 'proposalId');
      await controllerX.approve(proposalId, { from: geoDataManager });

      // "Verification is disabled" is returned because "minimalDeposit" field is 0 when verification is disabled
      await contourVerificationX.reportNoDeposit(token3, { from: dan });

      assert.equal(await registryX.exists(token3), false);
    });

    it('should deny burning after disabling verification', async function() {
      await evmIncreaseTime(3601);

      await contourVerificationX.disableVerification();

      // "Verification is disabled" is returned because "minimalDeposit" field is 0 when verification is disabled
      await assertRevert(contourVerificationX.reportNoDeposit(token3, { from: dan }), 'Verification is disabled');

      assert.equal(await registryX.exists(token3), true);
    });

    it('should allow burning a token if there is no sufficient deposit', async function() {
      await evmIncreaseTime(3601);

      const danBalanceBefore = await galtToken.balanceOf(dan);

      await contourVerificationX.reportNoDeposit(token3, { from: dan });

      const danBalanceAfter = await galtToken.balanceOf(dan);

      assert.equal(await registryX.exists(token3), false);

      assert.equal(await hodler.balanceOf(registryX.address, token3), 0);

      assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));

      await assertRevert(
        hodler.withdraw(registryX.address, token3, { from: charlie }),
        'ERC721: owner query for nonexistent token'
      );
    });

    it('should not allow burning a token if there is sufficient deposit', async function() {
      await galtToken.approve(hodler.address, ether(20), { from: charlie });
      await hodler.deposit(registryX.address, token3, ether(20), { from: charlie });

      await evmIncreaseTime(3601);

      await assertRevert(contourVerificationX.reportNoDeposit(token3), 'The deposit is sufficient');

      assert.equal(await registryX.exists(token3), true);

      await hodler.withdraw(registryX.address, token3, { from: charlie });

      assert.equal(await hodler.balanceOf(registryX.address, token3), 0);
    });

    it('should allow burning a token after reenabling verification', async function() {
      await evmIncreaseTime(3601);

      await contourVerificationX.disableVerification();

      await contourVerificationX.enableVerification(ether(50), 4000);

      await evmIncreaseTime(4000);

      await contourVerificationX.reportNoDeposit(token3, { from: dan });

      assert.equal(await registryX.exists(token3), false);
    });
  });

  describe('intersection reporting', () => {
    beforeEach(async function() {
      await contourVerificationX.enableVerification(ether(50), 3600);
      await evmIncreaseTime(3601);
    });

    describe('constraints', () => {
      it('should deny reporting when validation has not started yet', async function() {
        contourVerificationX = await PPContourVerification.new(
          controllerX.address,
          this.ppContourVerificationLib.address,
          ONE_HOUR,
          ONE_HOUR
        );
        await controllerX.setContourVerificationManager(contourVerificationX.address, { from: alice });

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Verification is disabled'
        );
      });

      it('should deny reporting during a grace period', async function() {
        await contourVerificationX.disableVerification();
        await contourVerificationX.enableVerification(ether(50), 3600);
        await evmIncreaseTime(3500);

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Verification is disabled'
        );
      });

      it('should deny reporting when validation has been disabled', async function() {
        await contourVerificationX.disableVerification();

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Verification is disabled'
        );
      });

      it('contour uniqueness should not working for land tokens: true, false', async function() {
        const validToken = await mintToken(contour1, TokenType.LAND_PLOT, 0, true);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT, 0, false);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(invalidToken), false);
      });

      it('contour uniqueness should not working for land tokens: false, true', async function() {
        const validToken = await mintToken(contour1, TokenType.LAND_PLOT, 0, false);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT, 0, true);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(invalidToken), false);
      });

      // eslint-disable-next-line max-len
      it("should deny reporting when an invalid token doesn't claim a contour uniqueness: true, true", async function() {
        const validToken = await mintToken(contour1, TokenType.LAND_PLOT, 0, true);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT, 0, true);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(invalidToken), false);
      });

      describe('timestamp constraints', () => {
        it('it should burn the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

          const danBalanceBefore = await galtToken.balanceOf(dan);

          await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

          const danBalanceAfter = await galtToken.balanceOf(dan);

          assert.equal(await registryX.exists(validToken), true);
          assert.equal(await registryX.exists(invalidToken), false);

          assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
        });

        it('it should burn the latest updated token after second update', async function() {
          const invalidToken = await mintToken(contour3, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const validToken = await mintToken(contour2, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);

          const data = registryX.contract.methods.setContour(invalidToken, contour1, 42).encodeABI();
          const res = await controllerX.propose(data, 'foo', { from: charlie });
          const proposalId = getEventArg(res, 'NewProposal', 'proposalId');
          await controllerX.approve(proposalId, { from: geoDataManager });

          await assertRevert(
            contourVerificationX.reportInclusion(invalidToken, validToken, contour1Contour2Point, { from: dan }),
            "invalidTimestamp >= validTimestamp' doesn't satisfied"
          );

          await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

          assert.equal(await registryX.exists(invalidToken), false);
          assert.equal(await registryX.exists(validToken), true);
        });

        it('it deny burning not the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

          await assertRevert(
            contourVerificationX.reportInclusion(invalidToken, validToken, contour1Contour2Point, { from: dan }),
            "Expression 'invalidTimestamp >= validTimestamp' doesn't satisfied."
          );
        });

        it('it should burn token A if it has the same latestTimestamp as a token B', async function() {
          // WARNING: tokenA timestamp could be earlier than tokenB,
          // but it also could be equal, if these both transactions were mined in the same block
          const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
          const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

          await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, { from: dan });

          assert.equal(await registryX.exists(tokenA), true);
          assert.equal(await registryX.exists(tokenB), false);
        });

        it.skip('it should burn token B if it has the same latestTimestamp as a token A', async function() {
          // WARNING: could fail due a bigger timestamp
          const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
          const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

          await contourVerificationX.reportInclusion(tokenB, tokenA, contour1Contour2Point, { from: dan });

          assert.equal(await registryX.exists(tokenA), false);
          assert.equal(await registryX.exists(tokenB), true);
        });
      });
    });

    describe('for LAND_PLOT token types', () => {
      it('it should allow burning contours with a different heights', async function() {
        // WARNING: tokenA timestamp could be earlier than tokenB,
        // but it also could be equal, if these both transactions were mined in the same block
        const tokenA = await mintToken(addHeightToContour(contour1, 50), TokenType.LAND_PLOT);
        const tokenB = await mintToken(addHeightToContour(contour2, -4), TokenType.LAND_PLOT);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('should deny burning when reporting tokens have different types', async function() {
        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.BUILDING);
        const anotherInvalidToken = await mintToken(contour2, TokenType.ROOM, -5);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Tokens type mismatch'
        );

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, anotherInvalidToken, contour1Contour2Point, { from: dan }),
          'Tokens type mismatch'
        );
      });
    });

    describe('for BUILDING token types', () => {
      it('it should allow burning contours with a different heights', async function() {
        // WARNING: tokenA timestamp could be earlier than tokenB,
        // but it also could be equal, if these both transactions were mined in the same block
        const tokenA = await mintToken(addHeightToContour(contour1, 50), TokenType.BUILDING);
        const tokenB = await mintToken(addHeightToContour(contour2, -4), TokenType.BUILDING);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('should deny burning when reporting tokens have different types', async function() {
        const validToken = await mintToken(contour1, TokenType.BUILDING);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);
        const anotherInvalidToken = await mintToken(contour2, TokenType.ROOM, -5);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Tokens type mismatch'
        );

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, anotherInvalidToken, contour1Contour2Point, { from: dan }),
          'Tokens type mismatch'
        );
      });
    });

    describe('for ROOM token types', () => {
      it('should allow report with existing token intersection proof', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, 25), TokenType.ROOM, 35);

        const danBalanceBefore = await galtToken.balanceOf(dan);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        const danBalanceAfter = await galtToken.balanceOf(dan);

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);

        assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
      });

      it('should allow report token intersection proof, claim uniqueness and same human addresses', async function() {
        const validToken = await mintToken(
          addHeightToContour(contour1, 20),
          TokenType.ROOM,
          30,
          true,
          'Human address 1'
        );
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(
          addHeightToContour(contour2, 25),
          TokenType.ROOM,
          35,
          true,
          'Human address 1'
        );

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);
      });

      // eslint-disable-next-line max-len
      it('should allow report token intersection proof, claim uniqueness and same human addresses without vertical intersection', async function() {
        const validToken = await mintToken(
          addHeightToContour(contour1, 10),
          TokenType.ROOM,
          20,
          true,
          'Human address 1'
        );
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(
          addHeightToContour(contour2, 25),
          TokenType.ROOM,
          35,
          true,
          'Human address 1'
        );

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);
      });

      // eslint-disable-next-line max-len
      it('should allow report token intersection only one claim uniqueness with different human addresses', async function() {
        const validToken = await mintToken(
          addHeightToContour(contour1, 20),
          TokenType.ROOM,
          30,
          true,
          'Human address 1'
        );
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(
          addHeightToContour(contour2, 25),
          TokenType.ROOM,
          35,
          false,
          'Human address 2'
        );

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan });

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);
      });

      it('should deny report token intersection claim uniqueness with different human addresses', async function() {
        const validToken = await mintToken(
          addHeightToContour(contour1, 20),
          TokenType.ROOM,
          30,
          true,
          'Human address 1'
        );
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(
          addHeightToContour(contour2, 25),
          TokenType.ROOM,
          35,
          true,
          'Human address 2'
        );

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Both tokens have uniqueness flag and different human addresses'
        );

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), true);
      });

      it('should deny report token intersection claim uniqueness set by proposal', async function() {
        const validToken = await mintToken(
          addHeightToContour(contour1, 20),
          TokenType.ROOM,
          30,
          false,
          'Human address 1'
        );
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(
          addHeightToContour(contour2, 25),
          TokenType.ROOM,
          35,
          false,
          'Human address 2'
        );

        let data = registryX.contract.methods
          .setPropertyExtraData(validToken.toString(), await controllerX.CLAIM_UNIQUENESS_KEY(), numberToEvmWord(1))
          .encodeABI();
        let res = await controllerX.propose(data, 'foo', { from: charlie });
        await controllerX.approve(getEventArg(res, 'NewProposal', 'proposalId'), { from: geoDataManager });

        data = registryX.contract.methods
          .setPropertyExtraData(invalidToken.toString(), await controllerX.CLAIM_UNIQUENESS_KEY(), numberToEvmWord(1))
          .encodeABI();
        res = await controllerX.propose(data, 'foo', { from: charlie });
        await controllerX.approve(getEventArg(res, 'NewProposal', 'proposalId'), { from: geoDataManager });

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Both tokens have uniqueness flag and different human addresses'
        );

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), true);
      });

      it('should deny report with (NON-IS contours AND IS heights)', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour3, 25), TokenType.ROOM, 35);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour3Point, { from: dan }),
          'Inclusion not found'
        );
      });

      it('should deny report with (IS contours AND NON-IS heights)', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, -5), TokenType.ROOM, 10);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, { from: dan }),
          'Contour intersects, but not the heights'
        );
      });
    });
  });

  describe('inclusion reporting', () => {
    beforeEach(async function() {
      await contourVerificationX.enableVerification(ether(50), 3600);
      await evmIncreaseTime(3601);
    });

    describe('constraints', () => {
      it('should deny reporting when validation has not started yet', async function() {
        contourVerificationX = await PPContourVerification.new(
          controllerX.address,
          this.ppContourVerificationLib.address,
          ONE_HOUR,
          ONE_HOUR
        );
        await controllerX.setContourVerificationManager(contourVerificationX.address, { from: alice });

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour5, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour5Point, {
            from: dan
          }),
          'Verification is disabled'
        );
      });

      it('should deny reporting during a grace period', async function() {
        await contourVerificationX.disableVerification();
        await contourVerificationX.enableVerification(ether(50), 3600);
        await evmIncreaseTime(3500);

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
            from: dan
          }),
          'Verification is disabled'
        );
      });

      it('should deny reporting when validation has been disabled', async function() {
        await contourVerificationX.disableVerification();

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
            from: dan
          }),
          'Verification is disabled'
        );
      });

      describe('timestamp constraints', () => {
        it('it should burn the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

          const danBalanceBefore = await galtToken.balanceOf(dan);

          await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
            from: dan
          });

          const danBalanceAfter = await galtToken.balanceOf(dan);

          assert.equal(await registryX.exists(validToken), true);
          assert.equal(await registryX.exists(invalidToken), false);

          assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
        });

        it('it deny burning not the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour5, TokenType.LAND_PLOT);

          await assertRevert(
            contourVerificationX.reportInclusion(invalidToken, validToken, contour1Contour5Point, {
              from: dan
            }),
            "Expression 'invalidTimestamp >= validTimestamp' doesn't satisfied."
          );
        });

        it('it should burn token A if it has the same latestTimestamp as a token B', async function() {
          const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
          const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

          await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, {
            from: dan
          });

          assert.equal(await registryX.exists(tokenA), true);
          assert.equal(await registryX.exists(tokenB), false);
        });
      });
    });

    describe('for LAND_PLOT token types', () => {
      it('it should allow burning when an invalid token is inside a valid', async function() {
        const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
        const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, {
          from: dan
        });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('it should allow burning when an invalid token the same as valid', async function() {
        const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
        const tokenB = await mintToken(contour1, TokenType.LAND_PLOT);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, {
          from: dan
        });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('it should allow burning when a valid token is inside an invalid', async function() {
        const tokenA = await mintToken(contour4, TokenType.LAND_PLOT);
        const tokenB = await mintToken(contour1, TokenType.LAND_PLOT);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour4Point, {
          from: dan
        });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('it should deny burning when the point is outside valid contour', async function() {
        const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
        const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportInclusion(tokenA, tokenB, contour2Point, { from: dan }),
          'Inclusion not found'
        );
      });
    });

    describe('for BUILDING token types', () => {
      it('it should allow burning when an invalid token is inside a valid', async function() {
        const tokenA = await mintToken(contour1, TokenType.BUILDING);
        const tokenB = await mintToken(contour2, TokenType.BUILDING);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour2Point, {
          from: dan
        });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('it should allow burning when a valid token is inside an invalid', async function() {
        const tokenA = await mintToken(contour4, TokenType.BUILDING);
        const tokenB = await mintToken(contour1, TokenType.BUILDING);

        await contourVerificationX.reportInclusion(tokenA, tokenB, contour1Contour4Point, {
          from: dan
        });

        assert.equal(await registryX.exists(tokenA), true);
        assert.equal(await registryX.exists(tokenB), false);
      });

      it('it should deny burning when the point is outside valid contour', async function() {
        const tokenA = await mintToken(contour1, TokenType.BUILDING);
        const tokenB = await mintToken(contour2, TokenType.BUILDING);

        await assertRevert(
          contourVerificationX.reportInclusion(tokenA, tokenB, contour2Point, { from: dan }),
          'Inclusion not found'
        );
      });
    });

    describe('for ROOM token types', () => {
      it('should allow rejecting with existing token intersection proof', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, 25), TokenType.ROOM, 35);

        const danBalanceBefore = await galtToken.balanceOf(dan);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
          from: dan
        });

        const danBalanceAfter = await galtToken.balanceOf(dan);

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);

        assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
      });

      it('should deny rejecting with different tokens human addresses', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, 25), TokenType.ROOM, 35);

        const danBalanceBefore = await galtToken.balanceOf(dan);

        await contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
          from: dan
        });

        const danBalanceAfter = await galtToken.balanceOf(dan);

        assert.equal(await registryX.exists(validToken), true);
        assert.equal(await registryX.exists(invalidToken), false);

        assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
      });

      it('should deny rejecting valid/invalid with (NON-IN contours AND IS heights)', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, 25), TokenType.ROOM, 35);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour2Point, {
            from: dan
          }),
          'Inclusion not found'
        );
      });

      it('should deny rejecting invalid/valid with (NON-IN contours AND IS heights)', async function() {
        const validToken = await mintToken(addHeightToContour(contour2, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour1, 25), TokenType.ROOM, 35);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour2Point, {
            from: dan
          }),
          'Inclusion not found'
        );
      });

      it('should deny rejecting with (IN contours AND NON-IS heights)', async function() {
        const validToken = await mintToken(addHeightToContour(contour1, 20), TokenType.ROOM, 30);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(addHeightToContour(contour2, -5), TokenType.ROOM, 10);

        await assertRevert(
          contourVerificationX.reportInclusion(validToken, invalidToken, contour1Contour2Point, {
            from: dan
          }),
          'Contour intersects, but not the heights'
        );
      });
    });
  });
});
