/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;


interface IPPLockerRegistry {
  event AddLocker(address indexed locker, address indexed owner, address indexed factory);
  event SetFactory(address factory);

  function lockerList(uint256 _index) external view returns (address);
  function addLocker(address _locker) external;
  function requireValidLocker(address _locker) external view;
  function isValid(address _locker) external view returns (bool);
  function getAllLockers() external view returns (address[] memory);
}
