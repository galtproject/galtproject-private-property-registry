/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPPGlobalRegistry.sol";


contract PPGlobalRegistry is IPPGlobalRegistry, Ownable {
  address public factory;
  IPPLockerRegistry public lockerRegistry;

  address[] public privatePropertyTokens;
  mapping(address => bool) public isTokenRegistered;

  modifier onlyFactory() {
    require(msg.sender == factory, "Only factory allowed");

    _;
  }

  // OWNER INTERFACE

  function setLockerRegistry(IPPLockerRegistry _lockerRegistry) external onlyOwner {
    lockerRegistry = _lockerRegistry;
    emit SetLockerRegistry(address(_lockerRegistry));
  }

  function setFactory(address _factory) external onlyOwner {
    factory = _factory;
    emit SetFactory(_factory);
  }

  function add(
    address _privatePropertyToken
  )
    external
    onlyFactory
  {
    privatePropertyTokens.push(_privatePropertyToken);
    isTokenRegistered[_privatePropertyToken] = true;
    emit Add(_privatePropertyToken, msg.sender);
  }

  // GETTERS

  function requireTokenValid(address _token) external view {
    require(isTokenRegistered[_token] == true, "Token contract is invalid");
  }

  function getPrivatePropertyTokens() external view returns (address[] memory) {
    return privatePropertyTokens;
  }
}
