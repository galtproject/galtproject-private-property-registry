const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPDepositHolder = contract.fromArtifact('PPDepositHolder');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPACL = contract.fromArtifact('PPACL');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPContourVerification = contract.fromArtifact('PPContourVerification');
const PPToken = contract.fromArtifact('PPToken');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');

const {
  ether,
  assertRevert,
  getEventArg,
  assertErc20BalanceChanged,
  evmIncreaseTime
} = require('@galtproject/solidity-test-chest')(web3);

/**
 * Returns the latest block timestamp
 * @returns number
 */
async function now() {
  const latestBlock = await web3.eth.getBlock('latest');
  return parseInt(latestBlock.timestamp, 10);
}

PPDepositHolder.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 3600;

const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

describe('PPContourVerification', () => {
  const [alice, bob, charlie, dan, minter] = accounts;
  let hodler;
  let token3;

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(alice, ether(1000));
    await this.galtToken.mint(bob, ether(1000));
    await this.galtToken.mint(charlie, ether(1000));

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);
    hodler = await PPDepositHolder.new(this.ppgr.address);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(bytes32('deposit_holder'), hodler.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);

    // CREATE REGISTRIES
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice
    });
    this.registryX = await PPToken.at(getEventArg(res, 'Build', 'token'));
    this.controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

    await this.controllerX.setMinter(minter, { from: alice });
    await this.controllerX.setFee(bytes32('LOCKER_ETH'), ether(0.1), { from: alice });

    res = await this.controllerX.mint(alice, { from: minter });
    await this.controllerX.mint(bob, { from: minter });
    await this.controllerX.mint(charlie, { from: minter });
    token3 = getEventArg(res, 'Mint', 'tokenId');

    // SETUP CONTOUR VERIFICATION MANAGER
    this.contourVerificationX = await PPContourVerification.new(this.controllerX.address, 3600 /* one hour timeout */);
    await this.controllerX.setContourVerificationManager(this.contourVerificationX.address, { from: alice });
  });

  // TEST case:
  // - deposit < required
  // - enabled/disabled
  describe('management', async function() {
    it('should not allow enabling already enabled verification', async function() {
      await this.contourVerificationX.enableVerification(ether(50), 3600);
      await assertRevert(
        this.contourVerificationX.enableVerification(ether(50), 3600),
        'Verification is already enabled'
      );
      assert.equal((await this.contourVerificationX.activeFrom()) <= now() + 3600, true);
      assert.equal(await this.contourVerificationX.minimalDeposit(), ether(50));
    });

    it('should not allow enabling verification with not big enough timeout', async function() {
      await assertRevert(this.contourVerificationX.enableVerification(ether(50), 3599), 'Timeout is not big enough');
    });

    it('should allow enabling verification with not big enough timeout', async function() {
      await this.contourVerificationX.enableVerification(ether(50), 3601);
    });

    it('should allow enabling verification again after its being disabled', async function() {
      await this.contourVerificationX.enableVerification(ether(50), 3600);
      await this.contourVerificationX.disableVerification();
      await this.contourVerificationX.enableVerification(ether(50), 4000);
    });
  });

  describe('reporting', () => {
    beforeEach(async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(this.registryX.address, token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, token3), ether(42));
      assert.equal(await this.registryX.exists(token3), true);

      await this.contourVerificationX.enableVerification(ether(50), 3600);
    });

    it('should allow burning only after timeout passes', async function() {
      await evmIncreaseTime(3598);

      await assertRevert(this.contourVerificationX.reportNoDeposit(token3, { from: dan }), 'Verification is disabled');

      await evmIncreaseTime(2);

      this.contourVerificationX.reportNoDeposit(token3, { from: dan });

      assert.equal(await this.registryX.exists(token3), false);
    });

    it('should deny burning after disabling verification', async function() {
      await evmIncreaseTime(3601);

      await this.contourVerificationX.disableVerification();

      // "Verification is disabled" is returned because "minimalDeposit" field is 0 when verification is disbaled
      await assertRevert(this.contourVerificationX.reportNoDeposit(token3, { from: dan }), 'The deposit is sufficient');

      assert.equal(await this.registryX.exists(token3), true);
    });

    it('should allow burning a token if there is no sufficient deposit', async function() {
      await evmIncreaseTime(3601);

      const danBalanceBefore = await this.galtToken.balanceOf(dan);

      await this.contourVerificationX.reportNoDeposit(token3, { from: dan });

      const danBalanceAfter = await this.galtToken.balanceOf(dan);

      assert.equal(await this.registryX.exists(token3), false);

      assert.equal(await hodler.balanceOf(this.registryX.address, token3), 0);

      assertErc20BalanceChanged(danBalanceBefore, danBalanceAfter, ether(42));

      await assertRevert(
        hodler.withdraw(this.registryX.address, token3, { from: charlie }),
        'ERC721: owner query for nonexistent token'
      );
    });

    it('should not allow burning a token if there is sufficient deposit', async function() {
      await this.galtToken.approve(hodler.address, ether(20), { from: charlie });
      await hodler.deposit(this.registryX.address, token3, ether(20), { from: charlie });

      await evmIncreaseTime(3601);

      await assertRevert(this.contourVerificationX.reportNoDeposit(token3), 'The deposit is sufficient');

      assert.equal(await this.registryX.exists(token3), true);

      await hodler.withdraw(this.registryX.address, token3, { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, token3), 0);
    });

    it('should allow burning a token after reenabling verification', async function() {
      await evmIncreaseTime(3601);

      await this.contourVerificationX.disableVerification();

      await this.contourVerificationX.enableVerification(ether(50), 4000);

      await evmIncreaseTime(4000);

      await this.contourVerificationX.reportNoDeposit(token3, { from: dan });

      assert.equal(await this.registryX.exists(token3), false);
    });
  });
});
