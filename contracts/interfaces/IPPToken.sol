/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";

pragma solidity ^0.5.13;


contract IPPToken is IERC721 {
  event SetBaseURI(string baseURI);
  event SetDataLink(string indexed dataLink);
  event SetLegalAgreementIpfsHash(bytes32 legalAgreementIpfsHash);
  event SetController(address indexed controller);
  event SetDetails(
    address indexed geoDataManager,
    uint256 indexed privatePropertyId
  );
  event SetContour(
    address indexed geoDataManager,
    uint256 indexed privatePropertyId
  );
  event SetExtraData(bytes32 indexed key, bytes32 value);
  event SetPropertyExtraData(uint256 indexed propertyId, bytes32 indexed key, bytes32 value);
  event Mint(address indexed to, uint256 indexed privatePropertyId);
  event Burn(address indexed from, uint256 indexed privatePropertyId);

  enum AreaSource {
    USER_INPUT,
    CONTRACT
  }

  enum TokenType {
    NULL,
    LAND_PLOT,
    BUILDING,
    ROOM,
    PACKAGE
  }

  struct Property {
    uint256 setupStage;

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

  // PERMISSIONED METHODS

  function setDataLink(string calldata _dataLink) external;
  function setLegalAgreementIpfsHash(bytes32 _legalAgreementIpfsHash) external;
  function setController(address payable _controller) external;
  function setDetails(
    uint256 _privatePropertyId,
    TokenType _tokenType,
    AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink
  )
    external;

  function setContour(
    uint256 _privatePropertyId,
    uint256[] calldata _contour,
    int256 _highestPoint
  )
    external;

  function incrementSetupStage(uint256 _privatePropertyId) external;

  function mint(address _to) external returns (uint256);
  function burn(uint256 _tokenId) external;

  // GETTERS
  function controller() external view returns (address payable);

  function tokensOfOwner(address _owner) external view returns (uint256[] memory);
  function exists(uint256 _tokenId) external view returns (bool);
  function getType(uint256 _tokenId) external view returns (TokenType);
  function getContour(uint256 _tokenId) external view returns (uint256[] memory);
  function getContourLength(uint256 _tokenId) external view returns (uint256);
  function getHighestPoint(uint256 _tokenId) external view returns (int256);
  function getHumanAddress(uint256 _tokenId) external view returns (string memory);
  function getArea(uint256 _tokenId) external view returns (uint256);
  function getAreaSource(uint256 _tokenId) external view returns (AreaSource);
  function getLedgerIdentifier(uint256 _tokenId) external view returns (bytes32);
  function getDataLink(uint256 _tokenId) external view returns (string memory);
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
      uint256 setupStage
    );
}
