/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "./IPPLockerRegistry.sol";


contract IPPGlobalRegistry {
  event Add(address token, address factory);
  event SetFactory(address factory);
  event SetLockerRegistry(address lockerRegistry);

  function lockerRegistry() external view returns (IPPLockerRegistry);
  function privatePropertyTokens(uint256 _index) external view returns (address);
  function isTokenRegistered(address _tokenContract) external view returns (bool);
  function requireTokenValid(address _token) external view;
  function setFactory(address _factory) external;
  function add(address _privatePropertyToken) external;
  function getPrivatePropertyTokens() external view returns (address[] memory);
}
