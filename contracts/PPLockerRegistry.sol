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
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPPLockerRegistry.sol";
import "./interfaces/IPPLocker.sol";
import "./PPGlobalRegistry.sol";


/**
 * @title Locker Registry.
 * @notice Tracks all the valid lockers of a given type.
 * @dev We use this contract in order to track both SpaceLockers and Galt Lockers.
 */
contract PPLockerRegistry is IPPLockerRegistry, Ownable {
  using ArraySet for ArraySet.AddressSet;

  event AddLocker(address indexed locker, address indexed owner, address factory);

  struct Details {
    bool active;
    address factory;
  }

  address public factory;

  // Locker address => Details
  mapping(address => Details) public lockers;

  // Locker address => Details
  mapping(address => ArraySet.AddressSet) internal lockersByOwner;

  modifier onlyFactory {
    require(msg.sender == factory, "Only factory allowed");

    _;
  }

  constructor(
    address _factory
  )
    public
  {
    factory = _factory;
  }

  // EXTERNAL

  function addLocker(address _locker) external onlyFactory {
    Details storage locker = lockers[_locker];

    locker.active = true;
    locker.factory = msg.sender;

    lockersByOwner[IPPLocker(_locker).owner()].add(_locker);

    emit AddLocker(_locker, IPPLocker(_locker).owner(), locker.factory);
  }

  // REQUIRES

  function requireValidLocker(address _locker) external view {
    require(lockers[_locker].active, "Locker address is invalid");
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
