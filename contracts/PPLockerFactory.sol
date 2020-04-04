/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IPPLockerRegistry.sol";
import "./PPLocker.sol";
import "./traits/ChargesFee.sol";
import "./interfaces/IPPGlobalRegistry.sol";


contract PPLockerFactory is Ownable, ChargesFee {
  event NewPPLocker(address indexed owner, address locker);

  IPPGlobalRegistry public globalRegistry;

  constructor(
    IPPGlobalRegistry _globalRegistry,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
  }

  function build() external payable returns (IPPLocker) {
    return buildForOwner(msg.sender);
  }

  function buildForOwner(address _lockerOwner) public payable returns (IPPLocker) {
    _acceptPayment();

    IPPLocker locker = new PPLocker(globalRegistry, _lockerOwner);

    IPPLockerRegistry(globalRegistry.getPPLockerRegistryAddress()).addLocker(address(locker), bytes32("regular"));

    emit NewPPLocker(msg.sender, address(locker));

    return IPPLocker(locker);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(globalRegistry.getGaltTokenAddress());
  }
}
