/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../abstract/interfaces/IAbstractLocker.sol";

interface ILockerProposalManager {

  function VOTE_FEE_KEY() external returns(bytes32);

  function initialize(
    IAbstractLocker _locker,
    address _feeManager,
    bytes32[] calldata _markerList,
    uint256[] calldata _supportList,
    uint256[] calldata _quorumList,
    uint256[] calldata _timeoutList
  ) external;

  function setEthFee(bytes32 _key, uint256 _ethFee) external;
  function setFeeManager(address _addr) external;
  function setFeeCollector(address _addr) external;
}