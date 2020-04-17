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
import "../traits/ChargesFee.sol";
import "./PPBridgedLocker.sol";
import "../libs/PPLockerFactoryLib.sol";


contract PPBridgedLockerFactory is Ownable, ChargesFee {
  event NewPPLocker(address indexed owner, address locker);

  address public globalRegistry;

  constructor(
    address _globalRegistry,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
  }

  function build() external payable returns (IAbstractLocker) {
    return buildForOwner(msg.sender, 100 ether, 100 ether, 60 * 60 * 24 * 7);
  }

  function buildForOwner(
    address _lockerOwner,
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout
  ) public payable returns (IAbstractLocker) {
    _acceptPayment();

    address locker = address(new PPBridgedLocker(
      globalRegistry,
      _lockerOwner,
      feeManager,
      _defaultSupport,
      _defaultMinAcceptQuorum,
      _timeout
    ));

    PPLockerFactoryLib.addLockerToRegistry(globalRegistry, locker, bytes32("regular"));

    emit NewPPLocker(msg.sender, address(locker));

    return IAbstractLocker(locker);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(PPLockerFactoryLib.getGaltToken(globalRegistry));
  }
}
