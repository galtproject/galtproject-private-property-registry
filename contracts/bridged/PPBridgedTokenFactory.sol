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
import "./PPBridgedToken.sol";
import "../interfaces/IPPTokenRegistry.sol";
import "../traits/ChargesFee.sol";
import "../interfaces/IPPGlobalRegistry.sol";


/**
 * Builds Token and registers it in PrivatePropertyGlobalRegistry
 */
contract PPBridgedTokenFactory is Ownable, ChargesFee {
  event Build(address token);

  IPPGlobalRegistry public globalRegistry;

  constructor(
    address _globalRegistry,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
    Ownable()
  {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol,
    string calldata _dataLink,
    bytes32 _legalAgreementIpfsHash
  )
    external
    payable
    returns (address)
  {
    _acceptPayment();

    // building contracts
    PPBridgedToken ppToken = new PPBridgedToken(
      _tokenName,
      _tokenSymbol
    );

    // setting up contracts
    ppToken.setContractDataLink(_dataLink);
    ppToken.setLegalAgreementIpfsHash(_legalAgreementIpfsHash);

    // transferring ownership
    ppToken.transferOwnership(msg.sender);

    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .addToken(address(ppToken));

    emit Build(address(ppToken));

    return address(ppToken);
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    revert("GALT payment doesn't supported");
  }
}
