/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/geodesic/contracts/utils/SegmentUtils.sol";
import "@galtproject/geodesic/contracts/utils/CPointUtils.sol";


library PPContourVerificationLib {
  enum InclusionType {
    A_POINT_INSIDE_B,
    B_POINT_INSIDE_A
  }

  /**
   * @dev Checks if two given contour segment intersect each other
   * @param _excludeCollinear will return false if two segments are collinear
   */
  function contourSegmentsIntersects(
    uint256[] memory _contourA,
    uint256[] memory _contourB,
    uint256 _aSegmentFirstPointIndex,
    uint256 _aSegmentFirstPoint,
    uint256 _aSegmentSecondPoint,
    uint256 _bSegmentFirstPointIndex,
    uint256 _bSegmentFirstPoint,
    uint256 _bSegmentSecondPoint,
    bool _excludeCollinear
  )
    internal
    view
    returns (bool)
  {
    bool isCollinear = segmentsAreCollinear(
      _aSegmentFirstPoint,
      _aSegmentSecondPoint,
      _bSegmentSecondPoint,
      _bSegmentFirstPoint
    );

    if (_excludeCollinear && isCollinear) {
      return false;
    }

    require(
      contourHasSegment(
        _aSegmentFirstPointIndex,
        _aSegmentFirstPoint,
        _aSegmentSecondPoint,
        _contourA
      ) == true,
      "Invalid segment for contour A"
    );

    require(
      contourHasSegment(
        _bSegmentFirstPointIndex,
        _bSegmentFirstPoint,
        _bSegmentSecondPoint,
        _contourB
      ) == true,
      "Invalid segment for contour B"
    );

    return SegmentUtils.segmentsIntersect(
      getLatLonSegment(
        _aSegmentFirstPoint,
        _aSegmentSecondPoint
      ),
      getLatLonSegment(
        _bSegmentFirstPoint,
        _bSegmentSecondPoint
      )
    );
  }

  function pointInsideContour(
    uint256[] memory _contourA,
    uint256[] memory _contourB,
    PPContourVerificationLib.InclusionType _inclusionType,
    uint256 _includingPointIndex,
    uint256 _includingPoint
  )
    internal
    view
    returns (bool)
  {
    if (_inclusionType == InclusionType.A_POINT_INSIDE_B) {
      require(
        _contourA[_includingPointIndex] == _includingPoint,
        "Invalid point of A contour"
      );

      return isInsideWithoutCache(
        _includingPoint,
        _contourB
      );

    } else {
      require(
        _contourB[_includingPointIndex] == _includingPoint,
        "Invalid point of B contour"
      );

      return isInsideWithoutCache(
        _includingPoint,
        _contourA
      );
    }
  }

  function isInsideWithoutCache(
    uint256 _cPoint,
    uint256[] memory _polygon
  )
    internal
    pure
    returns (bool)
  {
    (int256 x, int256 y) = CPointUtils.cPointToLatLon(_cPoint);

    bool inside = false;
    uint256 j = _polygon.length - 1;

    for (uint256 i = 0; i < _polygon.length; i++) {
      (int256 xi, int256 yi) = CPointUtils.cPointToLatLon(_polygon[i]);
      (int256 xj, int256 yj) = CPointUtils.cPointToLatLon(_polygon[j]);

      bool intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (intersect) {
        inside = !inside;
      }
      j = i;
    }

    return inside;
  }

  function contourHasSegment(
    uint256 _firstPointIndex,
    uint256 _firstPoint,
    uint256 _secondPoint,
    uint256[] memory _contour
  )
    internal
    pure
    returns (bool)
  {
    uint256 len = _contour.length;
    require(len > 0, "Empty contour");
    require(_firstPointIndex < len, "Invalid existing coord index");

    if (_contour[_firstPointIndex] != _firstPoint) {
      return false;
    }

    uint256 secondPointIndex = _firstPointIndex + 1;
    if (secondPointIndex == len) {
      secondPointIndex = 0;
    }

    if (_contour[secondPointIndex] != _secondPoint) {
      return false;
    }

    return true;
  }

  function segmentsAreCollinear(
    uint256 _a1,
    uint256 _b1,
    uint256 _a2,
    uint256 _b2
  )
    internal
    pure
    returns (bool)
  {
    int256[2] memory a1 = toLatLonPoint(_a1);
    int256[2] memory b1 = toLatLonPoint(_b1);
    int256[2] memory a2 = toLatLonPoint(_a2);
    int256[2] memory b2 = toLatLonPoint(_b2);

    return SegmentUtils.pointOnSegment(a2, a1, b1) && SegmentUtils.pointOnSegment(b2, a1, b1);
  }

  function getLatLonSegment(
    uint256 _aPoint,
    uint256 _bPoint
  )
    internal
    pure
    returns (int256[2][2] memory)
  {
    return int256[2][2]([
      toLatLonPoint(_aPoint),
      toLatLonPoint(_bPoint)
    ]);
  }

  function toLatLonPoint(
    uint256 _cPoint
  )
    internal
    pure
    returns (int256[2] memory)
  {
    return CPointUtils.cPointToLatLonArr(_cPoint);
  }

  function checkForRoomVerticalIntersection(
    uint256[] memory _validContour,
    uint256[] memory _invalidContour,
    int256 _vHP,
    int256 _iHP
  )
    internal
    view
    returns (bool)
  {
    int256 vLP = getLowestElevation(_validContour);
    int256 iLP = getLowestElevation(_invalidContour);

    return checkVerticalIntersection(_vHP, vLP, _iHP, iLP);
  }

  function getLowestElevation(
    uint256[] memory _contour
  )
    internal
    pure
    returns (int256)
  {
    uint256 len = _contour.length;
    require(len > 2, "Empty contour passed in");

    int256 theLowest = CPointUtils.cPointToHeight(_contour[0]);

    for (uint256 i = 1; i < len; i++) {
      int256 elevation = CPointUtils.cPointToHeight(_contour[i]);
      if (elevation < theLowest) {
        theLowest = elevation;
      }
    }

    return theLowest;
  }

  function checkVerticalIntersection(int256 _aHP, int256 _aLP, int256 _bHP, int256 _bLP) public pure returns (bool) {
    if (_aHP < _bHP && _aHP > _bLP) {
      return true;
    }

    if (_bHP < _aHP && _bHP > _aLP) {
      return true;
    }

    if (_aLP < _bHP && _aLP > _bLP) {
      return true;
    }

    if (_bLP < _aHP && _bLP > _aLP) {
      return true;
    }

    return false;
  }
}