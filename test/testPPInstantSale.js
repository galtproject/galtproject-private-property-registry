const PPMarket = artifacts.require('./PPMarket.sol');
const PPToken = artifacts.require('./PPToken.sol');
const PPTokenController = artifacts.require('./PPTokenController.sol');
const PPTokenFactory = artifacts.require('./PPTokenFactory.sol');
const PPTokenControllerFactory = artifacts.require('PPTokenControllerFactory.sol');
const PPGlobalRegistry = artifacts.require('./PPGlobalRegistry.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const PPInstantSale = artifacts.require('PPInstantSale.sol');
const PPInstantSaleFactory = artifacts.require('PPInstantSaleFactory.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');
const _ = require('lodash');

PPToken.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';
PPMarket.numberFormat = 'String';
PPInstantSale.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { web3 } = PPMarket;
const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const { zeroAddress, ether, assertRevert, assertEthBalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const SaleOrderStatus = {
  INACTIVE: 0,
  ACTIVE: 1
};

const SaleOfferStatus = {
  INACTIVE: 0,
  ACTIVE: 1
};

const ValidationStatus = {
  NOT_EXISTS: 0,
  PENDING: 1,
  LOCKED: 2,
  APPROVED: 3,
  REJECTED: 4
};

const PaymentMethods = {
  NONE: 0,
  ETH_ONLY: 1,
  GALT_ONLY: 2,
  ETH_AND_GALT: 3
};

const Currency = {
  ETH: 0,
  GALT: 1
};

const EscrowCurrency = {
  ETH: 0,
  ERC20: 1
};

Object.freeze(SaleOrderStatus);
Object.freeze(SaleOfferStatus);
Object.freeze(ValidationStatus);
Object.freeze(PaymentMethods);
Object.freeze(Currency);

const ONE_HOUR = 60 * 60;

contract('PPInstantSale', accounts => {
  const [coreTeam, minter, alice, bob, charlie, dan, eve, feeManager] = accounts;

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';
  const dataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3jq';

  // both for a factory and a market
  const ethFee = ether(5);
  const galtFee = ether(10);

  before(async function() {
    this.galtToken = await MintableErc20Token.new();
    this.daiToken = await MintableErc20Token.new();
    this.unregisteredPPToken = await PPToken.new('Foo', 'BAR');

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppInstantSaleFactory = await PPInstantSaleFactory.new(this.ppgr.address, ether(20), charlie);

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);
    this.ppMarket = await PPMarket.new(this.ppgr.address, ethFee, galtFee);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_MARKET(), this.ppMarket.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true, { from: coreTeam });

    const res = await this.ppTokenFactory.build('Foo', 'BAR', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      value: 0
    });
    this.ppToken = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    this.ppController = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

    this.ppController.setMinter(minter);
    this.ppController.setFeeManager(feeManager);
    this.ppController.setFeeCollector(feeManager);
    this.ppController.setFee(bytes32('INSTANT_SALE_SHARE_ETH'), ether(4), { from: feeManager });

    await this.galtToken.mint(alice, ether(10000000));
    await this.galtToken.mint(bob, ether(10000000));
    await this.daiToken.mint(bob, ether(10000000));
  });

  beforeEach(async function() {
    let res = await this.ppController.mint(alice, { from: minter });
    this.ppTokenId1 = _.find(res.logs, l => l.args.tokenId).args.tokenId;
    res = await this.ppController.mint(alice, { from: minter });
    this.ppTokenId2 = _.find(res.logs, l => l.args.tokenId).args.tokenId;
  });

  let res;
  let instantSaleAddress;
  let instantSale;
  let promoCode;
  let invalidPromoCode;

  describe('promoCode management', () => {
    beforeEach(async function() {
      res = await this.ppMarket.createSaleOrder(
        this.ppToken.address,
        [this.ppTokenId1, this.ppTokenId2],
        bob,
        ether(50),
        dataLink,
        EscrowCurrency.ETH,
        zeroAddress,
        { from: alice, value: ether(5) }
      );
      this.rId = res.logs[0].args.orderId;

      res = await this.ppInstantSaleFactory.build(this.rId, alice, { from: bob });
      instantSaleAddress = res.logs[0].args.instantSaleContract;

      instantSale = await PPInstantSale.at(instantSaleAddress);

      assert.equal(await instantSale.owner(), bob);

      promoCode = web3.utils.soliditySha3('foo');
      invalidPromoCode = web3.utils.soliditySha3('bar');

      await assertRevert(
        instantSale.setPromoCode(promoCode, dan, ether(20), ether(5), true, { from: alice }),
        'Ownable: caller is not the owner'
      );
      await instantSale.setPromoCode(promoCode, dan, ether(20), ether(5), true, { from: bob });

      // alice owns the tokens, bob owns instantSale contract
      await this.ppToken.approve(instantSale.address, this.ppTokenId1, { from: alice });
      await this.ppToken.approve(instantSale.address, this.ppTokenId2, { from: alice });
    });

    it('should deny setting invalid promo code fee percent', async function() {
      await assertRevert(
        instantSale.setPromoCode(promoCode, dan, ether(100), ether(5), true, { from: bob }),
        'Invalid discount value'
      );
      await assertRevert(
        instantSale.setPromoCode(promoCode, dan, ether(5), ether(100), true, { from: bob }),
        'Invalid referral fee value'
      );
    });

    it('should provide correct discount details if there is a valid promo code specified', async function() {
      assert.equal(await instantSale.priceWithDiscount(promoCode), ether(40));
      assert.equal(await instantSale.priceWithDiscount(invalidPromoCode), ether(50));

      await assertRevert(instantSale.disablePromoCode(promoCode, { from: alice }), 'Ownable: caller is not the owner');
      await instantSale.disablePromoCode(promoCode, { from: bob });

      assert.equal(await instantSale.priceWithDiscount(promoCode), ether(50));
      assert.equal(await instantSale.priceWithDiscount(invalidPromoCode), ether(50));
    });

    it('should make a discount if there is a valid promo code specified', async function() {
      assert.equal(await instantSale.price(), ether(50));
      assert.equal(await instantSale.priceWithDiscount(promoCode), ether(40));
      // 40 * 0.04
      assert.equal(await instantSale.tokenContractOwnerEthReward(ether(40)), ether(1.6));
      // 40 * 0.2
      assert.equal(await instantSale.protocolEthReward(ether(40)), ether(8));
      assert.equal(await instantSale.referralEthReward(ether(40), promoCode), ether(2));

      const aliceBalanceBefore = await web3.eth.getBalance(alice);
      const charlieBalanceBefore = await web3.eth.getBalance(charlie);
      const danBalanceBefore = await web3.eth.getBalance(dan);
      const controllerBalanceBefore = await web3.eth.getBalance(this.ppController.address);

      await instantSale.buy(true, 'foo', { from: eve, value: ether(40) });

      const aliceBalanceAfter = await web3.eth.getBalance(alice);
      const charlieBalanceAfter = await web3.eth.getBalance(charlie);
      const danBalanceAfter = await web3.eth.getBalance(dan);
      const controllerBalanceAfter = await web3.eth.getBalance(this.ppController.address);

      // seller: (50 - 20%) - 8 - 2 - 1.6 = 28.4
      assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(28.4));
      // protocol fee 20%
      assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(8));
      // referral fee 5%
      assertEthBalanceChanged(danBalanceBefore, danBalanceAfter, ether(2));
      // registry fee 4%
      assertEthBalanceChanged(controllerBalanceBefore, controllerBalanceAfter, ether(1.6));
    });

    it('should not make a discount if the sender wont use a promo code', async function() {
      const aliceBalanceBefore = await web3.eth.getBalance(alice);
      const charlieBalanceBefore = await web3.eth.getBalance(charlie);
      const controllerBalanceBefore = await web3.eth.getBalance(this.ppController.address);

      // 50 - 10 - 2 = 38
      await instantSale.buy(false, 'foo', { from: eve, value: ether(50) });

      const aliceBalanceAfter = await web3.eth.getBalance(alice);
      const charlieBalanceAfter = await web3.eth.getBalance(charlie);
      const controllerBalanceAfter = await web3.eth.getBalance(this.ppController.address);

      assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(38));
      assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(10));
      assertEthBalanceChanged(controllerBalanceBefore, controllerBalanceAfter, ether(2));
    });
  });

  describe('creation', () => {
    it('should create a new sale order with ETH payment method', async function() {
      res = await this.ppMarket.createSaleOrder(
        this.ppToken.address,
        [this.ppTokenId1, this.ppTokenId2],
        bob,
        ether(50),
        dataLink,
        EscrowCurrency.ETH,
        zeroAddress,
        { from: alice, value: ether(5) }
      );
      this.rId = res.logs[0].args.orderId;

      res = await this.ppInstantSaleFactory.build(this.rId, alice);
      instantSaleAddress = res.logs[0].args.instantSaleContract;

      instantSale = await PPInstantSale.at(instantSaleAddress);

      // public variables
      assert.equal(await instantSale.marketContract(), this.ppMarket.address);
      assert.equal(await instantSale.marketOrderId(), this.rId);
      assert.equal(await instantSale.protocolFee(), ether(20));
      assert.equal(await instantSale.protocolFeeBeneficiary(), charlie);
      assert.equal(await instantSale.saleBeneficiary(), alice);

      // getters
      assert.equal(await instantSale.price(), ether(50));
      assert.equal(await instantSale.priceWithDiscount(bytes32('')), ether(50));
      assert.equal(await instantSale.tokenContractOwnerEthFeePct(), ether(4));
      // 50 * 0.04
      assert.equal(await instantSale.tokenContractOwnerEthReward(ether(50)), ether(2));
      // 50 * 0.20
      assert.equal(await instantSale.protocolEthReward(ether(50)), ether(10));
      assert.sameMembers(await instantSale.getTokenIds(), [this.ppTokenId1, this.ppTokenId2]);

      await assertRevert(instantSale.buy(false, ''), 'Invalid payment');

      assert.equal(await this.ppToken.ownerOf(this.ppTokenId1), alice);
      assert.equal(await this.ppToken.ownerOf(this.ppTokenId2), alice);

      await this.ppToken.approve(instantSale.address, this.ppTokenId1, { from: alice });
      await this.ppToken.approve(instantSale.address, this.ppTokenId2, { from: alice });

      const aliceBalanceBefore = await web3.eth.getBalance(alice);
      const charlieBalanceBefore = await web3.eth.getBalance(charlie);
      const controllerBalanceBefore = await web3.eth.getBalance(this.ppController.address);

      // 50 - 10 - 2 = 38
      await instantSale.buy(false, '', { from: dan, value: ether(50) });

      const aliceBalanceAfter = await web3.eth.getBalance(alice);
      const charlieBalanceAfter = await web3.eth.getBalance(charlie);
      const controllerBalanceAfter = await web3.eth.getBalance(this.ppController.address);

      assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(38));
      assertEthBalanceChanged(charlieBalanceBefore, charlieBalanceAfter, ether(10));
      assertEthBalanceChanged(controllerBalanceBefore, controllerBalanceAfter, ether(2));

      assert.equal(await this.ppToken.ownerOf(this.ppTokenId1), dan);
      assert.equal(await this.ppToken.ownerOf(this.ppTokenId2), dan);
    });

    it('should revert when trying to create an InstantSale contract based on ERC20 order', async function() {
      res = await this.ppMarket.createSaleOrder(
        this.ppToken.address,
        [this.ppTokenId1, this.ppTokenId2],
        bob,
        ether(50),
        dataLink,
        EscrowCurrency.ERC20,
        zeroAddress,
        { from: alice, value: ether(5) }
      );
      this.rId = res.logs[0].args.orderId;

      await assertRevert(this.ppInstantSaleFactory.build(this.rId, alice), 'Invalid currency');
    });
  });
});
