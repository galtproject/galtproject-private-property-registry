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
import "./LockerProposalManager.sol";
import "./interfaces/ILockerProposalManager.sol";


contract LockerProposalManagerFactory is Ownable {
  event NewLockerProposalManager(address proposalManager);

  constructor() public {

  }

  function build(
    uint256 _defaultSupport,
    uint256 _defaultMinAcceptQuorum,
    uint256 _timeout,
    uint256 _committingTimeout
  )
    external
    payable
    returns (ILockerProposalManager)
  {
    LockerProposalManager proposalManager = new LockerProposalManager(
      _defaultSupport,
      _defaultMinAcceptQuorum,
      _timeout,
      _committingTimeout
    );

    emit NewLockerProposalManager(address(proposalManager));

    return ILockerProposalManager(address(proposalManager));
  }
}
