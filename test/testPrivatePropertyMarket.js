const PrivatePropertyMarket = artifacts.require('./PrivatePropertyMarket.sol');
const PrivatePropertyToken = artifacts.require('./PrivatePropertyToken.sol');
const PrivatePropertyFactory = artifacts.require('./PrivatePropertyFactory.sol');
const PrivatePropertyGlobalRegistry = artifacts.require('./PrivatePropertyGlobalRegistry.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

PrivatePropertyToken.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';
PrivatePropertyMarket.numberFormat = 'String';

const { web3 } = PrivatePropertyMarket;

const { zeroAddress, ether, assertRevert } = require('@galtproject/solidity-test-chest')(web3);

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

contract('PrivatePropertyMarket', accounts => {
  const [coreTeam, minter, alice, bob, charlie] = accounts;

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';
  const dataAddress = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3jq';

  // both for a factory and a market
  const ethFee = ether(5);
  const galtFee = ether(10);

  before(async function() {
    this.galtToken = await MintableErc20Token.new();
    this.daiToken = await MintableErc20Token.new();
    this.unregisteredPrivatePropertyToken = await PrivatePropertyToken.new('Foo', 'BAR');

    this.ppgr = await PrivatePropertyGlobalRegistry.new();
    this.privatePropertyFactory = await PrivatePropertyFactory.new(
      this.ppgr.address,
      this.galtToken.address,
      ethFee,
      galtFee
    );
    await this.ppgr.setFactory(this.privatePropertyFactory.address);

    const res = await this.privatePropertyFactory.build('Foo', 'BAR', registryDataLink, { value: ether(5) });
    this.privatePropertyToken = await PrivatePropertyToken.at(res.logs[4].args.token);

    this.privatePropertyMarket = await PrivatePropertyMarket.new(
      this.ppgr.address,
      this.galtToken.address,
      ethFee,
      galtFee
    );
    this.privatePropertyToken.setMinter(minter);

    await this.galtToken.mint(alice, ether(10000000));
    await this.galtToken.mint(bob, ether(10000000));
    await this.daiToken.mint(bob, ether(10000000));
  });

  beforeEach(async function() {
    let res = await this.privatePropertyToken.mint(alice, { from: minter });
    this.privatePropertyTokenId1 = res.logs[1].args.tokenId;
    res = await this.privatePropertyToken.mint(alice, { from: minter });
    this.privatePropertyTokenId2 = res.logs[1].args.tokenId;
  });

  describe('sale order submission', () => {
    describe('with ETH order currency', () => {
      it('should create a new sale order with ETH payment method', async function() {
        assert.equal(await this.privatePropertyToken.tokenDataLink(), registryDataLink);

        assert.equal(await this.privatePropertyMarket.owner(), coreTeam);
        let res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.privatePropertyMarket.saleOrders(this.rId);
        assert.equal(res.status, SaleOrderStatus.ACTIVE);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ETH);
        assert.equal(res.tokenContract, zeroAddress);
        assert.equal(res.seller, alice);

        res = await this.privatePropertyMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.privatePropertyTokenId1]);
        assert.equal(res.propertyToken, this.privatePropertyToken.address);
      });

      it('should create a new sale order with ERC20 payment method', async function() {
        let res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1, this.privatePropertyTokenId2],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ERC20,
          this.galtToken.address,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.privatePropertyMarket.saleOrders(this.rId);

        assert.equal(res.id, this.rId);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ERC20);
        assert.equal(res.tokenContract, this.galtToken.address);
        assert.equal(res.seller, alice);

        res = await this.privatePropertyMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.privatePropertyTokenId1, this.privatePropertyTokenId2]);
        assert.equal(res.propertyToken, this.privatePropertyToken.address);
      });

      it('should reject sale order if the token is not owned by an applicant', async function() {
        await assertRevert(
          this.privatePropertyMarket.createSaleOrder(
            this.privatePropertyToken.address,
            [this.privatePropertyTokenId1],
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
          this.privatePropertyMarket.createSaleOrder(
            this.unregisteredPrivatePropertyToken.address,
            [this.privatePropertyTokenId1],
            bob,
            ether(50),
            dataAddress,
            EscrowCurrency.ETH,
            zeroAddress,
            { from: bob, value: ether(5) }
          ),
          "Token doesn't registered in PPGR"
        );
      });

      it('should not reject sale orders if the token is already on sale', async function() {
        await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );

        await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
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
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(10), { from: alice });
        let res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.privatePropertyMarket.saleOrders(this.rId);
        assert.equal(res.id, this.rId);
        assert.equal(res.status, SaleOrderStatus.ACTIVE);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ETH);
        assert.equal(res.tokenContract, zeroAddress);
        assert.equal(res.seller, alice);

        res = await this.privatePropertyMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.privatePropertyTokenId1]);
      });

      it('should create a new sale order with ERC20 payment method', async function() {
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(10), { from: alice });
        let res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          bob,
          ether(50),
          dataAddress,
          EscrowCurrency.ERC20,
          this.galtToken.address,
          { from: alice }
        );
        this.rId = res.logs[0].args.orderId;

        res = await this.privatePropertyMarket.saleOrders(this.rId);
        assert.equal(res.id, this.rId);
        assert.equal(res.ask, ether(50));
        assert.equal(res.escrowCurrency, EscrowCurrency.ERC20);
        assert.equal(res.tokenContract, this.galtToken.address);
        assert.equal(res.seller, alice);

        res = await this.privatePropertyMarket.getSaleOrderDetails(this.rId);
        assert.sameMembers(res.propertyTokenIds, [this.privatePropertyTokenId1]);
      });

      it('should reject sale order if the token is not owned by an applicant', async function() {
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(10), { from: alice });
        await assertRevert(
          this.privatePropertyMarket.createSaleOrder(
            this.privatePropertyToken.address,
            [this.privatePropertyTokenId1],
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
        const res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
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
        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob });

        const res = await this.privatePropertyMarket.saleOffers(this.rId, bob);
        assert.equal(res.status, SaleOfferStatus.ACTIVE);
        assert.equal(res.bid, ether(30));
        assert.equal(res.lastAskAt, 0);
        assert(res.lastBidAt > 0);
        assert(res.createdAt > 0);
      });

      it('should increment offerCount', async function() {
        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: charlie });
      });

      it('should reject offers from seller', async function() {
        await assertRevert(this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: alice }));
      });

      it('should reject if order state is not ACTIVE', async function() {
        await this.privatePropertyMarket.closeSaleOrder(this.rId, { from: alice });
        await assertRevert(this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob }));
      });

      it('should reject second offer from the same buyer', async function() {
        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await assertRevert(this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob }));
      });
    });

    describe('#changeOfferBid/Ask()', () => {
      beforeEach(async function() {
        const res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          charlie,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob });
      });

      it('should allow bid/ask combinations', async function() {
        let res = await this.privatePropertyMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(50));
        assert.equal(res.bid, ether(30));

        await this.privatePropertyMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: charlie });

        res = await this.privatePropertyMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(45));
        assert.equal(res.bid, ether(30));

        await this.privatePropertyMarket.changeSaleOfferBid(this.rId, ether(35), { from: bob });

        res = await this.privatePropertyMarket.saleOffers(this.rId, bob);
        assert.equal(res.ask, ether(45));
        assert.equal(res.bid, ether(35));
      });

      it('should deny another person changing ask price', async function() {
        await assertRevert(this.privatePropertyMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: bob }));
      });

      it.skip('should deny changing bid price for non-operator, even if it is a token owner', async function() {
        await assertRevert(this.privatePropertyMarket.changeSaleOfferAsk(this.rId, bob, ether(45), { from: alice }));
      });

      it('should deny changing bid price for non existing offers', async function() {
        await assertRevert(
          this.privatePropertyMarket.changeSaleOfferAsk(this.rId, charlie, ether(45), { from: alice })
        );
      });
    });

    describe('#cancelSaleOrder()', () => {
      it('should allow seller closing the order', async function() {
        let res = await this.privatePropertyMarket.createSaleOrder(
          this.privatePropertyToken.address,
          [this.privatePropertyTokenId1],
          charlie,
          ether(50),
          dataAddress,
          EscrowCurrency.ETH,
          zeroAddress,
          { from: alice, value: ether(5) }
        );
        this.rId = res.logs[0].args.orderId;

        await this.privatePropertyMarket.createSaleOffer(this.rId, ether(30), { from: bob });
        await this.privatePropertyMarket.changeSaleOfferAsk(this.rId, bob, ether(35), { from: charlie });
        await this.privatePropertyMarket.changeSaleOfferBid(this.rId, ether(35), { from: bob });
        await this.privatePropertyMarket.closeSaleOrder(this.rId, { from: alice });

        res = await this.privatePropertyMarket.saleOffers(this.rId, bob);
        assert.equal(res.status, SaleOfferStatus.ACTIVE);

        res = await this.privatePropertyMarket.saleOrders(this.rId);
        assert.equal(res.status, SaleOrderStatus.INACTIVE);
      });
    });
  });

  describe('protocol fee', () => {
    async function submit(privatePropertyMarket, tokenAddress, tokenIds, docs, value = 0) {
      await privatePropertyMarket.createSaleOrder(
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
      this.privatePropertyMarket = await PrivatePropertyMarket.new(
        this.ppgr.address,
        this.galtToken.address,
        ethFee,
        galtFee
      );
      this.args = [
        this.privatePropertyMarket,
        this.privatePropertyToken.address,
        [this.privatePropertyTokenId1],
        dataAddress
      ];
    });

    describe('payments', async function() {
      it('should accept GALT payments with a registered value', async function() {
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(10), { from: alice });
        await submit(...this.args, 0);
      });

      it('should accept ETH payments with a registered value', async function() {
        await submit(...this.args, ether(5));
      });

      it('should deny GALT payments with an approved value higher than a registered', async function() {
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(11), { from: alice });
        await submit(...this.args, 0);
        const res = await this.galtToken.balanceOf(this.privatePropertyMarket.address);
        assert.equal(res, ether(10));
      });

      it('should deny GALT payments with an approved value lower than a registered', async function() {
        await this.galtToken.approve(this.privatePropertyMarket.address, ether(9), { from: alice });
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
});
