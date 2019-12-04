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


contract PPMarket is Marketable, Ownable, ChargesFee {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  bytes32 public constant GALT_FEE_KEY = bytes32("MARKET_GALT");
  bytes32 public constant ETH_FEE_KEY = bytes32("MARKET_ETH");

  struct SaleOrderDetails {
    address propertyToken;
    uint256[] propertyTokenIds;
    string dataLink;
  }

  IPPGlobalRegistry internal globalRegistry;

  // (propertyTokenAddress (ERC721) => (tokenId => mutex))
  mapping(uint256 => SaleOrderDetails) public saleOrderDetails;

  constructor(
    IPPGlobalRegistry _globalRegistry,
    uint256 _ethFee,
    uint256 _galtFee
  )
    public
    ChargesFee(_ethFee, _galtFee)
  {
    globalRegistry = _globalRegistry;
  }

  function createSaleOrder(
    address _propertyToken,
    uint256[] calldata _propertyTokenIds,
    address _operator,
    uint256 _ask,
    string calldata _dataLink,
    EscrowCurrency _currency,
    IERC20 _erc20address
  )
    external
    payable
    returns (uint256)
  {
    _performCreateSaleOrderChecks(_propertyToken, _propertyTokenIds);
    _acceptPayment(_propertyToken);

    uint256 id = _createSaleOrder(
      _operator,
      _ask,
      _currency,
      _erc20address
    );

    SaleOrderDetails storage details = saleOrderDetails[id];

    details.propertyToken = _propertyToken;
    details.propertyTokenIds = _propertyTokenIds;
    details.dataLink = _dataLink;

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

  // INTERNAL

  function _galtToken() internal view returns (IERC20) {
    return IERC20(globalRegistry.getGaltTokenAddress());
  }

  // Overrides ChargesFee._acceptPayment() and accepts an additional property owner fee along with the protocol fee
  function _acceptPayment(address _propertyToken) internal {
    address payable controller = IPPToken(_propertyToken).controller();

    if (msg.value == 0) {
      _galtToken().transferFrom(msg.sender, address(this), galtFee);

      uint256 propertyOwnerFee = IPPTokenController(controller).fees(GALT_FEE_KEY);
      _galtToken().transferFrom(msg.sender, controller, propertyOwnerFee);
    } else {
      uint256 propertyOwnerFee = IPPTokenController(controller).fees(ETH_FEE_KEY);
      uint256 totalFee = ethFee.add(propertyOwnerFee);

      require(msg.value == totalFee, "Invalid fee");

      controller.transfer(propertyOwnerFee);
    }
  }

  // GETTERS

  function getSaleOrderDetails(uint256 _rId) external view returns (
    uint256[] memory propertyTokenIds,
    address propertyToken,
    string memory dataLink
  )
  {
    return (saleOrderDetails[_rId].propertyTokenIds, saleOrderDetails[_rId].propertyToken, saleOrderDetails[_rId].dataLink);
  }
}
