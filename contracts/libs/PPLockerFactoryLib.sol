/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


import "../interfaces/IPPGlobalRegistry.sol";
import "../interfaces/IPPLockerRegistry.sol";


library PPLockerFactoryLib {

  function addLockerToRegistry(address _globalRegistry, address _locker, bytes32 _type)
    external
  {
    IPPLockerRegistry(IPPGlobalRegistry(_globalRegistry).getPPLockerRegistryAddress()).addLocker(_locker, _type);
  }

  function getGaltToken(address _globalRegistry)
    external
    view
    returns (address)
  {
    return IPPGlobalRegistry(_globalRegistry).getGaltTokenAddress();
  }
}
