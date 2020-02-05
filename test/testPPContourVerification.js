const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');
const contractPoint = require('@galtproject/utils').contractPoint;

const PPDepositHolder = contract.fromArtifact('PPDepositHolder');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPACL = contract.fromArtifact('PPACL');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPContourVerification = contract.fromArtifact('PPContourVerification');
const PPContourVerificationPublicLib = contract.fromArtifact('PPContourVerificationPublicLib');
const PPToken = contract.fromArtifact('PPToken');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');

const {
  now,
  ether,
  assertRevert,
  getEventArg,
  assertErc20BalanceChanged,
  evmIncreaseTime
} = require('@galtproject/solidity-test-chest')(web3);

PPDepositHolder.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 3600;

const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

const rawContour1 = ['dr5qvnpd300r', 'dr5qvnp655pq', 'dr5qvnp3g3w0', 'dr5qvnp9cnpt'];
const contour1 = rawContour1.map(contractPoint.encodeFromGeohash);
const rawContour2 = ['dr5qvnpd0eqs', 'dr5qvnpd5npy', 'dr5qvnp9grz7', 'dr5qvnpd100z'];
const contour2 = rawContour2.map(contractPoint.encodeFromGeohash);
// const rawContour3 = ['dr5qvnp9c7b2', 'dr5qvnp3ewcv', 'dr5qvnp37vs4', 'dr5qvnp99ddh'];
// const contour3 = rawContour3.map(contractPoint.encodeFromGeohash);
const rawContour4 = ['dr5qvnp6hfwt', 'dr5qvnp6h46c', 'dr5qvnp3gdwu', 'dr5qvnp3u57s'];
const contour4 = rawContour4.map(contractPoint.encodeFromGeohash);
// const rawContour5 = ['dr5qvnp3vur6', 'dr5qvnp3yv97', 'dr5qvnp3ybpq', 'dr5qvnp3wp47'];
// const contour5 = rawContour5.map(contractPoint.encodeFromGeohash);
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
  const [alice, bob, charlie, dan, minter] = accounts;
  let hodler;
  let token3;
  let controllerX;
  let contourVerificationX;
  let registryX;
  let galtToken;

  function cPoint(geohash) {
    return contractPoint.encodeFromGeohash(geohash);
  }

  /**
   * @param {number[]} contour
   * @param {TokenType} tokenType
   * @param {number} highestPoint
   * @returns {number} tokenId
   */
  async function mintToken(contour, tokenType, highestPoint = -42) {
    const res = await controllerX.mint(charlie, { from: minter });
    const localTokenId = getEventArg(res, 'Mint', 'tokenId');

    await controllerX.setInitialDetails(
      localTokenId,
      // tokenType
      tokenType,
      1,
      123,
      utf8ToHex('foo'),
      'bar',
      'buzz',
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

    return localTokenId;
  }

  before(async function() {
    galtToken = await MintableErc20Token.new();
    await galtToken.mint(alice, ether(1000));
    await galtToken.mint(bob, ether(1000));
    await galtToken.mint(charlie, ether(1000));

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
    await controllerX.setFee(bytes32('LOCKER_ETH'), ether(0.1), { from: alice });
  });

  beforeEach(async function() {
    const res = await controllerX.mint(charlie, { from: minter });
    token3 = getEventArg(res, 'Mint', 'tokenId');

    // SETUP CONTOUR VERIFICATION MANAGER
    contourVerificationX = await PPContourVerification.new(
      controllerX.address,
      this.ppContourVerificationLib.address,
      3600 /* one hour timeout */
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

      contourVerificationX.reportNoDeposit(token3, { from: dan });

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
          3600 /* one hour timeout */
        );
        await controllerX.setContourVerificationManager(contourVerificationX.address, { from: alice });

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportIntersection(
            validToken,
            invalidToken,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          ),
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
          contourVerificationX.reportIntersection(
            validToken,
            invalidToken,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          ),
          'Verification is disabled'
        );
      });

      it('should deny reporting when validation has been disabled', async function() {
        await contourVerificationX.disableVerification();

        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportIntersection(
            validToken,
            invalidToken,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          ),
          'Verification is disabled'
        );
      });
    });

    describe('for LAND_PLOT token types', () => {
      describe('intersecting contours', () => {
        it('it should burn the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

          const danBalanceBefore = await galtToken.balanceOf(dan);

          await contourVerificationX.reportIntersection(
            validToken,
            invalidToken,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          );

          const danBalanceAfter = await galtToken.balanceOf(dan);

          assert.equal(await registryX.exists(validToken), true);
          assert.equal(await registryX.exists(invalidToken), false);

          assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));
        });

        it('it deny burning not the latest updated token', async function() {
          const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
          await evmIncreaseTime(10);
          const invalidToken = await mintToken(contour2, TokenType.LAND_PLOT);

          await assertRevert(
            contourVerificationX.reportIntersection(
              invalidToken,
              validToken,
              0,
              cPoint('dr5qvnpd0eqs'),
              cPoint('dr5qvnpd5npy'),
              3,
              cPoint('dr5qvnp9cnpt'),
              cPoint('dr5qvnpd300r'),
              { from: dan }
            ),
            "Expression 'invalidTimestamp >= validTimestamp' doesn't satisfied."
          );
        });

        it('it should burn token A if it has the same latestTimestamp as a token B', async function() {
          const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
          const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

          await contourVerificationX.reportIntersection(
            tokenA,
            tokenB,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          );

          assert.equal(await registryX.exists(tokenA), true);
          assert.equal(await registryX.exists(tokenB), false);
        });

        it.skip('it should burn token B if it has the same latestTimestamp as a token A', async function() {
          // WARNING: could fail due a bigger timestamp
          const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
          const tokenB = await mintToken(contour2, TokenType.LAND_PLOT);

          await contourVerificationX.reportIntersection(
            tokenB,
            tokenA,
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            { from: dan }
          );

          assert.equal(await registryX.exists(tokenA), false);
          assert.equal(await registryX.exists(tokenB), true);
        });
      });

      it('should deny burning when reporting non-intersecting contour', async function() {
        const tokenA = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const tokenB = await mintToken(contour4, TokenType.LAND_PLOT);

        await assertRevert(
          contourVerificationX.reportIntersection(
            tokenA,
            tokenB,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnp6hfwt'),
            cPoint('dr5qvnp6h46c'),
            { from: dan }
          ),
          "Tokens don't intersect"
        );
      });

      it('should deny burning when reporting non-intersecting contour', async function() {
        const validToken = await mintToken(contour1, TokenType.LAND_PLOT);
        await evmIncreaseTime(10);
        const invalidToken = await mintToken(contour2, TokenType.BUILDING);

        await assertRevert(
          contourVerificationX.reportIntersection(
            validToken,
            invalidToken,
            3,
            cPoint('dr5qvnp9cnpt'),
            cPoint('dr5qvnpd300r'),
            0,
            cPoint('dr5qvnpd0eqs'),
            cPoint('dr5qvnpd5npy'),
            { from: dan }
          ),
          'Tokens type mismatch'
        );
      });

      it("should deny burning token when valid token doesn't claim contour uniqueness");
    });
  });
});
