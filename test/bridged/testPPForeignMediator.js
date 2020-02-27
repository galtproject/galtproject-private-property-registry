const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const OwnedUpgradeabilityProxyFactory = contract.fromArtifact('OwnedUpgradeabilityProxyFactory');
const AMBMock = contract.fromArtifact('AMBMock');
const PPMediatorFactory = contract.fromArtifact('PPMediatorFactory');
const PPHomeMediator = contract.fromArtifact('PPHomeMediator');
const PPForeignMediator = contract.fromArtifact('PPForeignMediator');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPToken = contract.fromArtifact('PPToken');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPACL = contract.fromArtifact('PPACL');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const galt = require('@galtproject/utils');

PPForeignMediator.numberFormat = 'String';
PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { ether, gwei, assertRevert, getEventArg } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe.only('PPForeignMediator', () => {
  const [alice, bob, minter, geoDataManager, mediatorContractOnOtherSide, anywhere] = accounts;
  const owner = defaultSender;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01';
  const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb';
  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  let res;
  let token1;
  let tokenX;
  let controllerX;
  let foreignMediator;
  let bridge;

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(owner, galtFee);
    await this.galtToken.mint(alice, galtFee);

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

    await this.ppTokenFactory.setFeeManager(owner);
    await this.ppTokenFactory.setFeeCollector(owner);
    await this.ppTokenFactory.setEthFee(ethFee);
    await this.ppTokenFactory.setGaltFee(galtFee);

    this.ownedUpgradeabilityProxyFactory = await OwnedUpgradeabilityProxyFactory.new();
    const proxyFactory = this.ownedUpgradeabilityProxyFactory.address;

    this.homeMediator = await PPHomeMediator.new(anywhere);
    this.foreignMediator = await PPForeignMediator.new(anywhere);

    this.homeMediatorFactory = await PPMediatorFactory.new(proxyFactory, this.homeMediator.address);
    this.foreignMediatorFactory = await PPMediatorFactory.new(proxyFactory, this.foreignMediator.address);
    bridge = await AMBMock.new();
    // 2M
    await bridge.setMaxGasPerTx(2000000);
    res = await this.ppTokenFactory.build('Buildings', 'BDL', registryDataLink, ONE_HOUR, [], [], utf8ToHex(''), {
      from: alice,
      value: ethFee,
      gasPrice: gwei(0.1)
    });
    tokenX = await PPToken.at(getEventArg(res, 'Build', 'token'));
    controllerX = await PPTokenController.at(getEventArg(res, 'Build', 'controller'));

    await controllerX.setMinter(minter, { from: alice });
    await controllerX.setGeoDataManager(geoDataManager, { from: alice });

    const txData = this.foreignMediator.contract.methods
      .initialize(bridge.address, mediatorContractOnOtherSide, tokenX.address, 2000000, alice)
      .encodeABI();
    res = await this.foreignMediatorFactory.build(txData);
    foreignMediator = await PPForeignMediator.at(getEventArg(res, 'Build', 'mediatorAddress'));

    res = await controllerX.mint(bob, { from: minter });
    token1 = getEventArg(res, 'Mint', 'tokenId');

    await controllerX.setInitialDetails(
      token1,
      // tokenType
      2,
      1,
      123,
      utf8ToHex('foo'),
      'bar',
      'buzz',
      { from: minter }
    );

    // setInitialContour
    await controllerX.setInitialContour(
      token1,
      contour,
      // highestPoint
      -42,
      { from: minter }
    );
  });

  it('#transferToken()', async function() {
    await tokenX.approve(foreignMediator.address, token1, { from: bob });
    await foreignMediator.transferToken(bob, token1, { from: bob });
  });

  it('#handleBridgedTokens()', async function() {
    // deposit token
    await tokenX.approve(foreignMediator.address, token1, { from: bob });
    await tokenX.transferFrom(bob, foreignMediator.address, token1, { from: bob });

    // must be called from bridge
    await assertRevert(foreignMediator.handleBridgedTokens(bob, token1, nonce, { from: bob }));
    await assertRevert(foreignMediator.handleBridgedTokens(bob, token1, nonce, { from: owner }));

    const data = await foreignMediator.contract.methods.handleBridgedTokens(bob, token1, nonce).encodeABI();

    const failedTxHash = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e';

    // message must be generated by mediator contract on the other network
    await bridge.executeMessageCall(foreignMediator.address, owner, data, failedTxHash, 1000000);

    assert.equal(await bridge.messageCallStatus(failedTxHash), false);
    // Invalid contract on other side
    const res2 = await bridge.failedReason(failedTxHash);
    assert.equal(decodeErrorReason(res2), 'Invalid contract on other side');
    assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);

    await bridge.executeMessageCall(foreignMediator.address, mediatorContractOnOtherSide, data, exampleTxHash, 2000000);

    assert.equal(await bridge.messageCallStatus(exampleTxHash), true);
    assert.equal(await tokenX.ownerOf(token1), bob);
  });

  function decodeErrorReason(bytesInput) {
    return web3.eth.abi.decodeParameter('string', bytesInput.slice(0, 2) + bytesInput.slice(10));
  }

  it.skip('#fixFailedMessage()', async function() {
    await tokenX.approve(foreignMediator.address, token1, { from: bob });
    const { tx } = await foreignMediator.transferToken(bob, token1, { from: bob });
    assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);

    const receipt = await web3.eth.getTransactionReceipt(tx);
    const logs = AMBMock.decodeLogs(receipt.logs);
    const data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`;

    await bridge.executeMessageCall(foreignMediator.address, mediatorContractOnOtherSide, data, exampleTxHash, 2000000);

    assert.equal(await bridge.messageCallStatus(tx), false);
  });
});
