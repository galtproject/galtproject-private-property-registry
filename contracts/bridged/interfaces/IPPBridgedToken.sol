/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../../abstract/interfaces/IAbstractToken.sol";


interface IPPBridgedToken {
  event SetHomeMediator(address homeMediator);

  function setHomeMediator(address _homeMediator) external;

  struct Property {
    // (LAND_PLOT,BUILDING,ROOM) Type cannot be changed after token creation
    IAbstractToken.TokenType tokenType;
    // Geohash5z (x,y,z)
    uint256[] contour;
    // Meters above the sea
    int256 highestPoint;

    // USER_INPUT or CONTRACT
    IAbstractToken.AreaSource areaSource;
    // Calculated either by contract (for land plots and buildings) or by manual input
    // in sq. meters (1 sq. meter == 1 eth)
    uint256 area;

    bytes32 ledgerIdentifier;
    string humanAddress;
    string dataLink;
  }


  function mint(
    address _to,
    uint256 _tokenId,
    IAbstractToken.TokenType _tokenType,
    IAbstractToken.AreaSource _areaSource,
    uint256 _area,
    bytes32 _ledgerIdentifier,
    string calldata _humanAddress,
    string calldata _dataLink,
    uint256[] calldata _contour,
    int256 _highestPoint
  ) external;

  function recover(
    address _to,
    uint256 _tokenId
  ) external;

  function getDetails(uint256 _tokenId)
    external
    view
    returns (
      IAbstractToken.TokenType tokenType,
      uint256[] memory contour,
      int256 highestPoint,
      IAbstractToken.AreaSource areaSource,
      uint256 area,
      bytes32 ledgerIdentifier,
      string memory humanAddress,
      string memory dataLink
    );
}
