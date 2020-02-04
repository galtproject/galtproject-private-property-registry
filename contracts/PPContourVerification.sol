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
// TODO: use interface
import "./PPTokenController.sol";
import "./PPToken.sol";
import "./libs/PPContourVerificationPublicLib.sol";
// TODO: use interface
import "./PPDepositHolder.sol";


contract PPContourVerification is Ownable {
  event EnableVerification(uint256 minimalDeposit, uint256 activeFrom);
  event DisableVerification();
  event ReportNoDeposit(address indexed reporter, uint256 token);

  bytes32 public constant PPGR_DEPOSIT_HOLDER_KEY = bytes32("deposit_holder");

  PPContourVerificationPublicLib public lib;
  PPTokenController public controller;
  // 0 if disabled
  uint256 public activeFrom;
  // 0 if disabled, in GALT
  uint256 public minimalDeposit;
  uint256 public minimalTimeout;

  constructor(PPTokenController _controller, uint256 _minimalTimeout) public {
    controller = _controller;
    minimalTimeout = _minimalTimeout;
  }

  // OWNER INTERFACE

  function enableVerification(uint256 _minimalDeposit, uint256 _timeout) external onlyOwner {
    require(activeFrom == 0, "Verification is already enabled");
    require(_timeout >= minimalTimeout, "Timeout is not big enough");

    uint256 _activeFrom = now + _timeout;

    minimalDeposit = _minimalDeposit;
    activeFrom = _activeFrom;

    emit EnableVerification(_minimalDeposit, _activeFrom);
  }

  function disableVerification() external onlyOwner {
    require(minimalDeposit != 0 && activeFrom != 0, "Verification is already disabled");

    minimalDeposit = 0;
    activeFrom = 0;

    emit DisableVerification();
  }

  // PUBLIC INTERFACE

  function reportNoDeposit(uint256 _tokenId) external {
    require(now >= activeFrom, "Verification is disabled");
    require(_tokenContract().exists(_tokenId), "Token doesn't exist");

    PPDepositHolder depositHolder = _depositHolder();
    bool isSufficient = depositHolder.isInsufficient(address(_tokenContract()), _tokenId, minimalDeposit);

    require(isSufficient == false, "The deposit is sufficient");

    depositHolder.payout(address(_tokenContract()), _tokenId, msg.sender);
    controller.reportCVMisbehaviour(_tokenId);

    emit ReportNoDeposit(msg.sender, _tokenId);
  }

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

  // INTERNAL

  function _tokenContract() internal returns (IPPToken) {
    return controller.tokenContract();
  }

  function _depositHolder() internal view returns(PPDepositHolder) {
    return PPDepositHolder(controller.globalRegistry().getContract(PPGR_DEPOSIT_HOLDER_KEY));
  }
}
