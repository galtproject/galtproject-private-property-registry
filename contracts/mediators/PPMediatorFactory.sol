/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@galtproject/libs/contracts/proxy/unstructured-storage/interfaces/IOwnedUpgradeabilityProxyFactory.sol";
import "@galtproject/libs/contracts/proxy/unstructured-storage/interfaces/IOwnedUpgradeabilityProxy.sol";
import "@galtproject/libs/contracts/proxy/unstructured-storage/OwnedUpgradeabilityProxy.sol";


contract PPMediatorFactory {
  event Build(address mediatorAddress);

  address public implementation;
  IOwnedUpgradeabilityProxyFactory internal ownedUpgradeabilityProxyFactory;

  constructor(IOwnedUpgradeabilityProxyFactory _factory, address _impl) public {
    ownedUpgradeabilityProxyFactory = _factory;
    implementation = _impl;
  }

  function build(
    bytes calldata _payload
  )
    external
    returns (address)
  {
    address mediator = _build(
      _payload,
      false,
      true
    );

    emit Build(mediator);

    return mediator;
  }

  // INTERNAL

  function _build(bytes memory _payload, bool _transferOwnership, bool _transferProxyOwnership)
    internal
    returns (address)
  {
    IOwnedUpgradeabilityProxy proxy = ownedUpgradeabilityProxyFactory.build();

    proxy.upgradeToAndCall(implementation, _payload);

    if (_transferOwnership == true) {
      Ownable(address(proxy)).transferOwnership(msg.sender);
    }

    if (_transferProxyOwnership == true) {
      proxy.transferProxyOwnership(msg.sender);
    }

    return address(proxy);
  }
}