/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./traits/ChargesFee.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./PPToken.sol";
import "./PPTokenController.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPTokenFactory is Ownable, ChargesFee {
  event Build(address token, address controller);
  event SetGlobalRegistry(address globalRegistry);

  IPPGlobalRegistry public globalRegistry;

  constructor(address _globalRegistry, address _galtToken, uint256 _ethFee, uint256 _galtFee)
    public
    ChargesFee(_galtToken, _ethFee, _galtFee)
    Ownable()
  {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol,
    string calldata _dataLink,
    uint256 _defaultBurnDuration
  )
    external
    payable
    returns (address)
  {
    _acceptPayment();

    // building contracts
    PPToken ppToken = new PPToken(
      _tokenName,
      _tokenSymbol
    );
    PPTokenController ppTokenController = new PPTokenController(ppToken, _defaultBurnDuration);

    // setting up contracts
    ppToken.setDataLink(_dataLink);
    ppToken.setMinter(msg.sender);
    ppToken.setController(address(ppTokenController));
    ppTokenController.setGeoDataManager(msg.sender);

    // transferring ownership
    ppTokenController.transferOwnership(msg.sender);
    ppToken.transferOwnership(msg.sender);

    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .addToken(address(ppToken));

    emit Build(address(ppToken), address(ppTokenController));

    return address(ppToken);
  }
}
