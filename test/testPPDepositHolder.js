const { accounts, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPDepositHolder = contract.fromArtifact('PPDepositHolder');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPACL = contract.fromArtifact('PPACL');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPToken = contract.fromArtifact('PPToken');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');

const { ether, assertRevert, getEventArg } = require('@galtproject/solidity-test-chest')(web3);

PPDepositHolder.numberFormat = 'String';

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 3600;

const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

describe('PPDepositHolder', () => {
  const [alice, bob, charlie, dan, minter, fakeCVManager] = accounts;
  let hodler;

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

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);

    hodler = await PPDepositHolder.new(this.ppgr.address);

    // CREATE REGISTRIES
    let res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice
    });
    this.registryX = await PPToken.at(getEventArg(res, 'Build', 'token'));
    this.controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

    await this.controllerX.setMinter(minter, { from: alice });
    await this.controllerX.setFee(bytes32('LOCKER_ETH'), ether(0.1), { from: alice });

    res = await this.controllerX.mint(alice, { from: minter });
    this.token1 = getEventArg(res, 'Mint', 'tokenId');
    res = await this.controllerX.mint(bob, { from: minter });
    this.token2 = getEventArg(res, 'Mint', 'tokenId');
    res = await this.controllerX.mint(charlie, { from: minter });
    this.token3 = getEventArg(res, 'Mint', 'tokenId');

    // SETUP CONTOUR VERIFICATION MANAGER
    await this.controllerX.setContourVerificationManager(fakeCVManager, { from: alice });
  });

  describe('deposits/withdrawals', () => {
    it('should allow making deposit several times while withdrawal only once', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(42));

      await this.galtToken.approve(hodler.address, ether(42), { from: bob });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: bob });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(84));

      // claim back
      await assertRevert(hodler.withdraw(this.registryX.address, this.token3, { from: bob }), 'Not the token owner');
      await hodler.withdraw(this.registryX.address, this.token3, { from: charlie });

      assert(await this.galtToken.balanceOf(charlie), 1042);
    });

    it('should allow withdraing a deposit to a new token owner', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(42));

      await this.galtToken.approve(hodler.address, ether(42), { from: bob });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: bob });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(84));

      await this.registryX.transferFrom(charlie, alice, this.token3, { from: charlie });

      // claim back
      await assertRevert(
        hodler.withdraw(this.registryX.address, this.token3, { from: charlie }),
        'Not the token owner'
      );
      await hodler.withdraw(this.registryX.address, this.token3, { from: alice });

      assert(await this.galtToken.balanceOf(charlie), 1084);
    });

    it('should deny depositing for non-existing tokenContracts', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: bob });
      await assertRevert(hodler.deposit(alice, 0, ether(42), { from: bob }), 'Token address is invalid');
    });

    it('should deny depositing for non-existing token ID', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: bob });
      await assertRevert(hodler.deposit(this.registryX.address, 123, ether(42), { from: bob }), "Token doesn't exists");
    });
  });

  describe('payouts', () => {
    it('should allow claiming a valid ContourVerification contract for payout', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(42));

      await hodler.payout(this.registryX.address, this.token3, dan, { from: fakeCVManager });

      assert.equal(await this.galtToken.balanceOf(dan), ether(42));
      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), 0);
    });

    it('should deny claiming the invalid ContourVerification contract for payout', async function() {
      await this.galtToken.approve(hodler.address, ether(42), { from: charlie });
      await hodler.deposit(this.registryX.address, this.token3, ether(42), { from: charlie });

      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(42));

      await assertRevert(hodler.payout(alice, 0, dan, { from: fakeCVManager }), 'Token address is invalid');

      assert.equal(await this.galtToken.balanceOf(dan), 0);
      assert.equal(await hodler.balanceOf(this.registryX.address, this.token3), ether(42));
    });
  });
});
