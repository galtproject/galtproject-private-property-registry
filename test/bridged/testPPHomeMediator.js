const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const OwnedUpgradeabilityProxyFactory = contract.fromArtifact('OwnedUpgradeabilityProxyFactory');
const AMBMock = contract.fromArtifact('AMBMock');
const PPBridgedTokenFactory = contract.fromArtifact('PPBridgedTokenFactory');
const PPBridgedLockerFactory = contract.fromArtifact('PPBridgedLockerFactory');
const HackVotingMock = contract.fromArtifact('HackVotingMock');
const PPBridgedToken = contract.fromArtifact('PPBridgedToken');
const PPBridgedLocker = contract.fromArtifact('PPBridgedLocker');
const PPMediatorFactory = contract.fromArtifact('PPMediatorFactory');
const PPHomeMediator = contract.fromArtifact('PPHomeMediator');
const PPForeignMediator = contract.fromArtifact('PPForeignMediator');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPToken = contract.fromArtifact('PPToken');
const PPTokenController = contract.fromArtifact('PPTokenController');
const PPACL = contract.fromArtifact('PPACL');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const galt = require('@galtproject/utils');

PPForeignMediator.numberFormat = 'String';
PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';

const { ether, gwei, assertRevert, getEventArg } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex, hexToUtf8 } = web3.utils;
const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe('Mediators', () => {
  const [alice, bob, charlie, minter, geoDataManager, anywhere] = accounts;
  const owner = defaultSender;

  const ethFee = ether(10);
  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv', 'zxcvzxcvzxcc'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  const nonce = '0x96b6af865cdaa107ede916e237afbedffa5ed36bea84c0e77a33cc28fc2e9c01';
  const exampleTxHash = '0xf308b922ab9f8a7128d9d7bc9bce22cd88b2c05c8213f0e2d8104d78e0a9ecbb';
  const registryDataLink = 'bafyreihtjrn4lggo3qjvaamqihvgas57iwsozhpdr2al2uucrt3qoed3j1';

  let res;
  let bridgedData;
  let token1;
  let tokenX;
  let controllerX;
  let bridgedTokenX;
  let foreignMediator;
  let homeMediator;
  // the same for both foreign and home (only for test cases)
  let bridge;

  beforeEach(async function() {
    this.ownedUpgradeabilityProxyFactory = await OwnedUpgradeabilityProxyFactory.new();
    const proxyFactoryAddress = this.ownedUpgradeabilityProxyFactory.address;
    bridge = await AMBMock.new();

    // foreign chain core contracts
    await (async () => {
      this.galtToken = await MintableErc20Token.new();
      await this.galtToken.mint(owner, galtFee);
      await this.galtToken.mint(alice, galtFee);

      this.ppgr = await PPGlobalRegistry.new();
      this.acl = await PPACL.new();
      this.ppTokenRegistry = await PPTokenRegistry.new();

      await this.ppgr.initialize();
      await this.ppTokenRegistry.initialize(this.ppgr.address);

      // token factories
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

      const foreignMediatorImplementation = await PPForeignMediator.new(anywhere);
      this.foreignMediatorFactory = await PPMediatorFactory.new(
        proxyFactoryAddress,
        foreignMediatorImplementation.address,
        bridge.address,
        2000000,
        42
      );
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

      // Create a foreign mediator
      res = await this.foreignMediatorFactory.build(alice, tokenX.address, anywhere);
      foreignMediator = await PPForeignMediator.at(getEventArg(res, 'NewPPMediator', 'mediator'));
      assert.equal(await foreignMediator.oppositeChainId(), 42);
    })();

    // home chain core contracts
    await (async () => {
      this.bridgedPPGR = await PPGlobalRegistry.new();
      this.bridgedACL = await PPACL.new();
      this.ppBridgedTokenRegistry = await PPTokenRegistry.new();
      this.ppBridgedLockerRegistry = await PPLockerRegistry.new();
      this.ppBridgedLockerFactory = await PPBridgedLockerFactory.new(this.bridgedPPGR.address, 1, 1);

      await this.bridgedPPGR.initialize();
      await this.ppBridgedTokenRegistry.initialize(this.bridgedPPGR.address);
      await this.ppBridgedLockerRegistry.initialize(this.bridgedPPGR.address);

      const homeMediatorImplementation = await PPHomeMediator.new(anywhere);
      this.homeMediatorFactory = await PPMediatorFactory.new(
        proxyFactoryAddress,
        homeMediatorImplementation.address,
        bridge.address,
        2000000,
        5
      );
      this.ppBridgedTokenFactory = await PPBridgedTokenFactory.new(
        this.bridgedPPGR.address,
        this.homeMediatorFactory.address,
        ether(10),
        ether(5)
      );

      // PPGR setup
      await this.bridgedPPGR.setContract(await this.bridgedPPGR.PPGR_ACL(), this.bridgedACL.address);
      await this.bridgedPPGR.setContract(
        await this.bridgedPPGR.PPGR_TOKEN_REGISTRY(),
        this.ppBridgedTokenRegistry.address
      );
      await this.bridgedPPGR.setContract(
        await this.bridgedPPGR.PPGR_LOCKER_REGISTRY(),
        this.ppBridgedLockerRegistry.address
      );

      // ACL setup
      await this.bridgedACL.setRole(bytes32('TOKEN_REGISTRAR'), this.ppBridgedTokenFactory.address, true);
      await this.bridgedACL.setRole(bytes32('LOCKER_REGISTRAR'), this.ppBridgedLockerFactory.address, true);

      res = await this.ppBridgedTokenFactory.build(
        'Bridged Building',
        'BBDL',
        registryDataLink,
        alice,
        foreignMediator.address,
        utf8ToHex(''),
        {
          from: bob,
          value: ether(10)
        }
      );
      bridgedTokenX = await PPBridgedToken.at(getEventArg(res, 'NewPPBridgedToken', 'token'));
      homeMediator = await PPHomeMediator.at(getEventArg(res, 'NewPPBridgedToken', 'mediator'));

      assert.equal(await homeMediator.oppositeChainId(), 5);
      assert.equal(await homeMediator.owner(), alice);
      assert.equal(await homeMediator.bridgeContract(), bridge.address);
      assert.equal(await homeMediator.erc721Token(), bridgedTokenX.address);
    })();

    await foreignMediator.setMediatorContractOnOtherSide(homeMediator.address, { from: alice });

    await controllerX.mint(charlie, { from: minter });
    await controllerX.mint(charlie, { from: minter });
    await controllerX.mint(charlie, { from: minter });
    res = await controllerX.mint(bob, { from: minter });
    token1 = getEventArg(res, 'Mint', 'tokenId');

    await controllerX.setInitialDetails(
      token1,
      // tokenType
      2,
      // areaSource
      1,
      // area
      123,
      // ledgerIdntifier
      utf8ToHex('foo'),
      // humanAddress
      'bar',
      // dataLink
      'buzz',
      false,
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

  describe('ForeignMediator', () => {
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

      await bridge.executeMessageCall(foreignMediator.address, homeMediator.address, data, exampleTxHash, 2000000);

      assert.equal(await bridge.messageCallStatus(exampleTxHash), true);
      assert.equal(await tokenX.ownerOf(token1), bob);
    });

    function decodeErrorReason(bytesInput) {
      return web3.eth.abi.decodeParameter('string', bytesInput.slice(0, 2) + bytesInput.slice(10));
    }

    describe('#fixFailedMewsage() foreign -> home transfer', () => {
      let dataHash;
      let data;

      beforeEach(async function() {
        await tokenX.approve(foreignMediator.address, token1, { from: bob });
        const { tx } = await foreignMediator.transferToken(bob, token1, { from: bob });
        assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);

        const receipt = await web3.eth.getTransactionReceipt(tx);
        const logs = AMBMock.decodeLogs(receipt.logs);
        data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`;

        // Apply transfer on home chain, it should fail
        await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, data, tx, 200);

        assert.equal(await bridge.messageCallStatus(tx), false);
        assert.equal(await bridge.failedReason(tx), null);

        dataHash = await bridge.failedMessageDataHash(tx);
      });

      it('should allow fixing locked tokens on foreign chain', async function() {
        assert.equal(await foreignMediator.messageHashFixed(dataHash), false);

        const fixData = await foreignMediator.contract.methods.fixFailedMessage(dataHash).encodeABI();

        // should be called only by bridge
        await assertRevert(foreignMediator.fixFailedMessage(dataHash, { from: owner }), 'Only bridge allowed');

        // sender should be the home mediator
        await bridge.executeMessageCall(foreignMediator.address, anywhere, fixData, exampleTxHash, 1000000);
        assert.equal(await bridge.messageCallStatus(exampleTxHash), false);
        assert.equal(await foreignMediator.messageHashFixed(dataHash), false);
        const res2 = await bridge.failedReason(exampleTxHash);
        assert.equal(decodeErrorReason(res2), 'Invalid contract on other side');

        // correct behaviour...
        await bridge.executeMessageCall(foreignMediator.address, homeMediator.address, fixData, exampleTxHash, 1000000);

        assert.equal(await bridge.messageCallStatus(exampleTxHash), true);
        assert.equal(await foreignMediator.messageHashFixed(dataHash), true);
        assert.equal(await bridge.failedReason(exampleTxHash), null);
        assert.equal(await tokenX.ownerOf(token1), bob);

        // Re send token to know that dataHash is different even if same tokenId and metadata is used
        await tokenX.approve(foreignMediator.address, token1, { from: bob });
        const { tx } = await foreignMediator.transferToken(bob, token1, { from: bob });
        assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);

        const receipt = await web3.eth.getTransactionReceipt(tx);
        const logs = AMBMock.decodeLogs(receipt.logs);
        data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`;

        // Apply transfer on home chain, it should fail
        await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, data, tx, 200);

        assert.equal(await bridge.messageCallStatus(tx), false);
        assert.equal(await bridge.failedReason(tx), null);

        const dataHash2 = await bridge.failedMessageDataHash(tx);
        assert.notEqual(dataHash, dataHash2);
      });
    });
  });

  describe('HomeMediator', () => {
    beforeEach(async function() {
      // Transfer token from foreign chain to home
      await tokenX.approve(foreignMediator.address, token1, { from: bob });
      const { tx } = await foreignMediator.transferToken(bob, token1, { from: bob });

      const receipt = await web3.eth.getTransactionReceipt(tx);
      const logs = AMBMock.decodeLogs(receipt.logs);
      bridgedData = `0x${logs[0].args.encodedData.slice(476)}`;
    });

    it('#handleBridgedTokens() should mint a new token', async function() {
      // must be called from bridge
      await assertRevert(homeMediator.handleBridgedTokens(bob, token1, bridgedData, nonce, { from: bob }));
      await assertRevert(homeMediator.handleBridgedTokens(bob, token1, bridgedData, nonce, { from: owner }));

      const data = await homeMediator.contract.methods.handleBridgedTokens(bob, token1, bridgedData, nonce).encodeABI();

      const failedTxHash = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e';

      // message must be generated by mediator contract on the other network
      await bridge.executeMessageCall(homeMediator.address, owner, data, failedTxHash, 2000000);

      assert.equal(await bridge.messageCallStatus(failedTxHash), false);
      // Invalid contract on other side
      res = await bridge.failedReason(failedTxHash);
      assert.equal(decodeErrorReason(res), 'Invalid contract on other side');
      assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);

      await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, data, exampleTxHash, 2000000);

      const reason = await bridge.failedReason(exampleTxHash);
      if (reason) {
        console.log('>>>', decodeErrorReason(await bridge.failedReason(exampleTxHash)));
      }
      assert.equal(await bridge.messageCallStatus(exampleTxHash), true);
      assert.equal(await tokenX.ownerOf(token1), foreignMediator.address);
      assert.equal(await bridgedTokenX.totalSupply(), 1);
      assert.equal(await bridgedTokenX.ownerOf(token1), bob);

      res = await bridgedTokenX.getDetails(token1);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      // Transferring the token to charlie
      await bridgedTokenX.transferFrom(bob, charlie, token1, { from: bob });

      // Transferring the token back to the foreign chain
      await bridgedTokenX.approve(homeMediator.address, token1, { from: charlie });
      await homeMediator.transferToken(charlie, token1, { from: charlie });

      assert.equal(await bridgedTokenX.totalSupply(), 0);
      await assertRevert(bridgedTokenX.ownerOf(token1), 'ERC721: owner query for nonexistent token');
    });

    function decodeErrorReason(bytesInput) {
      return web3.eth.abi.decodeParameter('string', bytesInput.slice(0, 2) + bytesInput.slice(10));
    }

    it('#fixFailedMessage() should allow fixing a transfer on home network', async function() {
      const prapreTxHash = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e';
      // transfer foreign -> home (preparation)
      let data = await homeMediator.contract.methods.handleBridgedTokens(bob, token1, bridgedData, nonce).encodeABI();
      // message must be generated by mediator contract on the other network
      await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, data, prapreTxHash, 2000000);

      assert.equal(await bridgedTokenX.ownerOf(token1), bob);

      // transfer home -> foreign back
      await bridgedTokenX.approve(homeMediator.address, token1, { from: bob });
      let { tx } = await homeMediator.transferToken(bob, token1, { from: bob });
      await assertRevert(bridgedTokenX.ownerOf(token1), 'ERC721: owner query for nonexistent token');

      let receipt = await web3.eth.getTransactionReceipt(tx);
      let logs = AMBMock.decodeLogs(receipt.logs);
      data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`;

      // Apply transfer on foreign chain, it should fail
      await bridge.executeMessageCall(foreignMediator.address, homeMediator.address, data, tx, 20);

      assert.equal(await bridge.messageCallStatus(tx), false);
      assert.equal(await bridge.failedReason(tx), null);

      const dataHash = await bridge.failedMessageDataHash(tx);

      assert.equal(await homeMediator.messageHashFixed(dataHash), false);

      const fixData = await homeMediator.contract.methods.fixFailedMessage(dataHash).encodeABI();

      // should be called only by bridge
      await assertRevert(homeMediator.fixFailedMessage(dataHash, { from: owner }), 'Only bridge allowed');

      // sender should be the home mediator
      await bridge.executeMessageCall(homeMediator.address, anywhere, fixData, exampleTxHash, 1000000);
      assert.equal(await bridge.messageCallStatus(exampleTxHash), false);
      assert.equal(await homeMediator.messageHashFixed(dataHash), false);
      const res2 = await bridge.failedReason(exampleTxHash);
      assert.equal(decodeErrorReason(res2), 'Invalid contract on other side');

      // correct behaviour...
      await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, fixData, exampleTxHash, 2000000);

      assert.equal(await bridge.failedReason(exampleTxHash), null);
      assert.equal(await homeMediator.messageHashFixed(dataHash), true);
      assert.equal(await bridge.messageCallStatus(exampleTxHash), true);
      assert.equal(await bridgedTokenX.ownerOf(token1), bob);

      res = await bridgedTokenX.getDetails(token1);
      assert.equal(res.tokenType, 2);
      assert.equal(res.areaSource, 1);
      assert.equal(res.area, 123);
      assert.equal(hexToUtf8(res.ledgerIdentifier), 'foo');
      assert.equal(res.humanAddress, 'bar');
      assert.equal(res.dataLink, 'buzz');

      // Re send token to know that dataHash is different even if same tokenId and metadata is used
      await bridgedTokenX.approve(homeMediator.address, token1, { from: bob });
      res = await homeMediator.transferToken(bob, token1, { from: bob });
      tx = res.tx;
      await assertRevert(bridgedTokenX.ownerOf(token1), 'ERC721: owner query for nonexistent token');

      receipt = await web3.eth.getTransactionReceipt(tx);
      logs = AMBMock.decodeLogs(receipt.logs);
      data = `0x${logs[0].args.encodedData.substr(148, logs[0].args.encodedData.length - 148)}`;

      // Apply transfer on home chain, it should fail
      await bridge.executeMessageCall(foreignMediator.address, homeMediator.address, data, tx, 200);

      assert.equal(await bridge.messageCallStatus(tx), false);
      assert.equal(await bridge.failedReason(tx), null);

      const dataHash2 = await bridge.failedMessageDataHash(tx);
      assert.notEqual(dataHash, dataHash2);
    });

    it('should allow to execute vote by locker', async function() {
      const prapreTxHash = '0x2ebc2ccc755acc8eaf9252e19573af708d644ab63a39619adb080a3500a4ff2e';
      // transfer foreign -> home (preparation)
      const data = await homeMediator.contract.methods.handleBridgedTokens(bob, token1, bridgedData, nonce).encodeABI();
      // message must be generated by mediator contract on the other network
      await bridge.executeMessageCall(homeMediator.address, foreignMediator.address, data, prapreTxHash, 2000000);

      assert.equal(await bridgedTokenX.ownerOf(token1), bob);

      res = await this.ppBridgedLockerFactory.build({ from: bob, value: 1 });
      const lockerAddress = res.logs[0].args.locker;
      const locker = await PPBridgedLocker.at(lockerAddress);

      // deposit token
      await bridgedTokenX.approve(locker.address, token1, { from: bob });
      await locker.deposit(bridgedTokenX.address, token1, { from: bob });

      const hackVoting = await HackVotingMock.new(bridgedTokenX.address);

      await locker.vote(hackVoting.address, 0, true, true, { from: bob });
    });
  });
});
