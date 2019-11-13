/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";
import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "./interfaces/IPrivatePropertyToken.sol";


contract PrivatePropertyTokenController is Ownable {
  event SetGeoDataManager(address indexed geoDataManager);
  event NewProposal(
    uint256 indexed proposalId,
    uint256 indexed tokenId,
    address indexed creator
  );
  event ProposalExecuted(uint256 indexed proposalId);
  event ProposalExecutionFailed(uint256 indexed proposalId);
  event ProposalApproval(
    uint256 indexed proposalId,
    uint256 indexed tokenId
  );

  struct Proposal {
    address creator;
    bool executed;
    bool tokenOwnerApproved;
    bool geoDataManagerApproved;
    bytes data;
    string description;
  }

  IERC721 public tokenContract;
  address public geoDataManager;
  uint256 internal idCounter;

  mapping(uint256 => Proposal) public proposals;

  constructor(IERC721 _tokenContract) public {
    tokenContract = _tokenContract;
  }

  // OWNER INTERFACE
  function setGeoDataManager(address _geoDataManager) external onlyOwner {
    geoDataManager = _geoDataManager;

    emit SetGeoDataManager(_geoDataManager);
  }

  // USER INTERFACE

  // @dev Assuming that a tokenId is always the first argument in a method
  function fetchTokenId(bytes memory _data) pure public returns (uint256 tokenId) {
    assembly {
      tokenId := mload(add(_data, 0x24))
    }

    require(tokenId > 0, "Failed fetching tokenId from encoded data");
  }

  function propose(
    bytes calldata _data,
    string calldata _description
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
    p.description = _description;

    emit NewProposal(proposalId, tokenId, msg.sender);
  }

  function approve(uint256 _proposalId) external {
    Proposal storage p = proposals[_proposalId];
    uint256 tokenId = fetchTokenId(p.data);

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

    execute(_proposalId);
  }

  function execute(uint256 _proposalId) public {
    Proposal storage p = proposals[_proposalId];

    require(p.tokenOwnerApproved == true, "Token owner approval required");
    require(p.geoDataManagerApproved == true, "GeoDataManager approval required");
    require(p.executed == false, "Already executed");

    p.executed = true;

    (bool ok,) = address(tokenContract)
      .call
      .gas(gasleft() - 35000)(p.data);

    if (ok == false) {
      emit ProposalExecutionFailed(_proposalId);
      p.executed = false;
    } else {
      emit ProposalExecuted(_proposalId);
    }
  }

  function nextId() internal returns (uint256) {
    idCounter += 1;
    return idCounter;
  }
}
