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
import "./PPLocker.sol";
import "./traits/ChargesFee.sol";
import "./interfaces/ILockerProposalManagerFactory.sol";
import "./interfaces/IPPLockerRegistry.sol";


contract PPLockerFactory is Ownable, ChargesFee {
  event NewPPLocker(address indexed owner, address locker);

  address public globalRegistry;
  ILockerProposalManagerFactory public lockerProposalManagerFactory;

  constructor(
    address _globalRegistry,
    ILockerProposalManagerFactory _lockerProposalManagerFactory,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
    lockerProposalManagerFactory = _lockerProposalManagerFactory;
  }

  function build() external payable returns (IAbstractLocker) {
    return buildForOwner(msg.sender, 100 ether, 100 ether, 60 * 60 * 24 * 7);
  }

  function buildForOwner(
    address _lockerOwner,
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout
  )
    public
    payable
    returns (IAbstractLocker)
  {
    _acceptPayment();

    ILockerProposalManager proposalManager = lockerProposalManagerFactory.build(
      _defaultSupport,
      _defaultMinAcceptQuorum,
      _timeout
    );

    address locker = address(new PPLocker(globalRegistry, _lockerOwner, address(proposalManager)));

    proposalManager.initialize(IAbstractLocker(locker), feeManager);

    IPPLockerRegistry(IPPGlobalRegistry(globalRegistry).getPPLockerRegistryAddress()).addLocker(locker, bytes32("regular"));

    emit NewPPLocker(msg.sender, locker);

    return IAbstractLocker(locker);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(IPPGlobalRegistry(globalRegistry).getGaltTokenAddress());
  }
}
