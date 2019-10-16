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


contract PrivatePropertyGlobalRegistry is Ownable {
  event Add(address token, address factory);

  address public factory;

  address[] public registeredTokens;

  modifier onlyFactory() {
    require(msg.sender == factory, "Only factory allowed");

    _;
  }

  // OWNER INTERFACE

  function setFactory(address _factory) external onlyOwner {
    factory = _factory;
  }

  function add(
    address _privatePropertyToken
  )
    external
    onlyFactory
  {
    registeredTokens.push(_privatePropertyToken);
    emit Add(_privatePropertyToken, msg.sender);
  }

  function getRegisteredTokens() external view returns (address[] memory) {
    return registeredTokens;
  }
}
