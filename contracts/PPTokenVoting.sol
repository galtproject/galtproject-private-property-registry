/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IPPToken.sol";


contract PPTokenVoting is Ownable {
  using SafeMath for uint256;

  bytes32 public constant CREATE_VOTES_ROLE = keccak256("CREATE_VOTES_ROLE");
  bytes32 public constant MODIFY_SUPPORT_ROLE = keccak256("MODIFY_SUPPORT_ROLE");
  bytes32 public constant MODIFY_QUORUM_ROLE = keccak256("MODIFY_QUORUM_ROLE");

  uint256 public constant PCT_BASE = 10 ** 18; // 0% = 0; 1% = 10^16; 100% = 10^18

  string private constant ERROR_NO_VOTE = "VOTING_NO_VOTE";
  string private constant ERROR_INIT_PCTS = "VOTING_INIT_PCTS";
  string private constant ERROR_CHANGE_SUPPORT_PCTS = "VOTING_CHANGE_SUPPORT_PCTS";
  string private constant ERROR_CHANGE_QUORUM_PCTS = "VOTING_CHANGE_QUORUM_PCTS";
  string private constant ERROR_INIT_SUPPORT_TOO_BIG = "VOTING_INIT_SUPPORT_TOO_BIG";
  string private constant ERROR_CHANGE_SUPPORT_TOO_BIG = "VOTING_CHANGE_SUPP_TOO_BIG";
  string private constant ERROR_CAN_NOT_VOTE = "VOTING_CAN_NOT_VOTE";
  string private constant ERROR_NOT_TOKEN_HOLDER = "VOTING_SENDER_NOT_TOKEN_HOLDER";
  string private constant ERROR_CAN_NOT_EXECUTE = "VOTING_CAN_NOT_EXECUTE";
  string private constant ERROR_CAN_NOT_FORWARD = "VOTING_CAN_NOT_FORWARD";
  string private constant ERROR_NO_VOTING_POWER = "VOTING_NO_VOTING_POWER";

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

  IPPToken public registry;
  uint256 public supportRequiredPct;
  uint256 public minAcceptQuorumPct;
  uint256 public voteTime;

  // We are mimicing an array, we use a mapping instead to make app upgrade more graceful
  mapping (uint256 => Vote) internal votes;
  uint256 public votesLength;

  event StartVote(uint256 indexed voteId, address indexed creator, uint256 indexed tokenId, string metadata);
  event CastVote(uint256 indexed voteId, address indexed voter, uint256 indexed tokenId, bool support, uint256 stake);
  event ExecuteVote(uint256 indexed voteId);
  event ChangeSupportRequired(uint256 supportRequiredPct);
  event ChangeMinQuorum(uint256 minAcceptQuorumPct);

  modifier voteExists(uint256 _voteId) {
    require(_voteId < votesLength, ERROR_NO_VOTE);
    _;
  }

  /**
  * @notice Initialize Voting app with `_token.symbol(): string` for governance, minimum support of `@formatPct(_supportRequiredPct)`%, minimum acceptance quorum of `@formatPct(_minAcceptQuorumPct)`%, and a voting duration of `@transformTime(_voteTime)`
  * @param _registry IPPToken Address that will be used as governance token
  * @param _supportRequiredPct Percentage of yeas in casted votes for a vote to succeed (expressed as a percentage of 10^18; eg. 10^16 = 1%, 10^18 = 100%)
  * @param _minAcceptQuorumPct Percentage of yeas in total possible votes for a vote to succeed (expressed as a percentage of 10^18; eg. 10^16 = 1%, 10^18 = 100%)
  * @param _voteTime Seconds that a vote will be open for token holders to vote (unless enough yeas or nays have been cast to make an early decision)
  */
  constructor(IPPToken _registry, uint256 _supportRequiredPct, uint256 _minAcceptQuorumPct, uint256 _voteTime) public {
    require(_minAcceptQuorumPct <= _supportRequiredPct, ERROR_INIT_PCTS);
    require(_supportRequiredPct < PCT_BASE, ERROR_INIT_SUPPORT_TOO_BIG);

    registry = _registry;
    supportRequiredPct = _supportRequiredPct;
    minAcceptQuorumPct = _minAcceptQuorumPct;
    voteTime = _voteTime;
  }

  /**
  * @notice Change required support to `@formatPct(_supportRequiredPct)`%
  * @param _supportRequiredPct New required support
  */
  function changeSupportRequiredPct(uint256 _supportRequiredPct)
    external
    onlyOwner
  {
    require(minAcceptQuorumPct <= _supportRequiredPct, ERROR_CHANGE_SUPPORT_PCTS);
    require(_supportRequiredPct < PCT_BASE, ERROR_CHANGE_SUPPORT_TOO_BIG);
    supportRequiredPct = _supportRequiredPct;

    emit ChangeSupportRequired(_supportRequiredPct);
  }

  /**
  * @notice Change minimum acceptance quorum to `@formatPct(_minAcceptQuorumPct)`%
  * @param _minAcceptQuorumPct New acceptance quorum
  */
  function changeMinAcceptQuorumPct(uint256 _minAcceptQuorumPct)
    external
    onlyOwner
  {
    require(_minAcceptQuorumPct <= supportRequiredPct, ERROR_CHANGE_QUORUM_PCTS);
    minAcceptQuorumPct = _minAcceptQuorumPct;

    emit ChangeMinQuorum(_minAcceptQuorumPct);
  }

  /**
  * @notice Create a new vote about "`_metadata`"
  * @param _executionScript EVM script to be executed on approval
  * @param _metadata Vote metadata
  * @return voteId Id for newly created vote
  */
  function newVote(address _destination, bytes calldata _executionScript, string calldata _metadata) external returns (uint256 voteId) {
    return _newVote(registry.tokensOfOwner(msg.sender), _destination, _executionScript, _metadata, true, true);
  }

  /**
  * @notice Create a new vote about "`_metadata`"
  * @param _executionScript EVM script to be executed on approval
  * @param _metadata Vote metadata
  * @param _castVote Whether to also cast newly created vote
  * @param _executesIfDecided Whether to also immediately execute newly created vote if decided
  * @return voteId id for newly created vote
  */
  function newVote(
    address _destination,
    bytes calldata _executionScript,
    string calldata _metadata,
    bool _castVote,
    bool _executesIfDecided
  )
    external
    returns (uint256 voteId)
  {
    return _newVote(registry.tokensOfOwner(msg.sender), _destination, _executionScript, _metadata, _castVote, _executesIfDecided);
  }

  /**
  * @notice Create a new vote about "`_metadata`"
  * @param _executionScript EVM script to be executed on approval
  * @param _metadata Vote metadata
  * @param _castVote Whether to also cast newly created vote
  * @param _executesIfDecided Whether to also immediately execute newly created vote if decided
  * @return voteId id for newly created vote
  */
  function newVoteByTokens(
    uint256[] calldata _tokenIds,
    address _destination,
    bytes calldata _executionScript,
    string calldata _metadata,
    bool _castVote,
    bool _executesIfDecided
  )
  external
  returns (uint256 voteId)
  {
    return _newVote(_tokenIds, _destination, _executionScript, _metadata, _castVote, _executesIfDecided);
  }

  /**
  * @notice Vote `_support ? 'yes' : 'no'` in vote #`_voteId`
  * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
  *      created via `newVote(),` which requires initialization
  * @param _voteId Id for vote
  * @param _support Whether voter support the vote
  * @param _executesIfDecided Whether the vote should execute its action if it becomes decided
  */
  function vote(uint256 _voteId, bool _support, bool _executesIfDecided) external voteExists(_voteId) {
    _voteList(_voteId, _support, registry.tokensOfOwner(msg.sender), _executesIfDecided);
  }

  function voteByTokens(
    uint256[] calldata _tokenIds,
    uint256 _voteId,
    bool _support,
    bool _executesIfDecided
  )
    external
    voteExists(_voteId)
  {
    _voteList(_voteId, _support, _tokenIds, _executesIfDecided);
  }

  /**
  * @notice Execute vote #`_voteId`
  * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
  *      created via `newVote(),` which requires initialization
  * @param _voteId Id for vote
  */
  function executeVote(uint256 _voteId) external voteExists(_voteId) {
    _executeVote(_voteId);
  }

  // Getter fns

  /**
  * @notice Tells whether a vote #`_voteId` can be executed or not
  * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
  *      created via `newVote(),` which requires initialization
  * @return True if the given vote can be executed, false otherwise
  */
  function canExecute(uint256 _voteId) public view voteExists(_voteId) returns (bool) {
    return _canExecute(_voteId);
  }

  /**
  * @notice Tells whether `_sender` can participate in the vote #`_voteId` or not
  * @dev Initialization check is implicitly provided by `voteExists()` as new votes can only be
  *      created via `newVote(),` which requires initialization
  * @return True if the given voter can participate a certain vote, false otherwise
  */
  function canVote(uint256 _voteId, uint256 _tokenId) public view voteExists(_voteId) returns (bool) {
    return _canVote(_voteId, _tokenId);
  }

  /**
  * @dev Return all information for a vote by its ID
  * @param _voteId Vote identifier
  * @return Vote open status
  * @return Vote executed status
  * @return Vote start date
  * @return Vote snapshot block
  * @return Vote support required
  * @return Vote minimum acceptance quorum
  * @return Vote yeas amount
  * @return Vote nays amount
  * @return Vote power
  * @return Vote script
  */
  function getVote(uint256 _voteId)
    public
    view
    voteExists(_voteId)
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
    )
  {
    Vote storage vote_ = votes[_voteId];

    open = _isVoteOpen(vote_);
    executed = vote_.executed;
    startDate = vote_.startDate;
    snapshotBlock = vote_.snapshotBlock;
    supportRequired = vote_.supportRequiredPct;
    minAcceptQuorum = vote_.minAcceptQuorumPct;
    yea = vote_.yea;
    nay = vote_.nay;
    votingPower = vote_.votingPower;
    script = vote_.executionScript;
  }

  /**
  * @dev Return the state of a voter for a given vote by its ID
  * @param _voteId Vote identifier
  * @return VoterState of the requested voter for a certain vote
  */
  function getVoterState(uint256 _voteId, uint256 _tokenId) public view voteExists(_voteId) returns (VoterState) {
    return votes[_voteId].voters[_tokenId];
  }

  // Internal fns

  /**
  * @dev Internal function to create a new vote
  * @return voteId id for newly created vote
  */
  function _newVote(
    uint256[] memory _tokenIds,
    address _destination,
    bytes memory _executionScript,
    string memory _metadata,
    bool _castVote,
    bool _executesIfDecided
  )
    internal
    returns (uint256 voteId)
  {
    require(_tokenIds.length != 0, ERROR_NOT_TOKEN_HOLDER);
    require(_isTokenHolder(_tokenIds[0]), ERROR_NOT_TOKEN_HOLDER);

    uint256 snapshotBlock = block.number - 1; // avoid double voting in this very block
    uint256 votingPower = registry.getTotalAreaSupplyAt(snapshotBlock);
    require(votingPower > 0, ERROR_NO_VOTING_POWER);

    voteId = votesLength++;

    Vote storage vote_ = votes[voteId];
    vote_.startDate = block.timestamp;
    vote_.snapshotBlock = snapshotBlock;
    vote_.supportRequiredPct = supportRequiredPct;
    vote_.minAcceptQuorumPct = minAcceptQuorumPct;
    vote_.votingPower = votingPower;
    vote_.destination = _destination;
    vote_.executionScript = _executionScript;

    emit StartVote(voteId, msg.sender, _tokenIds[0], _metadata);

    if (_castVote) {
      _voteList(voteId, true, _tokenIds, _executesIfDecided);
    }
  }

  function _voteList(uint256 _voteId, bool _support, uint256[] memory _tokenIds, bool _executesIfDecided) internal {
    uint256 len = _tokenIds.length;
    require(len != 0, ERROR_NOT_TOKEN_HOLDER);
    for (uint256 i = 0; i < len; i++) {
      _vote(_voteId, _support, _tokenIds[i], _executesIfDecided);
    }
  }

  /**
  * @dev Internal function to cast a vote. It assumes the queried vote exists.
  */
  function _vote(uint256 _voteId, bool _support, uint256 _tokenId, bool _executesIfDecided) internal {
    require(_canVote(_voteId, _tokenId), ERROR_CAN_NOT_VOTE);
    require(_isTokenHolder(_tokenId), ERROR_NOT_TOKEN_HOLDER);

    Vote storage vote_ = votes[_voteId];

    // This could re-enter, though we can assume the governance token is not malicious
    uint256 voterStake = registry.getAreaAt(_tokenId, vote_.snapshotBlock);
    VoterState state = vote_.voters[_tokenId];

    // If voter had previously voted, decrease count
    if (state == VoterState.Yea) {
      vote_.yea = vote_.yea.sub(voterStake);
    } else if (state == VoterState.Nay) {
      vote_.nay = vote_.nay.sub(voterStake);
    }

    if (_support) {
      vote_.yea = vote_.yea.add(voterStake);
    } else {
      vote_.nay = vote_.nay.add(voterStake);
    }

    vote_.voters[_tokenId] = _support ? VoterState.Yea : VoterState.Nay;

    emit CastVote(_voteId, msg.sender, _tokenId, _support, voterStake);

    if (_executesIfDecided && _canExecute(_voteId)) {
      // We've already checked if the vote can be executed with `_canExecute()`
      _unsafeExecuteVote(_voteId);
    }
  }

  /**
  * @dev Internal function to execute a vote. It assumes the queried vote exists.
  */
  function _executeVote(uint256 _voteId) internal {
    require(_canExecute(_voteId), ERROR_CAN_NOT_EXECUTE);
    _unsafeExecuteVote(_voteId);
  }

  /**
  * @dev Unsafe version of _executeVote that assumes you have already checked if the vote can be executed and exists
  */
  function _unsafeExecuteVote(uint256 _voteId) internal {
    Vote storage vote_ = votes[_voteId];

    (bool ok,) = vote_.destination.call(vote_.executionScript);
    vote_.executed = ok;
    emit ExecuteVote(_voteId);
  }

  /**
  * @dev Internal function to check if a vote can be executed. It assumes the queried vote exists.
  * @return True if the given vote can be executed, false otherwise
  */
  function _canExecute(uint256 _voteId) internal view returns (bool) {
    Vote storage vote_ = votes[_voteId];

    if (vote_.executed) {
      return false;
    }

    // Voting is already decided
    if (_isValuePct(vote_.yea, vote_.votingPower, vote_.supportRequiredPct)) {
      return true;
    }

    // Vote ended?
    if (_isVoteOpen(vote_)) {
      return false;
    }
    // Has enough support?
    uint256 totalVotes = vote_.yea.add(vote_.nay);
    if (!_isValuePct(vote_.yea, totalVotes, vote_.supportRequiredPct)) {
      return false;
    }
    // Has min quorum?
    if (!_isValuePct(vote_.yea, vote_.votingPower, vote_.minAcceptQuorumPct)) {
      return false;
    }

    return true;
  }

  /**
  * @dev Internal function to check if a voter can participate on a vote. It assumes the queried vote exists.
  * @return True if the given voter can participate a certain vote, false otherwise
  */
  function _canVote(uint256 _voteId, uint256 _tokenId) internal view returns (bool) {
    Vote storage vote_ = votes[_voteId];
    return _isVoteOpen(vote_) && registry.getAreaAt(_tokenId, vote_.snapshotBlock) > 0;
  }

  /**
  * @dev Internal function to check if a msg.sender is token holder
  * @return True if the msg.sender is token holder, false otherwise
  */
  function _isTokenHolder(uint256 _tokenId) internal view returns (bool) {
    return registry.ownerOf(_tokenId) == msg.sender;
  }

  /**
  * @dev Internal function to check if a vote is still open
  * @return True if the given vote is open, false otherwise
  */
  function _isVoteOpen(Vote storage vote_) internal view returns (bool) {
    return block.timestamp < vote_.startDate.add(voteTime) && !vote_.executed;
  }

  /**
  * @dev Calculates whether `_value` is more than a percentage `_pct` of `_total`
  */
  function _isValuePct(uint256 _value, uint256 _total, uint256 _pct) internal pure returns (bool) {
    if (_total == 0) {
      return false;
    }

    uint256 computedPct = _value.mul(PCT_BASE) / _total;
    return computedPct > _pct;
  }
}
