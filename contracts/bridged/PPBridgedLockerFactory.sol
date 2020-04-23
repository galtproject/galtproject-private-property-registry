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
import "../interfaces/ILockerProposalManager.sol";
import "../interfaces/ILockerProposalManagerFactory.sol";
import "../interfaces/IPPLockerRegistry.sol";


contract PPBridgedLockerFactory is Ownable, ChargesFee {
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
    bytes32[] memory bytes32List = new bytes32[](0);
    uint256[] memory uint256List = new uint256[](0);

    return buildForOwner(
      msg.sender,
      100 ether,
      100 ether,
      60 * 60 * 24 * 7,
      bytes32List,
      uint256List,
      uint256List,
      uint256List
    );
  }

  function buildForOwner(
    address _lockerOwner,
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout,
    bytes32[] memory _markerList,
    uint256[] memory _supportList,
    uint256[] memory _quorumList,
    uint256[] memory _timeoutList
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

    address locker = address(new PPBridgedLocker(globalRegistry, _lockerOwner, address(proposalManager)));

    proposalManager.initialize(
      IAbstractLocker(locker),
      feeManager,
      _markerList,
      _supportList,
      _quorumList,
      _timeoutList
    );

    IPPLockerRegistry(IPPGlobalRegistry(globalRegistry).getPPLockerRegistryAddress()).addLocker(locker, bytes32("bridged"));

    emit NewPPLocker(msg.sender, address(locker));

    return IAbstractLocker(locker);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(IPPGlobalRegistry(globalRegistry).getGaltTokenAddress());
  }
}
