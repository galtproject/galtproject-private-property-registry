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
import "../mediators/PPHomeMediator.sol";
import "../mediators/PPMediatorFactory.sol";


/**
 * Builds Bridged Token  contract and registers it in PPGlobalRegistry
 */
contract PPBridgedTokenFactory is Ownable, ChargesFee {
  event NewPPBridgedToken(address token, address mediator);
  event SetHomeMediatorFactory(address factory);

  IPPGlobalRegistry public globalRegistry;
  PPMediatorFactory public homeMediatorFactory;

  constructor(
    address _globalRegistry,
    address _homeMediatorFactory,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
    Ownable()
  {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
    homeMediatorFactory = PPMediatorFactory(_homeMediatorFactory);
  }

  function setHomeMediatorFactory(address _factory) external onlyOwner {
    homeMediatorFactory = PPMediatorFactory(_factory);

    emit SetHomeMediatorFactory(_factory);
  }

  // USER INTERFACE

  function build(
    string calldata _tokenName,
    string calldata _tokenSymbol,
    string calldata _dataLink,
    address _owner,
    address _mediatorContractOnOtherSide,
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

    address ppTokenAddress = address(ppToken);
    address ppMediatorAddress = homeMediatorFactory.build(_owner, ppTokenAddress, _mediatorContractOnOtherSide);

    // setting up contracts
    ppToken.setContractDataLink(_dataLink);
    ppToken.setLegalAgreementIpfsHash(_legalAgreementIpfsHash);
    ppToken.setHomeMediator(ppMediatorAddress);

    // transferring ownership
    ppToken.transferOwnership(_owner);

    IOwnedUpgradeabilityProxy(ppMediatorAddress).transferProxyOwnership(_owner);

    // registering token in registry
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress())
      .addToken(ppTokenAddress);

    emit NewPPBridgedToken(ppTokenAddress, ppMediatorAddress);

    return ppTokenAddress;
  }

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    revert("GALT payment doesn't supported");
  }
}
