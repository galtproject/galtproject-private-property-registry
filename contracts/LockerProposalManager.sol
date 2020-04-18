/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/core/contracts/reputation/AbstractProposalManager.sol";
import "./abstract/interfaces/IAbstractLocker.sol";


contract LockerProposalManager is AbstractProposalManager {

  IAbstractLocker public locker;

  constructor(uint256 _defaultSupport, uint256 _defaultMinAcceptQuorum, uint256 _defaultTimeout) public {
    _validateVotingConfig(_defaultSupport, _defaultMinAcceptQuorum, _defaultTimeout);

    defaultVotingConfig.support = _defaultSupport;
    defaultVotingConfig.minAcceptQuorum = _defaultMinAcceptQuorum;
    defaultVotingConfig.timeout = _defaultTimeout;
  }

  function initialize(IAbstractLocker _locker, address _feeManager) public {
    locker = _locker;
    initialize(_feeManager);
  }

  modifier onlyProposalConfigManager() {
    require(msg.sender == address(locker), "Not the proposal manager");
    _;
  }

  modifier onlyProposalDefaultConfigManager() {
    require(msg.sender == address(locker), "Not the proposal manager");
    _;
  }

  modifier onlyLockerOwner() {
    require(locker.reputationOf(msg.sender) > 0, "Not the locker owner");
    _;
  }

  // OWNER INTERFACE
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
    require(_destination != address(locker.tokenContract()), "Destination can not be the tokenContract");
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