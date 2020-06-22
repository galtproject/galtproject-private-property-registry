/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;
import "./ILockerProposalManager.sol";

interface ILockerProposalManagerFactory {

  function build(
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
  external
  payable
  returns (ILockerProposalManager);

}
