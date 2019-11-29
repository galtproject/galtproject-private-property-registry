const PPTokenFactory = artifacts.require('PPTokenFactory.sol');
const PPGlobalRegistry = artifacts.require('PPGlobalRegistry.sol');
const PPTokenRegistry = artifacts.require('PPTokenRegistry.sol');
const PPACL = artifacts.require('PPACL.sol');
const MintableErc20Token = artifacts.require('openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable.sol');

const { ether, gwei, assertRevert, assertEthBalanceChanged } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

contract('PPTokenFactory', accounts => {
  const [owner, alice, anywhere] = accounts;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

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

    await this.ppTokenFactory.setFeeManager(owner);
    await this.ppTokenFactory.setFeeCollector(owner);
    await this.ppTokenFactory.setEthFee(ethFee);
    await this.ppTokenFactory.setGaltFee(galtFee);
  });

  it('should correctly accept GALT fee', async function() {
    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    await this.galtToken.approve(this.ppTokenFactory.address, galtFee, { from: alice });
    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, { from: alice });

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), galtFee);

    await this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere);
    await assertRevert(this.ppTokenFactory.withdrawErc20(this.galtToken.address, anywhere, { from: alice }));

    assert.equal(await this.galtToken.balanceOf(this.ppTokenFactory.address), 0);

    assert.equal(await this.galtToken.balanceOf(anywhere), galtFee);
  });

  it('should correctly accept ETH fee', async function() {
    const aliceBalanceBefore = await web3.eth.getBalance(alice);
    let factoryBalanceBefore = await web3.eth.getBalance(this.ppTokenFactory.address);

    await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, {
      from: alice,
      value: ethFee,
      gasPrice: gwei(0.1)
    });

    const aliceBalanceAfter = await web3.eth.getBalance(alice);
    let factoryBalanceAfter = await web3.eth.getBalance(this.ppTokenFactory.address);

    assertEthBalanceChanged(aliceBalanceBefore, aliceBalanceAfter, `-${ethFee}`);
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, ethFee);

    const anyoneBalanceBefore = await web3.eth.getBalance(anywhere);
    factoryBalanceBefore = await web3.eth.getBalance(this.ppTokenFactory.address);

    await this.ppTokenFactory.withdrawEth(anywhere);
    await assertRevert(this.ppTokenFactory.withdrawEth(anywhere, { from: alice }));

    const anyoneBalanceAfter = await web3.eth.getBalance(anywhere);
    factoryBalanceAfter = await web3.eth.getBalance(this.ppTokenFactory.address);

    assertEthBalanceChanged(anyoneBalanceBefore, anyoneBalanceAfter, ethFee);
    assertEthBalanceChanged(factoryBalanceBefore, factoryBalanceAfter, `-${ethFee}`);
  });
});
