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
import "./Donatable.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PrivatePropertyFactory is Ownable, Donatable {
  event Build(address token);

  PrivatePropertyGlobalRegistry public registry;
  IERC20 public galtToken;

  uint256 public ethFee;
  uint256 public galtFee;

  constructor(address _galtToken) public Ownable() {
    galtToken = IERC20(_galtToken);
  }

  // OWNER INTERFACE

  function setRegistry(PrivatePropertyGlobalRegistry _registry) external onlyOwner {
    registry = _registry;
  }

  function setEthFee(uint256 _ethFee) external onlyOwner {
    ethFee = _ethFee;
  }

  function setGaltFee(uint256 _galtFee) external onlyOwner {
    galtFee = _galtFee;
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol
  )
    external
    payable
    returns (address)
  {
    _acceptPayment();

    PrivatePropertyToken property = new PrivatePropertyToken(
      _tokenName,
      _tokenSymbol
    );

    property.setMinter(msg.sender);
    property.setGeoDataManager(msg.sender);
    property.transferOwnership(msg.sender);

    registry.add(address(property));

    emit Build(address(property));

    return address(property);
  }

  // INTERNAL

  function _acceptPayment() internal {
    if (msg.value == 0) {
      require(galtToken.transferFrom(msg.sender, address(this), galtFee) == true, "Failed to transfer GALT tokens");
    } else {
      require(msg.value == ethFee, "Fee and msg.value not equal");
    }
  }
}
