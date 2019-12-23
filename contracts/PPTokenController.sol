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
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IPPToken.sol";
import "./interfaces/IPPTokenController.sol";
import "./interfaces/IPPGlobalRegistry.sol";


contract PPTokenController is IPPTokenController, Ownable {
  using SafeMath for uint256;
  using SafeERC20 for IERC20;

  uint256 public constant VERSION = 3;

  bytes32 public constant PROPOSAL_GALT_FEE_KEY = bytes32("CONTROLLER_PROPOSAL_GALT");
  bytes32 public constant PROPOSAL_ETH_FEE_KEY = bytes32("CONTROLLER_PROPOSAL_ETH");

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

  IPPGlobalRegistry public globalRegistry;
  IPPToken public tokenContract;
  address public geoDataManager;
  address public feeManager;
  address public feeCollector;
  address public minter;
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

  constructor(IPPGlobalRegistry _globalRegistry, IPPToken _tokenContract, uint256 _defaultBurnTimeoutDuration) public {
    require(_defaultBurnTimeoutDuration > 0, "Invalid burn timeout duration");

    defaultBurnTimeoutDuration = _defaultBurnTimeoutDuration;
    tokenContract = _tokenContract;
    globalRegistry = _globalRegistry;
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

  function setFeeCollector(address _feeCollector) external onlyOwner {
    feeCollector = _feeCollector;

    emit SetFeeCollector(_feeCollector);
  }

  function setMinter(address _minter) external onlyOwner {
    minter = _minter;

    emit SetMinter(_minter);
  }

  function setBurner(address _burner) external onlyOwner {
    burner = _burner;

    emit SetBurner(_burner);
  }

  function withdrawErc20(address _tokenAddress, address _to) external {
    require(msg.sender == feeCollector, "Missing permissions");

    uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));

    IERC20(_tokenAddress).transfer(_to, balance);

    emit WithdrawErc20(_to, _tokenAddress, balance);
  }

  function withdrawEth(address payable _to) external {
    require(msg.sender == feeCollector, "Missing permissions");

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

  // MINTER INTERFACE
  function mint(address _to) external {
    require(msg.sender == minter, "Only minter allowed");

    uint256 _tokenId = tokenContract.mint(_to);

    emit Mint(_to, _tokenId);
  }

  // CONTROLLER INTERFACE

  function setInitialDetails(
    uint256 _privatePropertyId,
    IPPToken.TokenType _tokenType,
    IPPToken.AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external
  {
    require(msg.sender == minter, "Only Minter allowed");
    // Will REVERT if there is no owner assigned to the token
    tokenContract.ownerOf(_privatePropertyId);

    uint256 setupStage = tokenContract.getSetupStage(_privatePropertyId);
    require(setupStage == uint256(PropertyInitialSetupStage.PENDING), "Requires PENDING setup stage");

    tokenContract.setDetails(_privatePropertyId, _tokenType, _areaSource, _area, _ledgerIdentifier, _humanAddress, _dataLink);

    tokenContract.incrementSetupStage(_privatePropertyId);
  }

  function setInitialContour(
    uint256 _privatePropertyId,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external
  {
    require(msg.sender == minter, "Only Minter allowed");

    uint256 setupStage = tokenContract.getSetupStage(_privatePropertyId);

    require(setupStage == uint256(PropertyInitialSetupStage.DETAILS), "Requires DETAILS setup stage");

    tokenContract.setContour(_privatePropertyId, _contour, _highestPoint);

    tokenContract.incrementSetupStage(_privatePropertyId);
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
    payable
  {
    address msgSender = msg.sender;
    uint256 tokenId = fetchTokenId(_data);
    uint256 proposalId = _nextId();

    Proposal storage p = proposals[proposalId];

    if (msgSender == geoDataManager) {
      p.geoDataManagerApproved = true;
    } else if (msgSender == tokenContract.ownerOf(tokenId)) {
      _acceptProposalFee();
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

    if (msg.sender == geoDataManager) {
      require(p.geoDataManagerApproved == true, "Only own proposals can be cancelled");
    } else if (msg.sender == tokenContract.ownerOf(tokenId)) {
      require(p.tokenOwnerApproved == true, "Only own proposals can be cancelled");
    } else {
      revert("Missing permissions");
    }

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

    tokenContract.burn(_tokenId);

    emit BurnTokenByTimeout(_tokenId);
  }

  // @dev Assuming that a tokenId is always the first argument in a method
  function fetchTokenId(bytes memory _data) public pure returns (uint256 tokenId) {
    assembly {
      tokenId := mload(add(_data, 0x24))
    }

    require(tokenId > 0, "Failed fetching tokenId from encoded data");
  }

  // INTERNAL

  function _nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }

  function _galtToken() internal view returns (IERC20) {
    return IERC20(globalRegistry.getGaltTokenAddress());
  }

  function _acceptProposalFee() internal {
    if (msg.value == 0) {
      _galtToken().transferFrom(msg.sender, address(this), fees[PROPOSAL_GALT_FEE_KEY]);
    } else {
      require(msg.value == fees[PROPOSAL_ETH_FEE_KEY], "Invalid fee");
    }
  }
}
