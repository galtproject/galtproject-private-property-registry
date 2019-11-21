/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "./interfaces/IPPLockerRegistry.sol";
import "./interfaces/IPPLocker.sol";
import "./interfaces/IPPGlobalRegistry.sol";


/**
 * @title Private Property Locker Registry.
 * @notice Tracks all the valid lockers of a given type.
 */
contract PPLockerRegistry is IPPLockerRegistry, OwnableAndInitializable {
  using ArraySet for ArraySet.AddressSet;

  bytes32 public constant ROLE_LOCKER_REGISTRAR = bytes32("LOCKER_REGISTRAR");

  struct Details {
    bool active;
    address factory;
  }

  IPPGlobalRegistry public globalRegistry;

  // Locker address => Details
  mapping(address => Details) public lockers;

  // Locker address => Details
  mapping(address => ArraySet.AddressSet) internal lockersByOwner;

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

  function addLocker(address _locker) external onlyFactory {
    Details storage locker = lockers[_locker];

    locker.active = true;
    locker.factory = msg.sender;

    lockersByOwner[IPPLocker(_locker).owner()].add(_locker);

    emit AddLocker(_locker, IPPLocker(_locker).owner(), locker.factory);
  }

  // REQUIRES

  function requireValidLocker(address _locker) external view {
    require(lockers[_locker].active == true, "Locker address is invalid");
  }

  // GETTERS

  function isValid(address _locker) external view returns (bool) {
    return lockers[_locker].active;
  }

  function getLockersListByOwner(address _owner) external view returns (address[] memory) {
    return lockersByOwner[_owner].elements();
  }

  function getLockersCountByOwner(address _owner) external view returns (uint256) {
    return lockersByOwner[_owner].size();
  }
}
