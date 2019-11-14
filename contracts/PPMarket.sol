/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "@galtproject/libs/contracts/traits/Marketable.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPToken.sol";
import "./ChargesFee.sol";


contract PPMarket is Marketable, Ownable, ChargesFee {
  struct SaleOrderDetails {
    address propertyToken;
    uint256[] propertyTokenIds;
    string dataAddress;
  }

  IPPGlobalRegistry internal globalRegistry;

  // (propertyTokenAddress (ERC721) => (tokenId => mutex))
  mapping(uint256 => SaleOrderDetails) public saleOrderDetails;

  constructor(
    IPPGlobalRegistry _globalRegistry,
    address _galtToken,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public

    ChargesFee(_galtToken, _ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
  }

  function createSaleOrder(
    address _propertyToken,
    uint256[] calldata _propertyTokenIds,
    address _operator,
    uint256 _ask,
    string calldata _dataAddress,
    EscrowCurrency _currency,
    IERC20 _erc20address
  )
    external
    payable
    returns (uint256)
  {
    _acceptPayment();
    _performCreateSaleOrderChecks(_propertyToken, _propertyTokenIds);

    uint256 id = _createSaleOrder(
      _operator,
      _ask,
      _currency,
      _erc20address
    );

    SaleOrderDetails storage details = saleOrderDetails[id];

    details.propertyToken = _propertyToken;
    details.propertyTokenIds = _propertyTokenIds;
    details.dataAddress = _dataAddress;

    return id;
  }

  function closeSaleOrder(
    uint256 _orderId
  )
    external
  {
    _closeSaleOrder(_orderId);
  }

  function _performCreateSaleOrderChecks(
    address _propertyToken,
    uint256[] memory _propertyTokenIds
  )
    internal
    view
  {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(_propertyToken);

    uint256 len = _propertyTokenIds.length;
    uint256 tokenId;

    for (uint256 i = 0; i < len; i++) {
      tokenId = _propertyTokenIds[i];
      require(IPPToken(_propertyToken).exists(tokenId), "Property token with the given ID doesn't exist");
      require(IERC721(_propertyToken).ownerOf(tokenId) == msg.sender, "Sender should own the token");
    }
  }

  // GETTERS

  function getSaleOrderDetails(uint256 _rId) external view returns (
    uint256[] memory propertyTokenIds,
    address propertyToken,
    string memory dataAddress
  )
  {
    return (saleOrderDetails[_rId].propertyTokenIds, saleOrderDetails[_rId].propertyToken, saleOrderDetails[_rId].dataAddress);
  }
}
