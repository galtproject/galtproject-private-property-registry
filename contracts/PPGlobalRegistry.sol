/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/libs/contracts/traits/OwnableAndInitializable.sol";
import "@galtproject/core/contracts/interfaces/IACL.sol";
import "./interfaces/IPPGlobalRegistry.sol";


contract PPGlobalRegistry is IPPGlobalRegistry, OwnableAndInitializable {
  // solium-disable-next-line mixedcase
  address internal constant ZERO_ADDRESS = address(0);

  bytes32 public constant PPGR_ACL = bytes32("ACL");
  bytes32 public constant PPGR_GALT_TOKEN = bytes32("galt_token");
  bytes32 public constant PPGR_FEE_REGISTRY = bytes32("fee_registry");
  bytes32 public constant PPGR_LOCKER_REGISTRY = bytes32("locker_registry");
  bytes32 public constant PPGR_TOKEN_REGISTRY = bytes32("token_registry");
  bytes32 public constant PPGR_MARKET = bytes32("market");

  event SetContract(bytes32 indexed key, address addr);

  mapping(bytes32 => address) internal contracts;

  function initialize() public isInitializer {
  }

  function setContract(bytes32 _key, address _value) external onlyOwner {
    contracts[_key] = _value;

    emit SetContract(_key, _value);
  }

  // GETTERS
  function getContract(bytes32 _key) external view returns (address) {
    return contracts[_key];
  }

  function getACL() external view returns (IACL) {
    require(contracts[PPGR_ACL] != ZERO_ADDRESS, "PPGR: ACL not set");
    return IACL(contracts[PPGR_ACL]);
  }

  function getGaltTokenAddress() external view returns (address) {
    require(contracts[PPGR_GALT_TOKEN] != ZERO_ADDRESS, "PPGR: GALT_TOKEN not set");
    return contracts[PPGR_GALT_TOKEN];
  }

  function getPPFeeRegistryAddress() external view returns (address) {
    require(contracts[PPGR_FEE_REGISTRY] != ZERO_ADDRESS, "PPGR: FEE_REGISTRY not set");
    return contracts[PPGR_FEE_REGISTRY];
  }

  function getPPTokenRegistryAddress() external view returns (address) {
    require(contracts[PPGR_TOKEN_REGISTRY] != ZERO_ADDRESS, "PPGR: TOKEN_REGISTRY not set");
    return contracts[PPGR_TOKEN_REGISTRY];
  }

  function getPPLockerRegistryAddress() external view returns (address) {
    require(contracts[PPGR_LOCKER_REGISTRY] != ZERO_ADDRESS, "PPGR: LOCKER_REGISTRY not set");
    return contracts[PPGR_LOCKER_REGISTRY];
  }

  function getPPMarketAddress() external view returns (address) {
    require(contracts[PPGR_MARKET] != ZERO_ADDRESS, "PPGR: MARKET not set");
    return contracts[PPGR_MARKET];
  }
}
