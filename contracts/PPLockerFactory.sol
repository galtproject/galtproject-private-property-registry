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
    address _galtToken,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_galtToken, _ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
  }

  function build() external payable returns (IPPLocker) {
    _acceptPayment();

    IPPLocker locker = new PPLocker(globalRegistry, msg.sender);

    IPPLockerRegistry(globalRegistry.getPPLockerRegistryAddress()).addLocker(address(locker));

    emit NewPPLocker(msg.sender, address(locker));

    return IPPLocker(locker);
  }
}
