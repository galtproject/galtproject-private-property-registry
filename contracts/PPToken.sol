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
import "@openzeppelin/contracts/token/ERC721/ERC721Full.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "@openzeppelin/contracts/drafts/Strings.sol";
import "./interfaces/IPPToken.sol";
import "@galtproject/core/contracts/CheckpointableId.sol";


contract PPToken is IPPToken, ERC721Full, Ownable, CheckpointableId {
  using SafeMath for uint256;

  uint256 public constant VERSION = 2;

  uint256 public tokenIdCounter;
  uint256 public totalAreaSupply;
  address payable public controller;
  string public contractDataLink;
  string public baseURI;

  bytes32[] public legalAgreementIpfsHashList;

  // tokenId => details
  mapping(uint256 => Property) internal properties;
  // tokenId => timestamp
  mapping(uint256 => uint256) public propertyCreatedAt;
  // tokenId => (key => value)
  mapping(uint256 => mapping(bytes32 => bytes32)) public propertyExtraData;
  // key => value
  mapping(bytes32 => bytes32) public extraData;

  modifier onlyController() {
    require(msg.sender == controller, "Only controller allowed");

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

  function setContractDataLink(string calldata _dataLink) external onlyOwner {
    contractDataLink = _dataLink;

    emit SetContractDataLink(_dataLink);
  }

  function setLegalAgreementIpfsHash(bytes32 _legalAgreementIpfsHash) external onlyOwner {
    legalAgreementIpfsHashList.push(_legalAgreementIpfsHash);

    emit SetLegalAgreementIpfsHash(_legalAgreementIpfsHash);
  }

  function setController(address payable _controller) external onlyOwner {
    controller = _controller;

    emit SetController(_controller);
  }

  // CONTROLLER INTERFACE

  function mint(address _to) external onlyController returns(uint256) {
    uint256 id = nextTokenId();

    emit Mint(_to, id);

    _mint(_to, id);

    propertyCreatedAt[id] = block.timestamp;

    return id;
  }

  function incrementSetupStage(uint256 _tokenId) external onlyController {
    properties[_tokenId].setupStage += 1;
  }

  function setDetails(
    uint256 _tokenId,
    TokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external
    onlyController
  {
    Property storage p = properties[_tokenId];

    p.tokenType = _tokenType;
    p.ledgerIdentifier = _ledgerIdentifier;
    p.humanAddress = _humanAddress;
    p.dataLink = _dataLink;

    _setArea(_tokenId, _area, _areaSource);

    emit SetDetails(msg.sender, _tokenId);
  }

  function setContour(
    uint256 _tokenId,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external
    onlyController
  {
    Property storage p = properties[_tokenId];

    p.contour = _contour;
    p.highestPoint = _highestPoint;

    emit SetContour(msg.sender, _tokenId);
  }

  function setHumanAddress(uint256 _tokenId, string calldata _humanAddress) external onlyController {
    properties[_tokenId].humanAddress = _humanAddress;

    emit SetHumanAddress(_tokenId, _humanAddress);
  }

  function _setArea(uint256 _tokenId, uint256 _area, AreaSource _areaSource) internal {
    if (_area >= properties[_tokenId].area) {
      totalAreaSupply = totalAreaSupply.add(_area - properties[_tokenId].area);
    } else {
      totalAreaSupply = totalAreaSupply.sub(properties[_tokenId].area - _area);
    }

    properties[_tokenId].area = _area;
    properties[_tokenId].areaSource = _areaSource;

    _updateValueAtNow(_cachedBalances[_tokenId], _area);
    _updateValueAtNow(_cachedTotalSupply, totalAreaSupply);

    emit SetArea(_tokenId, _area, _areaSource);
  }

  function setArea(uint256 _tokenId, uint256 _area, AreaSource _areaSource) external onlyController {
    _setArea(_tokenId, _area, _areaSource);
  }

  function setLedgerIdentifier(uint256 _tokenId, bytes32 _ledgerIdentifier) external onlyController {
    properties[_tokenId].ledgerIdentifier = _ledgerIdentifier;

    emit SetLedgerIdentifier(_tokenId, _ledgerIdentifier);
  }

  function setDataLink(uint256 _tokenId, string calldata _dataLink) external onlyController {
    properties[_tokenId].dataLink = _dataLink;

    emit SetDataLink(_tokenId, _dataLink);
  }

  function setVertexRootHash(uint256 _tokenId, bytes32 _vertexRootHash) external onlyController {
    properties[_tokenId].vertexRootHash = _vertexRootHash;

    emit SetVertexRootHash(_tokenId, _vertexRootHash);
  }

  function setVertexStorageLink(uint256 _tokenId, string calldata _vertexStorageLink) external onlyController {
    properties[_tokenId].vertexStorageLink = _vertexStorageLink;

    emit SetVertexStorageLink(_tokenId, _vertexStorageLink);
  }

  function setExtraData(bytes32 _key, bytes32 _value) external onlyController {
    extraData[_key] = _value;

    emit SetExtraData(_key, _value);
  }

  function setPropertyExtraData(uint256 _tokenId, bytes32 _key, bytes32 _value) external onlyController {
    propertyExtraData[_tokenId][_key] = _value;

    emit SetPropertyExtraData(_tokenId, _key, _value);
  }

  function burn(uint256 _tokenId) external onlyController {
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

  function getAreaAt(uint256 _tokenId, uint256 _block) external view returns (uint256) {
    return _getValueAt(_cachedBalances[_tokenId], _block);
  }

  function getTotalAreaSupplyAt(uint256 _block) external view returns (uint256) {
    return _getValueAt(_cachedTotalSupply, _block);
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

  function getVertexRootHash(uint256 _tokenId) external view returns (bytes32) {
    return properties[_tokenId].vertexRootHash;
  }

  function getVertexStorageLink(uint256 _tokenId) external view returns (string memory) {
    return properties[_tokenId].vertexStorageLink;
  }

  function getSetupStage(uint256 _tokenId) external view returns(uint256) {
    return properties[_tokenId].setupStage;
  }

  function getDetails(uint256 _tokenId)
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
      uint256 setupStage,
      bytes32 vertexRootHash,
      string memory vertexStorageLink
    )
  {
    Property storage p = properties[_tokenId];

    return (
      p.tokenType,
      p.contour,
      p.highestPoint,
      p.areaSource,
      p.area,
      p.ledgerIdentifier,
      p.humanAddress,
      p.dataLink,
      p.setupStage,
      p.vertexRootHash,
      p.vertexStorageLink
    );
  }
}
