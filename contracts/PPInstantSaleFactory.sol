/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/math/SafeMath.sol";
import "@galtproject/libs/contracts/traits/Marketable.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPTokenController.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPToken.sol";
import "./traits/ChargesFee.sol";
import "./PPInstantSale.sol";


contract PPInstantSaleFactory {
  using SafeMath for uint256;

  event NewPPInstantSaleContract(address instantSaleContract);

  address public globalRegistry;
  uint256 public protocolEthFee;
  address payable public protocolFeeBeneficiary;

  constructor(
    address _globalRegistry,
    uint256 _protocolEthFee,
    address payable _protocolFeeBeneficiary
  )
    public
  {
    globalRegistry = _globalRegistry;
    protocolEthFee = _protocolEthFee;
    protocolFeeBeneficiary = _protocolFeeBeneficiary;
  }

  function build(
    uint256 _marketOrderId,
    address payable _saleBeneficiary
  )
    external
    returns (PPInstantSale)
  {
    PPInstantSale instantSale = new PPInstantSale(
      globalRegistry,
      _marketOrderId,
      protocolEthFee,
      protocolFeeBeneficiary,
      _saleBeneficiary
    );

    instantSale.transferOwnership(msg.sender);

    emit NewPPInstantSaleContract(address(instantSale));

    return instantSale;
  }
}
