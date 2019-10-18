const PrivatePropertyFactory = artifacts.require('PrivatePropertyFactory.sol');
const PrivatePropertyGlobalRegistry = artifacts.require('PrivatePropertyGlobalRegistry.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

const { BN } = web3.utils;

const { ether, assertRevert, assertEthBalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

contract('PrivatePropertyFactory', accounts => {
  const [owner, alice, anyone] = accounts;

  const ethFee = ether(10);
  const galtFee = ether(20);

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

    this.propertyRegistry = await PrivatePropertyGlobalRegistry.new();
    this.propertyFactory = await PrivatePropertyFactory.new(
      this.propertyRegistry.address,
      this.galtToken.address,
      0,
      0
    );
    await this.propertyRegistry.setFactory(this.propertyFactory.address);

    await this.propertyFactory.setEthFee(ethFee);
    await this.propertyFactory.setGaltFee(galtFee);
  });

  it('should correctly accept GALT fee', async function() {
    assert.equal(await this.galtToken.balanceOf(this.propertyFactory.address), 0);

    await this.galtToken.approve(this.propertyFactory.address, galtFee, { from: alice });
    await this.propertyFactory.build('Buildings', 'BDL', { from: alice });

    assert.equal(await this.galtToken.balanceOf(this.propertyFactory.address), galtFee);

    await this.propertyFactory.withdrawErc20(this.galtToken.address, anyone);
    await assertRevert(this.propertyFactory.withdrawErc20(this.galtToken.address, anyone, { from: alice }));

    assert.equal(await this.galtToken.balanceOf(this.propertyFactory.address), 0);

    assert.equal(await this.galtToken.balanceOf(anyone), galtFee);
  });

  it('should correctly accept ETH fee', async function() {
    const aliceBalanceBefore = await web3.eth.getBalance(alice);
    let factoryBalanceBefore = await web3.eth.getBalance(this.propertyFactory.address);

    await this.propertyFactory.build('Buildings', 'BDL', { from: alice, value: ethFee });

    const aliceBalanceAfter = await web3.eth.getBalance(alice);
    let factoryBalanceAfter = await web3.eth.getBalance(this.propertyFactory.address);

    assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, `-${ethFee}`, new BN('50000000000000000'));
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, ethFee);

    const anyoneBalanceBefore = await web3.eth.getBalance(anyone);
    factoryBalanceBefore = await web3.eth.getBalance(this.propertyFactory.address);

    await this.propertyFactory.withdrawEth(anyone);
    await assertRevert(this.propertyFactory.withdrawEth(anyone, { from: alice }));

    const anyoneBalanceAfter = await web3.eth.getBalance(anyone);
    factoryBalanceAfter = await web3.eth.getBalance(this.propertyFactory.address);

    assertEthBalanceChanged(anyoneBalanceBefore, anyoneBalanceAfter, ethFee);
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, `-${ethFee}`);
  });
});
