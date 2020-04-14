/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./PPTokenVoting.sol";
import "./interfaces/IPPToken.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPTokenVotingFactory {
  event NewPPTokenVoting(address indexed voting);

  // USER INTERFACE

  function build(
    IAbstractToken _registry,
    uint256 _supportRequiredPct,
    uint256 _minAcceptQuorumPct,
    uint256 _voteTime
  )
    external
    returns (PPTokenVoting)
  {
    PPTokenVoting ppTokenVoting = new PPTokenVoting(
      _registry,
      _supportRequiredPct,
      _minAcceptQuorumPct,
      _voteTime
    );

    ppTokenVoting.transferOwnership(msg.sender);

    emit NewPPTokenVoting(address(ppTokenVoting));

    return ppTokenVoting;
  }
}
