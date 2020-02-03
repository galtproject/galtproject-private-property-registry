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
    uint256 _aSegmentFirstPoint,
    uint256 _aSegmentSecondPoint,
    uint256 _bSegmentFirstPointIndex,
    uint256 _bSegmentFirstPoint,
    uint256 _bSegmentSecondPoint,
    bool _matchCollinear
  )
    public
    view
    returns (bool)
  {
    return PPContourVerificationLib.contourSegmentsIntersects(
      _contourA,
      _contourB,
      _aSegmentFirstPointIndex,
      _aSegmentFirstPoint,
      _aSegmentSecondPoint,
      _bSegmentFirstPointIndex,
      _bSegmentFirstPoint,
      _bSegmentSecondPoint,
      _matchCollinear
    );
  }

  function pointInsideContour(
    uint256[] memory _contourA,
    uint256[] memory _contourB,
    PPContourVerificationLib.InclusionType _inclusionType,
    uint256 _includingPointIndex,
    uint256 _includingPoint
  )
    public
    view
    returns (bool)
  {
    return PPContourVerificationLib.pointInsideContour(
      _contourA,
      _contourB,
      _inclusionType,
      _includingPointIndex,
      _includingPoint
    );
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
}