/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/core/contracts/reputation/AbstractProposalManager.sol";
import "../interfaces/IPPGlobalRegistry.sol";


contract PPAbstractProposalManager is AbstractProposalManager {

  IPPGlobalRegistry public globalRegistry;

  function initialize(address _globalRegistry) public isInitializer {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
  }

  function feeRegistry() public returns(address) {
    return globalRegistry.getPPFeeRegistryAddress();
  }
}