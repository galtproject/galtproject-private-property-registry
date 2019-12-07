/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/drafts/Strings.sol";
import "./interfaces/IPPToken.sol";


contract PPToken is IPPToken, ERC721Full, Ownable {

  struct Property {
    PropertyInitialSetupStage setupStage;

    // (LAND_PLOT,BUILDING,ROOM) Type cannot be changed after token creation
    TokenType tokenType;
    // Geohash5z (x,y,z)
    uint256[] contour;
    // Meters above the sea
    int256 highestPoint;

    // USER_INPUT or CONTRACT
    AreaSource areaSource;
    // Calculated either by contract (for land plots and buildings) or by manual input
    // in sq. meters (1 sq. meter == 1 eth)
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;
  }

  uint256 public tokenIdCounter;
  address public minter;
  address payable public controller;
  string public tokenDataLink;
  string public baseURI;

  bytes32[] public legalAgreementIpfsHashList;

  // tokenId => details
  mapping(uint256 => Property) internal properties;
  // tokenId => timestamp
  mapping(uint256 => uint256) public propertyCreatedAt;

  modifier onlyMinter() {
    require(msg.sender == minter, "Only minter allowed");

    _;
  }

  constructor(string memory _name, string memory _symbol) public ERC721Full(_name, _symbol) {
    baseURI = "";
  }

  // OWNER INTERFACE

  function setBaseURI(string calldata _baseURI) external onlyOwner {
    baseURI = _baseURI;

    emit SetBaseURI(baseURI);
  }

  function setDataLink(string calldata _dataLink) external onlyOwner {
    tokenDataLink = _dataLink;

    emit SetDataLink(_dataLink);
  }

  function setLegalAgreementIpfsHash(bytes32 _legalAgreementIpfsHash) external onlyOwner {
    legalAgreementIpfsHashList.push(_legalAgreementIpfsHash);

    emit SetLegalAgreementIpfsHash(_legalAgreementIpfsHash);
  }

  function setMinter(address _minter) external onlyOwner {
    minter = _minter;

    emit SetMinter(_minter);
  }

  function setController(address payable _controller) external onlyOwner {
    controller = _controller;

    emit SetController(_controller);
  }

  //  MINTER INTERFACE

  function mint(address _to) public onlyMinter {
    uint256 id = nextTokenId();

    emit Mint(_to, id);

    _mint(_to, id);

    propertyCreatedAt[id] = block.timestamp;
  }

  // CONTROLLER INTERFACE

  function setDetails(
    uint256 _privatePropertyId,
    TokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external
  {
    Property storage p = properties[_privatePropertyId];

    if (msg.sender == minter) {
      // Will REVERT if there is no owner assigned to the token
      ownerOf(_privatePropertyId);

      require(p.setupStage == PropertyInitialSetupStage.PENDING, "Requires PENDING setup stage");
    } else {
      require(msg.sender == controller, "Only Controller allowed");
    }

    if (p.setupStage == PropertyInitialSetupStage.PENDING) {
      p.setupStage = PropertyInitialSetupStage.DETAILS;
    }

    p.tokenType = _tokenType;
    p.areaSource = _areaSource;
    p.area = _area;
    p.ledgerIdentifier = _ledgerIdentifier;
    p.humanAddress = _humanAddress;
    p.dataLink = _dataLink;

    emit SetDetails(msg.sender, _privatePropertyId);
  }

  function setContour(
    uint256 _privatePropertyId,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external
  {
    Property storage p = properties[_privatePropertyId];

    require(p.setupStage != PropertyInitialSetupStage.PENDING, "PENDING setup stage not allowed");

    if (msg.sender == minter) {
      require(p.setupStage == PropertyInitialSetupStage.DETAILS, "Requires DETAILS setup stage");
    } else {
      require(msg.sender == controller, "Only Controller allowed");
    }

    if (p.setupStage == PropertyInitialSetupStage.DETAILS) {
      p.setupStage = PropertyInitialSetupStage.DONE;
    }

    p.contour = _contour;
    p.highestPoint = _highestPoint;

    emit SetContour(msg.sender, _privatePropertyId);
  }

  function burn(uint256 _tokenId) external {
    require(msg.sender == controller, "Only controller allowed");

    address owner = ownerOf(_tokenId);

    delete properties[_tokenId];

    _burn(owner, _tokenId);

    emit Burn(owner, _tokenId);
  }

  // INTERNAL

  function nextTokenId() internal returns (uint256) {
    tokenIdCounter += 1;
    return tokenIdCounter;
  }

  // GETTERS

  /**
    * @dev Returns the URI for a given token ID. May return an empty string.
    *
    * If the token's URI is non-empty and a base URI was set (via
    * {_setBaseURI}), it will be added to the token ID's URI as a prefix.
    *
    * Reverts if the token ID does not exist.
    */
  function tokenURI(uint256 _tokenId) external view returns (string memory) {
    require(_exists(_tokenId), "PPToken: URI query for nonexistent token");

    // abi.encodePacked is being used to concatenate strings
    return string(abi.encodePacked(baseURI, Strings.fromUint256(_tokenId)));
  }

  function getLastLegalAgreementIpfsHash() external view returns (bytes32) {
    return legalAgreementIpfsHashList[legalAgreementIpfsHashList.length - 1];
  }

  function tokensOfOwner(address _owner) external view returns (uint256[] memory) {
    return _tokensOfOwner(_owner);
  }

  function exists(uint256 _tokenId) external view returns (bool) {
    return _exists(_tokenId);
  }

  function getType(uint256 _tokenId) external view returns (TokenType) {
    return properties[_tokenId].tokenType;
  }

  function getContour(uint256 _tokenId) external view returns (uint256[] memory) {
    return properties[_tokenId].contour;
  }

  function getHighestPoint(uint256 _tokenId) external view returns (int256) {
    return properties[_tokenId].highestPoint;
  }

  function getHumanAddress(uint256 _tokenId) external view returns (string memory) {
    return properties[_tokenId].humanAddress;
  }

  function getArea(uint256 _tokenId) external view returns (uint256) {
    return properties[_tokenId].area;
  }

  function getAreaSource(uint256 _tokenId) external view returns (AreaSource) {
    return properties[_tokenId].areaSource;
  }

  function getLedgerIdentifier(uint256 _tokenId) external view returns (bytes32) {
    return properties[_tokenId].ledgerIdentifier;
  }

  function getDataLink(uint256 _tokenId) external view returns (string memory) {
    return properties[_tokenId].dataLink;
  }

  function getContourLength(uint256 _tokenId) external view returns (uint256) {
    return properties[_tokenId].contour.length;
  }

  function getDetails(uint256 _privatePropertyId)
    external
    view
    returns (
      TokenType tokenType,
      uint256[] memory contour,
      int256 highestPoint,
      AreaSource areaSource,
      uint256 area,
      bytes32 ledgerIdentifier,
      string memory humanAddress,
      string memory dataLink,
      PropertyInitialSetupStage setupStage
    )
  {
    Property storage p = properties[_privatePropertyId];

    return (
      p.tokenType,
      p.contour,
      p.highestPoint,
      p.areaSource,
      p.area,
      p.ledgerIdentifier,
      p.humanAddress,
      p.dataLink,
      p.setupStage
    );
  }
}
