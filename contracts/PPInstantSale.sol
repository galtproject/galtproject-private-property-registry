/*
 * Copyright ©️ 2019 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2019 Galt•Core Blockchain Company
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
import "./PPMarket.sol";


contract PPInstantSale is Ownable {
  using SafeERC20 for IERC20;
  using SafeMath for uint256;

  uint256 public constant VERSION = 1;

  bytes32 public constant TOKEN_CONTRACT_OWNER_ETH_FEE_SHARE = bytes32("INSTANT_SALE_SHARE_ETH");
  uint256 internal constant PCT_BASE = 100 ether;

  event SetPromoCode(bytes32 indexed promoCodeHash, address indexed beneficiary, uint256 discountPct, uint256 referralFeePct);
  event DisablePromoCode(bytes32 indexed promoCodeHash);
  event Purchase(
    address buyer,
    uint256 price,
    uint256 priceWithDiscount,
    uint256 protocolReward,
    uint256 tokenContractReward,
    uint256 referralReward
  );

  struct PromoCode {
    bool active;
    address payable beneficiary;
    uint256 discountPct;
    uint256 referralFeePct;
  }

  IPPGlobalRegistry public globalRegistry;
  PPMarket public marketContract;
  address public tokenContract;
  uint256 public marketOrderId;
  uint256[] public tokenIds;
  uint256 public protocolFee;
  address payable public protocolFeeBeneficiary;
  address payable public saleBeneficiary;

  // hash => details
  mapping(bytes32 => PromoCode) internal promoCodes;

  constructor(
    address _globalRegistry,
    uint256 _marketOrderId,
    uint256 _protocolFee,
    address payable _protocolFeeBeneficiary,
    address payable _saleBeneficiary
  )
    public
  {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
    marketContract = PPMarket(IPPGlobalRegistry(_globalRegistry).getPPMarketAddress());

    // checks
    marketContract.requireValidEthOrder(_marketOrderId);

    (tokenIds, tokenContract,) = marketContract.getSaleOrderDetails(_marketOrderId);
    marketOrderId = _marketOrderId;
    protocolFee = _protocolFee;
    protocolFeeBeneficiary = _protocolFeeBeneficiary;
    saleBeneficiary = _saleBeneficiary;
  }

  function setPromoCode(
    bytes32 _promoCodeHash,
    address payable _beneficiary,
    uint256 _discountPct,
    uint256 _referralFeePct,
    bool _active
  )
    external
    onlyOwner
  {
    require(_discountPct < PCT_BASE, "Invalid discount value");
    require(_referralFeePct < PCT_BASE, "Invalid referral fee value");
    PromoCode storage promoCode = promoCodes[_promoCodeHash];

    promoCode.beneficiary = _beneficiary;
    promoCode.discountPct = _discountPct;
    promoCode.referralFeePct = _referralFeePct;
    promoCode.active = _active;

    emit SetPromoCode(_promoCodeHash, _beneficiary, _discountPct, _referralFeePct);
  }

  function disablePromoCode(bytes32 _promoCodeHash) external onlyOwner {
    promoCodes[_promoCodeHash].active = false;

    emit DisablePromoCode(_promoCodeHash);
  }

  function buy(bool _usePromoCode, string calldata _promoCode) external payable {
    bytes32 promoCodeHash;

    if (_usePromoCode == true) {
      promoCodeHash = keccak256(abi.encodePacked(_promoCode));
      require(promoCodes[promoCodeHash].active == true, "Invalid promo code");
      require(promoCodes[promoCodeHash].beneficiary != address(0), "Invalid referral beneficiary");
    }

    uint256 total = priceWithDiscount(promoCodeHash);

    require(msg.value == total, "Invalid payment");

    address payable referral = promoCodes[promoCodeHash].beneficiary;
    uint256 currentProtocolEthReward = protocolEthReward(total);
    uint256 currentTokenContractOwnerReward = tokenContractOwnerEthReward(total);

    uint256 currentReferralReward;

    if (_usePromoCode == true) {
      currentReferralReward = referralEthReward(total, promoCodeHash);
    }

    protocolFeeBeneficiary.transfer(currentProtocolEthReward);
    address(_tokenController()).transfer(currentTokenContractOwnerReward);
    if (referral != address(0)) {
      referral.transfer(currentReferralReward);
    }

    uint256 remaining = total - currentProtocolEthReward - currentTokenContractOwnerReward - currentReferralReward;
    saleBeneficiary.transfer(remaining);

    address tokensOwner = IERC721(tokenContract).ownerOf(tokenIds[0]);

    uint256 len = tokenIds.length;
    for (uint256 i = 0; i < len; i++) {
      IERC721(tokenContract).transferFrom(tokensOwner, msg.sender, tokenIds[i]);
    }

    emit Purchase(
      msg.sender,
      price(),
      total,
      currentProtocolEthReward,
      currentTokenContractOwnerReward,
      currentReferralReward
    );
  }

  // INTERNAL

  function _tokenController() internal view returns (IPPTokenController) {
    return IPPTokenController(IPPToken(tokenContract).controller());
  }

  // GETTERS

  function getTokenIds() external view returns (uint256[] memory) {
    return tokenIds;
  }

  function price() public view returns (uint256) {
    return marketContract.getSaleOrderAsk(marketOrderId);
  }

  function priceWithDiscount(bytes32 _promoCode) public view returns (uint256) {
    uint256 _price = price();
    uint256 discount = 0;
    PromoCode storage promoCode = promoCodes[_promoCode];

    if (promoCode.active) {
      discount = (_price * promoCodes[_promoCode].discountPct / PCT_BASE);
    }

    return _price - discount;
  }

  function tokenContractOwnerEthFeePct() public view returns (uint256) {
    return _tokenController().fees(TOKEN_CONTRACT_OWNER_ETH_FEE_SHARE);
  }

  function tokenContractOwnerEthReward(uint256 _priceWithDiscount) public view returns (uint256) {
    return _priceWithDiscount * tokenContractOwnerEthFeePct() / PCT_BASE;
  }

  function protocolEthReward(uint256 _priceWithDiscount) public view returns (uint256) {
    return _priceWithDiscount * protocolFee / PCT_BASE;
  }

  function referralEthReward(uint256 _priceWithDiscount, bytes32 _promoCode) public view returns (uint256) {
    return _priceWithDiscount * promoCodes[_promoCode].referralFeePct / PCT_BASE;
  }
}
