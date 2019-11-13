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
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "./PrivatePropertyToken.sol";
import "./PrivatePropertyGlobalRegistry.sol";
import "./PrivatePropertyTokenController.sol";
import "./ChargesFee.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PrivatePropertyFactory is Ownable, ChargesFee {
  event Build(address token, address controller);
  event SetGlobalRegistry(address globalRegistry);

  PrivatePropertyGlobalRegistry public globalRegistry;

  constructor(address _globalRegistry, address _galtToken, uint256 _ethFee, uint256 _galtFee)
    public
    ChargesFee(_galtToken, _ethFee, _galtFee)
    Ownable()
  {
    globalRegistry = PrivatePropertyGlobalRegistry(_globalRegistry);
  }

  // OWNER INTERFACE

  function setGlobalRegistry(address _globalRegistry) external onlyOwner {
    globalRegistry = PrivatePropertyGlobalRegistry(_globalRegistry);
    emit SetGlobalRegistry(_globalRegistry);
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol,
    string calldata _dataLink
  )
    external
    payable
    returns (address)
  {
    _acceptPayment();

    // building contracts
    PrivatePropertyToken propertyToken = new PrivatePropertyToken(
      _tokenName,
      _tokenSymbol
    );
    PrivatePropertyTokenController propertyTokenController = new PrivatePropertyTokenController(propertyToken);

    // setting up contracts
    propertyToken.setDataLink(_dataLink);
    propertyToken.setMinter(msg.sender);
    propertyToken.setController(address(propertyTokenController));
    propertyTokenController.setGeoDataManager(msg.sender);

    // transferring ownership
    propertyTokenController.transferOwnership(msg.sender);
    propertyToken.transferOwnership(msg.sender);

    globalRegistry.add(address(propertyToken));

    emit Build(address(propertyToken), address(propertyTokenController));

    return address(propertyToken);
  }
}
