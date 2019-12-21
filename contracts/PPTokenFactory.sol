/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./traits/ChargesFee.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./PPToken.sol";
import "./PPTokenControllerFactory.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPTokenFactory is Ownable, ChargesFee {
  event Build(address token, address controller);
  event SetGlobalRegistry(address globalRegistry);

  IPPGlobalRegistry public globalRegistry;
  PPTokenControllerFactory public ppTokenControllerFactory;

  constructor(
    address _ppTokenControllerFactory,
    address _globalRegistry,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
    Ownable()
  {
    ppTokenControllerFactory = PPTokenControllerFactory(_ppTokenControllerFactory);
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol,
    string calldata _dataLink,
    uint256 _defaultBurnDuration,
    bytes32[] calldata _feeKeys,
    uint256[] calldata _feeValues,
    bytes32 _legalAgreementIpfsHash
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
    PPTokenController ppTokenController = ppTokenControllerFactory.build(globalRegistry, ppToken, _defaultBurnDuration);

    // setting up contracts
    ppToken.setDataLink(_dataLink);
    ppToken.setLegalAgreementIpfsHash(_legalAgreementIpfsHash);
    ppToken.setController(address(ppTokenController));
    ppTokenController.setMinter(msg.sender);
    ppTokenController.setGeoDataManager(msg.sender);

    ppTokenController.setFeeManager(address(this));

    for (uint256 i = 0; i < _feeKeys.length; i++) {
      ppTokenController.setFee(_feeKeys[i], _feeValues[i]);
    }

    ppTokenController.setFeeManager(msg.sender);

    // transferring ownership
    ppTokenController.transferOwnership(msg.sender);
    ppToken.transferOwnership(msg.sender);

    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .addToken(address(ppToken));

    emit Build(address(ppToken), address(ppTokenController));

    return address(ppToken);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(globalRegistry.getGaltTokenAddress());
  }
}
