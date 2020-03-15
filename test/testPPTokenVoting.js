const { accounts, defaultSender, contract, web3 } = require('@openzeppelin/test-environment');
const { assert } = require('chai');

const PPTokenFactory = contract.fromArtifact('PPTokenFactory');
const PPTokenControllerFactory = contract.fromArtifact('PPTokenControllerFactory');
const PPGlobalRegistry = contract.fromArtifact('PPGlobalRegistry');
const PPTokenRegistry = contract.fromArtifact('PPTokenRegistry');
const PPACL = contract.fromArtifact('PPACL');
const PPToken = contract.fromArtifact('PPToken');
const PPTokenVoting = contract.fromArtifact('PPTokenVoting');
const PPTokenVotingFactory = contract.fromArtifact('PPTokenVotingFactory');
const PPTokenController = contract.fromArtifact('PPTokenController');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const MockPPToken = contract.fromArtifact('MockPPToken');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
const PPLockerFactory = contract.fromArtifact('PPLockerFactory');
const PPLocker = contract.fromArtifact('PPLocker');
const galt = require('@galtproject/utils');
const _ = require('lodash');

PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const {
  ether,
  assertRevert,
  evmIncreaseTime,
  assertErc20BalanceChanged,
  assertEthBalanceChanged,
  numberToEvmWord,
  getEventArg,
  hex
} = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex, hexToUtf8 } = web3.utils;

const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;
const TWO_HOURS = 60 * 60 * 2;

const ProposalStatus = {
  NULL: 0,
  PENDING: 1,
  APPROVED: 2,
  EXECUTED: 3,
  REJECTED: 4,
  CANCELLED: 5
};

describe('PPTokenVoting', () => {
  const [
    systemOwner,
    registryOwner,
    minter,
    geoDataManager,
    lockerFeeManager,
    burner,
    alice,
    bob,
    charlie,
    dan
  ] = accounts;
  const unknown = defaultSender;

  const galtFee = ether(20);

  const initContour = ['qwerqwerqwer', 'ssdfssdfssdf', 'zxcvzxcvzxcv'];
  const contour = initContour.map(galt.geohashToNumber).map(a => a.toString(10));

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(systemOwner, galtFee);
    await this.galtToken.mint(registryOwner, galtFee);
    await this.galtToken.mint(alice, ether(1000));

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);

    this.ppTokenVotingFactory = await PPTokenVotingFactory.new();
    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);

    let res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner
    });
    this.token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    this.controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
  });

  describe('change fee by voting', () => {
    let token;
    let voting;
    let controller;
    let res;
    let aliceTokenId;
    let bobTokenId;

    beforeEach(async function() {
      res = await this.ppTokenFactory.build(
        'Buildings',
        'BDL',
        'dataLink',
        ONE_HOUR,
        [bytes32('CONTROLLER_PROPOSAL_ETH')],
        [ether(0.1)],
        utf8ToHex(''),
        {
          from: registryOwner
        }
      );
      token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
      controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);

      res = await this.ppTokenVotingFactory.build(
        token.address,
        ether(0.51),
        ether(0.51),
        60
      );
      voting = await PPTokenVoting.at(_.find(res.logs, l => l.args.voting).args.voting);

      await controller.setMinter(minter, { from: registryOwner });
      await controller.setBurner(burner, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      await controller.setFeeManager(voting.address, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      const blockNumberBeforeAlice = await web3.eth.getBlockNumber();

      await controller.setInitialDetails(
        aliceTokenId,
        2,
        1,
        100,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      const blockNumberAfterAlice = await web3.eth.getBlockNumber();
      assert.equal(await token.getAreaAt(aliceTokenId, blockNumberBeforeAlice), '0');
      assert.equal((await token.getAreaAt(aliceTokenId, blockNumberAfterAlice)).toString(), '100');

      assert.equal((await token.getTotalAreaSupplyAt(blockNumberBeforeAlice)).toString(), '0');
      assert.equal((await token.getTotalAreaSupplyAt(blockNumberAfterAlice)).toString(), '100');

      res = await controller.mint(bob, { from: minter });
      bobTokenId = res.logs[0].args.tokenId;

      const blockNumberBeforeBob = await web3.eth.getBlockNumber();

      await controller.setInitialDetails(
        bobTokenId,
        2,
        1,
        100,
        utf8ToHex('foo'),
        'bar',
        'buzz',
        false,
        { from: minter }
      );

      const blockNumberAfterBob = await web3.eth.getBlockNumber();

      assert.equal(await token.getAreaAt(bobTokenId, blockNumberBeforeBob), '0');
      assert.equal((await token.getAreaAt(bobTokenId, blockNumberAfterBob)).toString(), '100');

      assert.equal((await token.getTotalAreaSupplyAt(blockNumberBeforeBob)).toString(), '100');
      assert.equal((await token.getTotalAreaSupplyAt(blockNumberAfterBob)).toString(), '200');
    });

    it.only('should remove data on burn', async function() {

      assert.equal(await controller.fees(await controller.PROPOSAL_ETH_FEE_KEY()), ether(0.1));
      const data = controller.contract.methods.setFee(await controller.PROPOSAL_ETH_FEE_KEY(), ether(0.5)).encodeABI();

      await assertRevert(voting.newVote(controller.address, data, '', { from: minter }), 'SENDER_NOT_TOKEN_HOLDER');
      await assertRevert(voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: minter }), 'SENDER_NOT_TOKEN_HOLDER');
      await assertRevert(voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: alice }), 'SENDER_NOT_TOKEN_HOLDER');

      res = await voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: bob });

    });
  });
});
