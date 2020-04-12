/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./IPPToken.sol";


interface IPPTokenVoting {
  event StartVote(uint256 indexed voteId, address indexed creator, uint256 indexed tokenId, string metadata);
  event CastVote(uint256 indexed voteId, address indexed voter, uint256 indexed tokenId, bool support, uint256 stake);
  event ExecuteVote(uint256 indexed voteId);
  event ChangeSupportRequired(uint256 supportRequiredPct);
  event ChangeMinQuorum(uint256 minAcceptQuorumPct);

  enum VoterState { Absent, Yea, Nay }

  struct Vote {
    bool executed;
    uint256 startDate;
    uint256 snapshotBlock;
    uint256 supportRequiredPct;
    uint256 minAcceptQuorumPct;
    uint256 yea;
    uint256 nay;
    uint256 votingPower;
    address destination;
    bytes executionScript;
    mapping (uint256 => VoterState) voters;
  }

  function registry() external returns (IPPToken);
  function supportRequiredPct() external returns (uint256);
  function minAcceptQuorumPct() external returns (uint256);
  function voteTime() external returns (uint256);
  function votesLength() external returns (uint256);

  function changeSupportRequiredPct(uint256 _supportRequiredPct) external;
  function changeMinAcceptQuorumPct(uint256 _minAcceptQuorumPct) external;

  function newVote(
    address _destination,
    bytes calldata _executionScript,
    string calldata _metadata
  )
  external
  returns (uint256 voteId);

  function newVote(
    address _destination,
    bytes calldata _executionScript,
    string calldata _metadata,
    bool _castVote,
    bool _executesIfDecided
  )
  external
  returns (uint256 voteId);

  function newVoteByTokens(
    uint256[] calldata _tokenIds,
    address _destination,
    bytes calldata _executionScript,
    string calldata _metadata,
    bool _castVote,
    bool _executesIfDecided
  )
  external
  returns (uint256 voteId);

  function vote(uint256 _voteId, bool _support, bool _executesIfDecided) external;

  function voteByTokens(
    uint256[] calldata _tokenIds,
    uint256 _voteId,
    bool _support,
    bool _executesIfDecided
  )
  external;

  function executeVote(uint256 _voteId) external;

  function canExecute(uint256 _voteId) external view returns (bool);

  function canVote(uint256 _voteId, uint256 _tokenId) external view returns (bool);

  function getVote(uint256 _voteId)
  external
  view
  returns (
    bool open,
    bool executed,
    uint256 startDate,
    uint256 snapshotBlock,
    uint256 supportRequired,
    uint256 minAcceptQuorum,
    uint256 yea,
    uint256 nay,
    uint256 votingPower,
    bytes memory script
  );

  function getVoterState(uint256 _voteId, uint256 _tokenId) external view returns (VoterState);
}
