const PPMarket = artifacts.require('./PPMarket.sol');
const PPToken = artifacts.require('./PPToken.sol');
const PPTokenController = artifacts.require('./PPTokenController.sol');
const PPTokenFactory = artifacts.require('./PPTokenFactory.sol');
const PPTokenControllerFactory = artifacts.require('PPTokenControllerFactory.sol');
const PPGlobalRegistry = artifacts.require('./PPGlobalRegistry.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

PPToken.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';
PPMarket.numberFormat = 'String';

const { web3 } = PPMarket;
const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const {
  zeroAddress,
  ether,
  assertRevert,
  assertErc20BalanceChanged,
  assertEthBalanceChanged
} = require('@galtproject/solidity-test-chest')(web3);

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

contract('PPMarket', accounts => {
  const [coreTeam, minter, alice, bob, charlie] = accounts;

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';
  const dataAddress = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3jq';

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

    const res = await this.ppTokenFactory.build('Foo', 'BAR', registryDataLink, ONE_HOUR, { value: 0 });
    this.ppToken = await PPToken.at(res.logs[5].args.token);
    this.ppController = await PPTokenController.at(res.logs[5].args.controller);

    this.ppMarket = await PPMarket.new(this.ppgr.address, this.galtToken.address, ethFee, galtFee);
    this.ppToken.setMinter(minter);

    await this.galtToken.mint(alice, ether(10000000));
    await this.galtToken.mint(bob, ether(10000000));
    await this.daiToken.mint(bob, ether(10000000));
  });

  beforeEach(async function() {
    let res = await this.ppToken.mint(alice, { from: minter });
    this.ppTokenId1 = res.logs[1].args.tokenId;
    res = await this.ppToken.mint(alice, { from: minter });
    this.ppTokenId2 = res.logs[1].args.tokenId;
  });

  describe('sale order submission', () => {
    describe('with ETH order currency', () => {
      it('should create a new sale order with ETH payment method', async function() {
        assert.equal(await this.ppToken.tokenDataLink(), registryDataLink);

        assert.equal(await this.ppMarket.owner(), coreTeam);
        let res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.ppMarket.saleOrders(this.rId);
        assert.equal(res.status, SaleOrderStatus.ACTIVE);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ETH);
        assert.equal(res.tokenContract, zeroAddress);
        assert.equal(res.seller, alice);

        res = await this.ppMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.ppTokenId1]);
        assert.equal(res.propertyToken, this.ppToken.address);
      });

      it('should create a new sale order with ERC20 payment method', async function() {
        let res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1, this.ppTokenId2],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ERC20,
          this.galtToken.address,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.ppMarket.saleOrders(this.rId);

        assert.equal(res.id, this.rId);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ERC20);
        assert.equal(res.tokenContract, this.galtToken.address);
        assert.equal(res.seller, alice);

        res = await this.ppMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.ppTokenId1, this.ppTokenId2]);
        assert.equal(res.propertyToken, this.ppToken.address);
      });

      it('should reject sale order if the token is not owned by an applicant', async function() {
        await assertRevert(
          this.ppMarket.createSaleOrder(
            this.ppToken.address,
            [this.ppTokenId1],
            bob,
            ether(50),
            dataAddress,
            EscrowCurrency.ETH,
            zeroAddress,
            { from: bob, value: ether(5) }
          ),
          'Sender should own the token'
        );
      });

      it('should reject sale order if the token contract is not registered in the PPGR', async function() {
        await assertRevert(
          this.ppMarket.createSaleOrder(
            this.unregisteredPPToken.address,
            [this.ppTokenId1],
            bob,
            ether(50),
            dataAddress,
            EscrowCurrency.ETH,
            zeroAddress,
            { from: bob, value: ether(5) }
          ),
          'Token address is invalid'
        );
      });

      it('should not reject sale orders if the token is already on sale', async function() {
        await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );

        await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
      });
    });

    describe('with GALT order currency', () => {
      it('should create a new sale order with ETH payment method', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(10), { from: alice });
        let res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.ppMarket.saleOrders(this.rId);
        assert.equal(res.id, this.rId);
        assert.equal(res.status, SaleOrderStatus.ACTIVE);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ETH);
        assert.equal(res.tokenContract, zeroAddress);
        assert.equal(res.seller, alice);

        res = await this.ppMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.ppTokenId1]);
      });

      it('should create a new sale order with ERC20 payment method', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(10), { from: alice });
        let res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ERC20,
          this.galtToken.address,
          { from: alice }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.ppMarket.saleOrders(this.rId);
        assert.equal(res.id, this.rId);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ERC20);
        assert.equal(res.tokenContract, this.galtToken.address);
        assert.equal(res.seller, alice);

        res = await this.ppMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.ppTokenId1]);
      });

      it('should reject sale order if the token is not owned by an applicant', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(10), { from: alice });
        await assertRevert(
          this.ppMarket.createSaleOrder(
            this.ppToken.address,
            [this.ppTokenId1],
            bob,
            ether(50),
            dataAddress,
            EscrowCurrency.ETH,
            zeroAddress,
            { from: bob }
          )
        );
      });
    });
  });

  describe('sale order matching', () => {
    describe('#createSaleOffer()', () => {
      beforeEach(async function() {
        const res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;
      });

      it('should create a new offer', async function() {
        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob });

        const res = await this.ppMarket.saleOffers(this.rId, bob);
        assert.equal(res.status, SaleOfferStatus.ACTIVE);
        assert.equal(res.bid, ether(30));
        assert.equal(res.lastAskAt, 0);
        assert(res.lastBidAt > 0);
        assert(res.createdAt > 0);
      });

      it('should increment offerCount', async function() {
        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: charlie });
      });

      it('should reject offers from seller', async function() {
        await assertRevert(this.ppMarket.createSaleOffer(this.rId, ether(30), { from: alice }));
      });

      it('should reject if order state is not ACTIVE', async function() {
        await this.ppMarket.closeSaleOrder(this.rId, { from: alice });
        await assertRevert(this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob }));
      });

      it('should reject second offer from the same buyer', async function() {
        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await assertRevert(this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob }));
      });
    });

    describe('#changeOfferBid/Ask()', () => {
      beforeEach(async function() {
        const res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          charlie,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob });
      });

      it('should allow bid/ask combinations', async function() {
        let res = await this.ppMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(50));
        assert.equal(res.bid, ether(30));

        await this.ppMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: charlie });

        res = await this.ppMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(45));
        assert.equal(res.bid, ether(30));

        await this.ppMarket.changeSaleOfferBid(this.rId, ether(35), { from: bob });

        res = await this.ppMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(45));
        assert.equal(res.bid, ether(35));
      });

      it('should deny another person changing ask price', async function() {
        await assertRevert(this.ppMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: bob }));
      });

      it.skip('should deny changing bid price for non-operator, even if it is a token owner', async function() {
        await assertRevert(this.ppMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: alice }));
      });

      it('should deny changing bid price for non existing offers', async function() {
        await assertRevert(this.ppMarket.changeSaleOfferAsk(this.rId, charlie, ether(45), { from: alice }));
      });
    });

    describe('#cancelSaleOrder()', () => {
      it('should allow seller closing the order', async function() {
        let res = await this.ppMarket.createSaleOrder(
          this.ppToken.address,
          [this.ppTokenId1],
          charlie,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.ppMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.ppMarket.changeSaleOfferAsk(this.rId, bob, ether(35), { from: charlie });
        await this.ppMarket.changeSaleOfferBid(this.rId, ether(35), { from: bob });
        await this.ppMarket.closeSaleOrder(this.rId, { from: alice });

        res = await this.ppMarket.saleOffers(this.rId, bob);
        assert.equal(res.status, SaleOfferStatus.ACTIVE);

        res = await this.ppMarket.saleOrders(this.rId);
        assert.equal(res.status, SaleOrderStatus.INACTIVE);
      });
    });
  });

  describe('protocol fee', () => {
    async function submit(ppMarket, tokenAddress, tokenIds, docs, value = 0) {
      await ppMarket.createSaleOrder(
        tokenAddress,
        tokenIds,
        bob,
        ether(50),
        dataAddress,
        EscrowCurrency.ETH,
        zeroAddress,
        {
          from: alice,
          value
        }
      );
    }

    beforeEach(async function() {
      this.ppMarket = await PPMarket.new(this.ppgr.address, this.galtToken.address, ethFee, galtFee);
      this.args = [this.ppMarket, this.ppToken.address, [this.ppTokenId1], dataAddress];
    });

    describe('payments', async function() {
      describe('without property owner fee', () => {
        it('should accept GALT payments with a registered value', async function() {
          await this.galtToken.approve(this.ppMarket.address, ether(10), { from: alice });
          await submit(...this.args, 0);
        });

        it('should accept ETH payments with a registered value', async function() {
          await submit(...this.args, ether(5));
        });

        it('should deny GALT payments with an approved value higher than a registered', async function() {
          await this.galtToken.approve(this.ppMarket.address, ether(11), { from: alice });
          await submit(...this.args, 0);
          const res = await this.galtToken.balanceOf(this.ppMarket.address);
          assert.equal(res, ether(10));
        });

        it('should deny GALT payments with an approved value lower than a registered', async function() {
          await this.galtToken.approve(this.ppMarket.address, ether(9), { from: alice });
          await assertRevert(submit(...this.args, 0));
        });

        it('should deny ETH payments with a value higher than a registered one', async function() {
          await assertRevert(submit(...this.args, ether(6)));
        });

        it('should deny ETH payments with a value lower than a registered one', async function() {
          await assertRevert(submit(...this.args, ether(4)));
        });
      });
    });

    describe('with property owner fee set', () => {
      beforeEach(async function() {
        // marketGalt,marketEth,lockerGalt,lockerEth
        await this.ppController.setFee(await this.ppMarket.GALT_FEE_KEY(), ether(1));
        await this.ppController.setFee(await this.ppMarket.ETH_FEE_KEY(), ether(2));
      });

      it('should accept ETH payments with a registered value', async function() {
        const aliceBalanceBefore = await web3.eth.getBalance(alice);
        const marketBalanceBefore = await web3.eth.getBalance(this.ppMarket.address);
        const tokenBalanceBefore = await web3.eth.getBalance(this.ppController.address);

        await submit(...this.args, ether(7));

        const aliceBalanceAfter = await web3.eth.getBalance(alice);
        const marketBalanceAfter = await web3.eth.getBalance(this.ppMarket.address);
        const tokenBalanceAfter = await web3.eth.getBalance(this.ppController.address);

        assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(-7));
        assertEthBalanceChanged(marketBalanceBefore, marketBalanceAfter, ether(5));
        assertEthBalanceChanged(tokenBalanceBefore, tokenBalanceAfter, ether(2));
      });

      it('should accept GALT payments with a registered value', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(11), { from: alice });
        await submit(...this.args, 0);
      });

      it('should allow GALT approvasl for payments with an approved value higher than a registered', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(12), { from: alice });

        const aliceBalanceBefore = await this.galtToken.balanceOf(alice);
        const marketBalanceBefore = await this.galtToken.balanceOf(this.ppMarket.address);
        const tokenBalanceBefore = await this.galtToken.balanceOf(this.ppController.address);

        await submit(...this.args, 0);

        const aliceBalanceAfter = await this.galtToken.balanceOf(alice);
        const marketBalanceAfter = await this.galtToken.balanceOf(this.ppMarket.address);
        const tokenBalanceAfter = await this.galtToken.balanceOf(this.ppController.address);

        const res = await this.galtToken.balanceOf(this.ppMarket.address);
        assert.equal(res, ether(10));

        assertErc20BalanceChanged(aliceBalanceBefore, aliceBalanceAfter, ether(-11));
        assertErc20BalanceChanged(marketBalanceBefore, marketBalanceAfter, ether(10));
        assertErc20BalanceChanged(tokenBalanceBefore, tokenBalanceAfter, ether(1));
      });

      it('should deny GALT payments with an approved value lower than a registered', async function() {
        await this.galtToken.approve(this.ppMarket.address, ether(10.5), { from: alice });
        await assertRevert(submit(...this.args, 0));
      });

      it('should deny ETH payments with a value higher than a registered one', async function() {
        await assertRevert(submit(...this.args, ether(8)));
      });

      it('should deny ETH payments with a value lower than a registered one', async function() {
        await assertRevert(submit(...this.args, ether(6)));
      });
    });
  });
});
