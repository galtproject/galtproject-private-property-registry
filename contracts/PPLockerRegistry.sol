/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IPPLockerRegistry.sol";
import "./interfaces/IPPGlobalRegistry.sol";


/**
 * @title Private Property Locker Registry.
 * @notice Tracks all the valid lockers of a given type.
 */
contract PPLockerRegistry is IPPLockerRegistry, OwnableAndInitializable {

  uint256 public constant VERSION = 2;

  bytes32 public constant ROLE_LOCKER_REGISTRAR = bytes32("LOCKER_REGISTRAR");

  struct Details {
    bool active;
    address factory;
    bytes32 contractType;
  }

  IPPGlobalRegistry public globalRegistry;

  // Locker address => Details
  mapping(address => Details) public lockers;

  modifier onlyFactory() {
    require(
      globalRegistry.getACL().hasRole(msg.sender, ROLE_LOCKER_REGISTRAR),
      "Invalid registrar"
    );

    _;
  }

  function initialize(IPPGlobalRegistry _ppGlobalRegistry) external isInitializer {
    globalRegistry = _ppGlobalRegistry;
  }

  // FACTORY INTERFACE

  function addLocker(address _locker, bytes32 _contractType) external onlyFactory {
    Details storage locker = lockers[_locker];

    locker.active = true;
    locker.factory = msg.sender;
    locker.contractType = _contractType;

    emit AddLocker(_locker, locker.factory);
  }

  // REQUIRES

  function requireValidLocker(address _locker) external view {
    require(lockers[_locker].active == true, "Locker address is invalid");
  }

  // GETTERS

  function isValid(address _locker) external view returns (bool) {
    return lockers[_locker].active;
  }
}
