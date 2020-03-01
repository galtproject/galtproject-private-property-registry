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
import "./PPContourVerificationLib.sol";


contract PPContourVerificationPublicLib {
  function contourSegmentsIntersects(
    uint256[] memory _contourA,
    uint256[] memory _contourB,
    uint256 _aSegmentFirstPointIndex,
    uint256 _bSegmentFirstPointIndex,
    bool _excludeCollinear
  )
    public
    view
    returns (bool)
  {
    return PPContourVerificationLib.contourSegmentsIntersects(
      _contourA,
      _contourB,
      _aSegmentFirstPointIndex,
      _bSegmentFirstPointIndex,
      _excludeCollinear
    );
  }

  function checkForRoomVerticalIntersection(
    uint256[] memory _validContour,
    uint256[] memory _invalidContour,
    int256 _vHP,
    int256 _iHP
  )
    public
    view
    returns (bool)
  {
    return PPContourVerificationLib.checkForRoomVerticalIntersection(
      _validContour,
      _invalidContour,
      _vHP,
      _iHP
    );
  }

  function pointInsideContour(
    uint256[] memory _contourA,
    uint256[] memory _contourB,
    uint256 _includingPoint
  )
    public
    view
    returns (bool)
  {
    return PPContourVerificationLib.pointInsideContour(_contourA, _contourB, _includingPoint);
  }

  function segmentsAreCollinear(
    uint256 _a1g,
    uint256 _b1g,
    uint256 _a2g,
    uint256 _b2g
  )
    public
    view
    returns(bool)
  {
    return PPContourVerificationLib.segmentsAreCollinear(
      _a1g,
      _b1g,
      _a2g,
      _b2g
    );
  }

  function getLowestElevation(uint256[] memory _contour) public pure returns (int256) {
    return PPContourVerificationLib.getLowestElevation(_contour);
  }

  function checkVerticalIntersection(int256 _aHP, int256 _aLP, int256 _bHP, int256 _bLP) public pure returns (bool) {
    return PPContourVerificationLib.checkVerticalIntersection(_aHP, _aLP, _bHP, _bLP);
  }
}