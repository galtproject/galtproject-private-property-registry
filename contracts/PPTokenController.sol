/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IPPToken.sol";
import "./interfaces/IPPTokenController.sol";


contract PPTokenController is IPPTokenController, Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  enum ProposalStatus {
    NULL,
    PENDING,
    APPROVED,
    EXECUTED,
    REJECTED,
    CANCELLED
  }

  struct Proposal {
    address creator;
    ProposalStatus status;
    bool tokenOwnerApproved;
    bool geoDataManagerApproved;
    bytes data;
    string dataLink;
  }

  IERC721 public tokenContract;
  address public geoDataManager;
  address public feeManager;
  address public burner;
  uint256 public defaultBurnTimeoutDuration;
  uint256 internal idCounter;

  mapping(uint256 => Proposal) public proposals;
  // tokenId => timeoutDuration (in seconds)
  mapping(uint256 => uint256) public burnTimeoutDuration;
  // tokenId => burnTimeoutAt
  mapping(uint256 => uint256) public burnTimeoutAt;
  // key => fee
  mapping(bytes32 => uint256) public fees;

  constructor(IERC721 _tokenContract, uint256 _defaultBurnTimeoutDuration) public {
    require(_defaultBurnTimeoutDuration > 0, "Invalid burn timeout duration");

    defaultBurnTimeoutDuration = _defaultBurnTimeoutDuration;

    tokenContract = _tokenContract;
  }

  function() external payable {
  }

  // CONTRACT OWNER INTERFACE

  function setGeoDataManager(address _geoDataManager) external onlyOwner {
    geoDataManager = _geoDataManager;

    emit SetGeoDataManager(_geoDataManager);
  }

  function setFeeManager(address _feeManager) external onlyOwner {
    feeManager = _feeManager;

    emit SetFeeManager(_feeManager);
  }

  function setBurner(address _burner) external onlyOwner {
    burner = _burner;

    emit SetBurner(_burner);
  }

  function withdrawErc20(address _tokenAddress, address _to) external {
    require(msg.sender == feeManager, "Missing permissions");

    uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));

    IERC20(_tokenAddress).transfer(_to, balance);

    emit WithdrawErc20(_to, _tokenAddress, balance);
  }

  function withdrawEth(address payable _to) external {
    require(msg.sender == feeManager, "Missing permissions");

    uint256 balance = address(this).balance;

    _to.transfer(balance);

    emit WithdrawEth(_to, balance);
  }

  function setFee(bytes32 _key, uint256 _value) external {
    require(msg.sender == feeManager, "Missing permissions");

    fees[_key] = _value;
    emit SetFee(_key, _value);
  }

  // BURNER INTERFACE

  function initiateTokenBurn(uint256 _tokenId) external {
    require(msg.sender == burner, "Only burner allowed");
    require(burnTimeoutAt[_tokenId] == 0, "Burn already initiated");
    require(tokenContract.ownerOf(_tokenId) != address(0), "Token doesn't exists");

    uint256 duration = burnTimeoutDuration[_tokenId];
    if (duration == 0) {
      duration = defaultBurnTimeoutDuration;
    }

    uint256 timeoutAt = block.timestamp.add(duration);
    burnTimeoutAt[_tokenId] = timeoutAt;

    emit InitiateTokenBurn(_tokenId, timeoutAt);
  }

  // TOKEN OWNER INTERFACE

  function setBurnTimeoutDuration(uint256 _tokenId, uint256 _duration) external {
    require(tokenContract.ownerOf(_tokenId) == msg.sender, "Only token owner allowed");
    require(_duration > 0, "Invalid timeout duration");

    burnTimeoutDuration[_tokenId] = _duration;

    emit SetBurnTimeout(_tokenId, _duration);
  }

  function cancelTokenBurn(uint256 _tokenId) external {
    require(burnTimeoutAt[_tokenId] != 0, "Burn not initiated");
    require(tokenContract.ownerOf(_tokenId) == msg.sender, "Only token owner allowed");

    burnTimeoutAt[_tokenId] = 0;

    emit CancelTokenBurn(_tokenId);
  }

  // COMMON INTERFACE

  function propose(
    bytes calldata _data,
    string calldata _dataLink
  )
    external
  {
    address msgSender = msg.sender;
    uint256 tokenId = fetchTokenId(_data);
    uint256 proposalId = nextId();

    Proposal storage p = proposals[proposalId];

    if (msgSender == geoDataManager) {
      p.geoDataManagerApproved = true;
    } else if (msgSender == tokenContract.ownerOf(tokenId)) {
      p.tokenOwnerApproved = true;
    } else {
      revert("Missing permissions");
    }

    p.creator = msgSender;
    p.data = _data;
    p.dataLink = _dataLink;
    p.status = ProposalStatus.PENDING;

    emit NewProposal(proposalId, tokenId, msg.sender);
  }

  function approve(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    uint256 tokenId = fetchTokenId(p.data);

    require(p.status == ProposalStatus.PENDING, "Expect PENDING status");

    if (p.geoDataManagerApproved == true) {
      require(msg.sender == tokenContract.ownerOf(tokenId), "Missing permissions");
      p.tokenOwnerApproved = true;
    } else if (p.tokenOwnerApproved == true) {
      require(msg.sender == geoDataManager, "Missing permissions");
      p.geoDataManagerApproved = true;
    } else {
      revert("Missing permissions");
    }

    emit ProposalApproval(_proposalId, tokenId);

    p.status = ProposalStatus.APPROVED;

    execute(_proposalId);
  }

  function reject(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    uint256 tokenId = fetchTokenId(p.data);

    require(p.status == ProposalStatus.PENDING, "Expect PENDING status");

    if (p.geoDataManagerApproved == true) {
      require(msg.sender == tokenContract.ownerOf(tokenId), "Missing permissions");
    } else if (p.tokenOwnerApproved == true) {
      require(msg.sender == geoDataManager, "Missing permissions");
    } else {
      revert("Missing permissions");
    }

    p.status = ProposalStatus.REJECTED;

    emit ProposalRejection(_proposalId, tokenId);
  }

  function cancel(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    uint256 tokenId = fetchTokenId(p.data);

    require(p.status == ProposalStatus.PENDING, "Expect PENDING status");

    require(msg.sender == tokenContract.ownerOf(tokenId), "Only token owner allowed");
    require(p.tokenOwnerApproved == true, "Only own proposal can be cancelled");

    p.status = ProposalStatus.CANCELLED;

    emit ProposalCancellation(_proposalId, tokenId);
  }

  // PERMISSIONLESS INTERFACE

  function execute(uint256 _proposalId) public {
    Proposal storage p = proposals[_proposalId];

    require(p.tokenOwnerApproved == true, "Token owner approval required");
    require(p.geoDataManagerApproved == true, "GeoDataManager approval required");
    require(p.status == ProposalStatus.APPROVED, "Expect APPROVED status");

    p.status = ProposalStatus.EXECUTED;

    (bool ok,) = address(tokenContract)
      .call
      .gas(gasleft().sub(50000))(p.data);

    if (ok == false) {
      emit ProposalExecutionFailed(_proposalId);
      p.status = ProposalStatus.APPROVED;
    } else {
      emit ProposalExecuted(_proposalId);
    }
  }

  function burnTokenByTimeout(uint256 _tokenId) external {
    require(burnTimeoutAt[_tokenId] != 0, "Timeout not set");
    require(block.timestamp > burnTimeoutAt[_tokenId], "Timeout has not passed yet");
    require(tokenContract.ownerOf(_tokenId) != address(0), "Token already burned");

    IPPToken(address(tokenContract)).burn(_tokenId);

    emit BurnTokenByTimeout(_tokenId);
  }

  // INTERNAL

  // @dev Assuming that a tokenId is always the first argument in a method
  function fetchTokenId(bytes memory _data) public pure returns (uint256 tokenId) {
    assembly {
      tokenId := mload(add(_data, 0x24))
    }

    require(tokenId > 0, "Failed fetching tokenId from encoded data");
  }

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }
}
