/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@galtproject/geodesic/contracts/utils/GeohashUtils.sol";
import "@galtproject/geodesic/contracts/utils/SegmentUtils.sol";
import "@galtproject/geodesic/contracts/utils/LandUtils.sol";
import "@galtproject/geodesic/contracts/utils/PolygonUtils.sol";
import "./PPTokenController.sol";
import "./PPToken.sol";
import "./libs/PPContourVerificationPublicLib.sol";


contract PPContourVerification {
  PPContourVerificationPublicLib public lib;
  PPTokenController public controller;

  function reportIntersection(
    uint256 _validTokenId,
    uint256 _invalidTokenId,
    uint256 _validContourSegmentFirstPointIndex,
    uint256 _validContourSegmentFirstPoint,
    uint256 _validContourSegmentSecondPoint,
    uint256 _invalidContourSegmentFirstPointIndex,
    uint256 _invalidContourSegmentFirstPoint,
    uint256 _invalidContourSegmentSecondPoint
  )
    external
  {
    IPPToken tokenContract = controller.tokenContract();
    uint256[] memory validContour = tokenContract.getContour(_validTokenId);
    uint256[] memory invalidContour = tokenContract.getContour(_invalidTokenId);

    require(
      lib.contourSegmentsIntersects(
        validContour,
        invalidContour,
        _validContourSegmentFirstPointIndex,
        _validContourSegmentFirstPoint,
        _validContourSegmentSecondPoint,
        _invalidContourSegmentFirstPointIndex,
        _invalidContourSegmentFirstPoint,
        _invalidContourSegmentSecondPoint,
        true
      ) == false,
      "foo"
    );
    //    bool tokenIntersects = lib.contourHasSegment(_invalidContourSegmentFirstPoint);

    // TODO: fetch _validToken controller->token->(createdAt, contourUpdatedAt, contour, height, type, ignoreUniqueness)
    // TODO: fetch _invalidToken controller->token->(createdAt, contourUpdatedAt, contour, height, type, ignoreUniqueness)
    // TODO: ignoreUniqueness == false
    // TODO: ensure intersection valid
    // TODO: ensure _validToken is older than _invalidToken using max(createdAt, contourUpdatedAt)
    // TODO: burn invalid token controller->token->burn();
    // TODO: fetch deposit and transfer it to the reporter
  }

  function reportInclusion(
    uint256 _validTokenId,
    uint256 _invalidTokenId,
    PPContourVerificationLib.InclusionType _inclusionType,
    uint256 _includingPointIndex,
    uint256 _includingPoint
  )
    external
  {
    IPPToken tokenContract = controller.tokenContract();
    uint256[] memory validContour = tokenContract.getContour(_validTokenId);
    uint256[] memory invalidContour = tokenContract.getContour(_invalidTokenId);

    require(
      lib.pointInsideContour(
        validContour,
        invalidContour,
        _inclusionType,
        _includingPointIndex,
        _includingPoint
      ) == false,
      "foo"
    );
  }
}
