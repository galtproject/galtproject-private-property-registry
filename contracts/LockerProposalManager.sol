/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./abstract/interfaces/IAbstractLocker.sol";
import "./abstract/PPAbstractProposalManager.sol";


contract LockerProposalManager is PPAbstractProposalManager {

  IAbstractLocker public locker;

  constructor(uint256 _defaultSupport, uint256 _defaultMinAcceptQuorum, uint256 _defaultTimeout) public {
    _setDefaultProposalConfig(_defaultSupport, _defaultMinAcceptQuorum, _defaultTimeout);
  }

  function initialize(
    IAbstractLocker _locker,
    address _globalRegistry,
    bytes32[] memory _markerList,
    uint256[] memory _supportList,
    uint256[] memory _quorumList,
    uint256[] memory _timeoutList
  )
    public
  {
    locker = _locker;
    initialize(_globalRegistry);

    uint256 markersLen = _markerList.length;
    require(
      markersLen == _supportList.length && markersLen == _quorumList.length && markersLen == _timeoutList.length,
      "Marker configs length does not equal"
    );
    for (uint256 i = 0; i < markersLen; i++) {
      _setProposalConfig(_markerList[i], _supportList[i], _quorumList[i], _timeoutList[i]);
    }
  }

  modifier onlyProposalConfigManager() {
    require(msg.sender == address(this), "Not the proposal manager");
    _;
  }

  modifier onlyProposalDefaultConfigManager() {
    require(msg.sender == address(this), "Not the proposal manager");
    _;
  }

  modifier onlyLockerOwner() {
    require(locker.reputationOf(msg.sender) > 0, "Not the locker owner");
    _;
  }

  // solium-disable-next-line blank-lines
  function propose(
    address _destination,
    uint256 _value,
    bool _castVote,
    bool _executesIfDecided,
    bytes calldata _data,
    string calldata _dataLink
  )
    external
    payable
    onlyLockerOwner
  {
    require(locker.tokenDeposited(), "Token not deposited");
    _propose(_destination, _value, _castVote, _executesIfDecided, _data, _dataLink);
  }


  function reputationOf(address _address) public view returns (uint256) {
    return locker.reputationOf(_address);
  }

  function reputationOfAt(address _address, uint256 _blockNumber) public view returns (uint256) {
    return locker.reputationOfAt(_address, _blockNumber);
  }

  function totalReputationSupplyAt(uint256 _blockNumber) public view returns (uint256) {
    return locker.totalReputationSupplyAt(_blockNumber);
  }
}