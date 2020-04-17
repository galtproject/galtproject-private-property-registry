/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../abstract/AbstractLocker.sol";


contract PPBridgedLocker is AbstractLocker {

  modifier onlyValidTokenContract(IAbstractToken _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .requireValidToken(address(_tokenContract));
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .requireTokenType(address(_tokenContract), bytes32("bridged"));
    _;
  }

  constructor(
    address _globalRegistry,
    address _depositManager,
    address _feeManager,
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout
  )
    public
    AbstractLocker(_globalRegistry, _depositManager, _feeManager, _defaultSupport, _defaultMinAcceptQuorum, _timeout)
  {

  }
}
