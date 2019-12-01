/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "./PPTokenController.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPTokenControllerFactory {
  // USER INTERFACE

  function build(IERC721 _tokenContract, uint256 _defaultBurnTimeoutDuration) external returns (PPTokenController){
    PPTokenController ppTokenController = new PPTokenController(_tokenContract, _defaultBurnTimeoutDuration);

    ppTokenController.transferOwnership(msg.sender);

    return ppTokenController;
  }
}
