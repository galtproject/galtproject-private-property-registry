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
const PPLockerFactory = contract.fromArtifact('PPLockerFactory');
const PPLockerRegistry = contract.fromArtifact('PPLockerRegistry');
const PPLocker = contract.fromArtifact('PPLocker');
// 'openzeppelin-solidity/contracts/token/ERC20/ERC20Mintable'
const MintableErc20Token = contract.fromArtifact('ERC20Mintable');
const _ = require('lodash');

PPToken.numberFormat = 'String';
PPTokenController.numberFormat = 'String';
MintableErc20Token.numberFormat = 'String';

const { ether, assertRevert } = require('@galtproject/solidity-test-chest')(web3);

const { utf8ToHex } = web3.utils;

const bytes32 = utf8ToHex;

const ONE_HOUR = 60 * 60;

describe('PPTokenVoting', () => {
  const [systemOwner, registryOwner, minter, geoDataManager, burner, alice, bob, dan] = accounts;
  const unknown = defaultSender;

  const galtFee = ether(20);
  const ethFee = ether(10);

  beforeEach(async function() {
    this.galtToken = await MintableErc20Token.new();
    await this.galtToken.mint(systemOwner, galtFee);
    await this.galtToken.mint(registryOwner, galtFee);
    await this.galtToken.mint(alice, ether(1000));

    this.ppgr = await PPGlobalRegistry.new();
    this.acl = await PPACL.new();
    this.ppTokenRegistry = await PPTokenRegistry.new();
    this.ppLockerRegistry = await PPLockerRegistry.new();

    await this.ppgr.initialize();
    await this.ppTokenRegistry.initialize(this.ppgr.address);
    await this.ppLockerRegistry.initialize(this.ppgr.address);

    this.ppTokenVotingFactory = await PPTokenVotingFactory.new();
    this.ppTokenControllerFactory = await PPTokenControllerFactory.new();
    this.ppTokenFactory = await PPTokenFactory.new(this.ppTokenControllerFactory.address, this.ppgr.address, 0, 0);
    this.ppLockerFactory = await PPLockerFactory.new(this.ppgr.address, 0, 0);

    // PPGR setup
    await this.ppgr.setContract(await this.ppgr.PPGR_ACL(), this.acl.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_GALT_TOKEN(), this.galtToken.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_TOKEN_REGISTRY(), this.ppTokenRegistry.address);
    await this.ppgr.setContract(await this.ppgr.PPGR_LOCKER_REGISTRY(), this.ppLockerRegistry.address);

    await this.ppLockerFactory.setFeeManager(geoDataManager);
    await this.ppLockerFactory.setEthFee(ethFee, { from: geoDataManager });
    await this.ppLockerFactory.setGaltFee(galtFee, { from: geoDataManager });

    // ACL setup
    await this.acl.setRole(bytes32('TOKEN_REGISTRAR'), this.ppTokenFactory.address, true);
    await this.acl.setRole(bytes32('LOCKER_REGISTRAR'), this.ppLockerFactory.address, true);

    const res = await this.ppTokenFactory.build('Buildings', 'BDL', 'dataLink', ONE_HOUR, [], [], utf8ToHex(''), {
      from: registryOwner
    });
    this.token = await PPToken.at(_.find(res.logs, l => l.args.token).args.token);
    this.controller = await PPTokenController.at(_.find(res.logs, l => l.args.controller).args.controller);
  });

  describe('voting progress', () => {
    let token;
    let voting;
    let controller;
    let res;
    let aliceTokenId;
    let bobTokenId;
    let danTokenId;

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

      res = await this.ppTokenVotingFactory.build(token.address, ether(0.51), ether(0.51), 60);
      voting = await PPTokenVoting.at(_.find(res.logs, l => l.args.voting).args.voting);

      await controller.setMinter(minter, { from: registryOwner });
      await controller.setBurner(burner, { from: registryOwner });
      await controller.setGeoDataManager(geoDataManager, { from: registryOwner });

      await controller.setFeeManager(voting.address, { from: registryOwner });

      res = await controller.mint(alice, { from: minter });
      aliceTokenId = res.logs[0].args.tokenId;

      const blockNumberBeforeAlice = await web3.eth.getBlockNumber();

      await controller.setInitialDetails(aliceTokenId, 2, 1, ether(100), utf8ToHex('foo'), 'bar', 'buzz', false, {
        from: minter
      });

      const blockNumberAfterAlice = await web3.eth.getBlockNumber();
      assert.equal(await token.getAreaAt(aliceTokenId, blockNumberBeforeAlice), ether(0));
      assert.equal(await token.getAreaAt(aliceTokenId, blockNumberAfterAlice), ether(100));

      assert.equal(await token.getTotalAreaSupplyAt(blockNumberBeforeAlice), ether(0));
      assert.equal(await token.getTotalAreaSupplyAt(blockNumberAfterAlice), ether(100));

      res = await controller.mint(bob, { from: minter });
      bobTokenId = res.logs[0].args.tokenId;

      const blockNumberBeforeBob = await web3.eth.getBlockNumber();

      await controller.setInitialDetails(bobTokenId, 2, 1, ether(100), utf8ToHex('foo'), 'bar', 'buzz', false, {
        from: minter
      });

      const blockNumberAfterBob = await web3.eth.getBlockNumber();

      assert.equal(await token.getAreaAt(bobTokenId, blockNumberBeforeBob), ether(0));
      assert.equal(await token.getAreaAt(bobTokenId, blockNumberAfterBob), ether(100));

      assert.equal(await token.getTotalAreaSupplyAt(blockNumberBeforeBob), ether(100));
      assert.equal(await token.getTotalAreaSupplyAt(blockNumberAfterBob), ether(200));
    });

    it('change fee by voting', async function() {
      assert.equal(await controller.fees(await controller.PROPOSAL_ETH_FEE_KEY()), ether(0.1));
      const data = controller.contract.methods.setFee(await controller.PROPOSAL_ETH_FEE_KEY(), ether(0.5)).encodeABI();

      await assertRevert(
        voting.newVote(controller.address, data, '', { from: unknown }),
        'VOTING_SENDER_NOT_TOKEN_HOLDER'
      );
      await assertRevert(
        voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: unknown }),
        'VOTING_SENDER_NOT_TOKEN_HOLDER'
      );
      await assertRevert(
        voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: alice }),
        'VOTING_SENDER_NOT_TOKEN_HOLDER'
      );

      res = await voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: bob });
      const voteId = _.find(res.logs, l => l.args.voteId).args.voteId;

      await assertRevert(
        voting.voteByTokens([bobTokenId], voteId, false, true, { from: alice }),
        'VOTING_SENDER_NOT_TOKEN_HOLDER'
      );

      await assertRevert(voting.vote(voteId, false, true, { from: dan }), 'VOTING_SENDER_NOT_TOKEN_HOLDER');

      let voteData = await voting.getVote(voteId);
      assert.equal(voteData.open, true);
      assert.equal(voteData.executed, false);
      assert.equal(voteData.votingPower, ether(200));
      assert.equal(voteData.yea, ether(100));
      assert.equal(voteData.nay, ether(0));

      // try to vote by new token
      res = await controller.mint(dan, { from: minter });
      danTokenId = res.logs[0].args.tokenId;
      await controller.setInitialDetails(danTokenId, 2, 1, ether(100), utf8ToHex('foo'), 'bar', 'buzz', false, {
        from: minter
      });

      const blockNumberAfterDan = await web3.eth.getBlockNumber();

      assert.equal(await token.totalAreaSupply(), ether(300));
      assert.equal(await token.getTotalAreaSupplyAt(blockNumberAfterDan), ether(300));

      await assertRevert(voting.voteByTokens([danTokenId], voteId, true, true, { from: dan }), 'VOTING_CAN_NOT_VOTE');

      // change area and vote with previous area
      const changeAreaData = token.contract.methods
        .setDetails(aliceTokenId, 2, 1, ether(50), utf8ToHex('foo'), 'bar', 'buzz')
        .encodeABI();

      res = await controller.propose(changeAreaData, 'foo', { from: alice });
      const proposalId = res.logs[0].args.proposalId;
      await controller.approve(proposalId, { from: geoDataManager });

      assert.equal(await token.getArea(aliceTokenId), ether(50));

      const blockNumberAfterAlice = await web3.eth.getBlockNumber();

      assert.equal(await token.totalAreaSupply(), ether(250));
      assert.equal(await token.getTotalAreaSupplyAt(blockNumberAfterAlice), ether(250));

      await voting.vote(voteId, false, true, { from: alice });

      voteData = await voting.getVote(voteId);
      assert.equal(voteData.open, true);
      assert.equal(voteData.executed, false);
      assert.equal(voteData.yea, ether(100));
      assert.equal(voteData.nay, ether(100));

      await voting.vote(voteId, true, true, { from: alice });

      voteData = await voting.getVote(voteId);
      assert.equal(voteData.open, false);
      assert.equal(voteData.executed, true);
      assert.equal(voteData.yea, ether(200));
      assert.equal(voteData.nay, ether(0));

      assert.equal(await controller.fees(await controller.PROPOSAL_ETH_FEE_KEY()), ether(0.5));
    });

    it('vote by locker', async function() {
      assert.equal(await controller.fees(await controller.PROPOSAL_ETH_FEE_KEY()), ether(0.1));
      const data = controller.contract.methods.setFee(await controller.PROPOSAL_ETH_FEE_KEY(), ether(0.5)).encodeABI();

      res = await voting.newVoteByTokens([bobTokenId], controller.address, data, '', true, true, { from: bob });
      const voteId = _.find(res.logs, l => l.args.voteId).args.voteId;

      let voteData = await voting.getVote(voteId);
      assert.equal(voteData.open, true);
      assert.equal(voteData.executed, false);
      assert.equal(voteData.yea, ether(100));
      assert.equal(voteData.nay, ether(0));

      res = await this.ppLockerFactory.build({ from: alice, value: ethFee });
      const lockerAddress = res.logs[0].args.locker;
      const locker = await PPLocker.at(lockerAddress);

      // deposit token
      await token.approve(locker.address, aliceTokenId, { from: alice });
      await locker.deposit(token.address, aliceTokenId, { from: alice });

      await locker.vote(voting.address, voteId, true, true, { from: alice });

      await assertRevert(locker.vote(voting.address, voteId, true, true, { from: bob }), 'Not the locker owner');

      voteData = await voting.getVote(voteId);
      assert.equal(voteData.open, false);
      assert.equal(voteData.executed, true);
      assert.equal(voteData.yea, ether(200));
      assert.equal(voteData.nay, ether(0));

      assert.equal(await controller.fees(await controller.PROPOSAL_ETH_FEE_KEY()), ether(0.5));
    });
  });
});
