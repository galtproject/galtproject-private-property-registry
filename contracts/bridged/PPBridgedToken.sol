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
import "./interfaces/IPPBridgedToken.sol";


contract PPBridgedToken is IPPBridgedToken, ERC721Full, Ownable {

  uint256 public constant VERSION = 1;

  address public homeMediator;
  uint256 public tokenIdCounter;
  string public contractDataLink;
  string public baseURI;

  bytes32[] public legalAgreementIpfsHashList;

  // tokenId => details
  mapping(uint256 => Property) internal properties;
  // tokenId => timestamp
  mapping(uint256 => uint256) public propertyCreatedAt;
  // key => value
  mapping(bytes32 => bytes32) public extraData;

  modifier onlyMediator() {
    require(msg.sender == homeMediator, "Only bridgeMediator allowed");

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

  function setHomeMediator(address _homeMediator) external onlyOwner {
    homeMediator = _homeMediator;

    emit SetHomeMediator(_homeMediator);
  }

  function setExtraData(bytes32 _key, bytes32 _value) external onlyOwner {
    extraData[_key] = _value;

    emit SetExtraData(_key, _value);
  }

  // BRIDGE MEDIATOR INTERFACE

  function mint(
    address _to,
    uint256 _tokenId,
    TokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external
    onlyMediator
  {
    _mint(_to, _tokenId);

    emit Mint(_to, _tokenId);

    propertyCreatedAt[_tokenId] = block.timestamp;

    delete properties[_tokenId];

    Property storage p = properties[_tokenId];

    p.tokenType = _tokenType;
    p.areaSource = _areaSource;
    p.area = _area;
    p.ledgerIdentifier = _ledgerIdentifier;
    p.humanAddress = _humanAddress;
    p.dataLink = _dataLink;
    p.contour = _contour;
    p.highestPoint = _highestPoint;
  }

  function recover(
    address _to,
    uint256 _tokenId
  )
    external
    onlyMediator
  {
    _mint(_to, _tokenId);

    emit Mint(_to, _tokenId);
    emit Recover(_to, _tokenId);
  }

  function burn(uint256 _tokenId) external onlyMediator {
    address owner = ownerOf(_tokenId);

    _burn(owner, _tokenId);

    emit Burn(owner, _tokenId);
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
      string memory dataLink
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
      p.dataLink
    );
  }
}
