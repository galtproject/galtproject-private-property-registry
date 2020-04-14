/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./PPTokenController.sol";
import "./interfaces/IPPToken.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPTokenControllerFactory {
  event NewPPTokenController(address indexed token, address controller);

  // USER INTERFACE

  function build(
    IPPGlobalRegistry _globalRegistry,
    IAbstractToken _tokenContract,
    uint256 _defaultBurnTimeoutDuration
  )
    external
    returns (PPTokenController)
  {
    PPTokenController ppTokenController = new PPTokenController(
      _globalRegistry,
      _tokenContract,
      _defaultBurnTimeoutDuration
    );

    ppTokenController.transferOwnership(msg.sender);

    emit NewPPTokenController(address(_tokenContract), address(ppTokenController));

    return ppTokenController;
  }
}
