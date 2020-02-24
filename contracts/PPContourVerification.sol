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
import "./interfaces/IPPToken.sol";
import "./libs/PPContourVerificationPublicLib.sol";
import "./interfaces/IPPDepositHolder.sol";
import "./PPTokenController.sol";


contract PPContourVerification is Ownable {
  event EnableVerification(uint256 minimalDeposit, uint256 activeFrom);
  event DisableVerification();
  event ReportNoDeposit(address indexed reporter, uint256 token);
  event ReportIntersection(address indexed reporter, uint256 indexed validTokenId, uint256 indexed invalidTokenId);
  event ReportInclusion(address indexed reporter, uint256 indexed validTokenId, uint256 indexed invalidTokenId);

  bytes32 public constant PPGR_DEPOSIT_HOLDER_KEY = bytes32("deposit_holder");

  PPContourVerificationPublicLib public lib;
  PPTokenController public controller;
  // 0 if disabled
  uint256 public activeFrom;
  // 0 if disabled, in GALT
  uint256 public minimalDeposit;
  uint256 public minimalTimeout;

  modifier onlyActiveVerification() {
    require(activeFrom != 0 && now >= activeFrom, "Verification is disabled");

    _;
  }

  constructor(PPTokenController _controller, PPContourVerificationPublicLib _lib, uint256 _minimalTimeout) public {
    controller = _controller;
    lib = _lib;
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

  function reportNoDeposit(uint256 _tokenId) external onlyActiveVerification {
    require(_tokenContract().exists(_tokenId), "Token doesn't exist");
    require(controller.getDoNotClaimUniquenessFlag(_tokenId) == false, "Token doesn't claim uniqueness");

    address tokenContractAddress = address(_tokenContract());
    IPPDepositHolder depositHolder = _depositHolder();
    bool isSufficient = depositHolder.isInsufficient(tokenContractAddress, _tokenId, minimalDeposit);

    require(isSufficient == false, "The deposit is sufficient");

    if (depositHolder.balanceOf(tokenContractAddress, _tokenId) > 0) {
      depositHolder.payout(tokenContractAddress, _tokenId, msg.sender);
    }
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
    onlyActiveVerification
  {
    _ensureInvalidity(_validTokenId, _invalidTokenId);

    IPPToken tokenContract = _tokenContract();

    uint256[] memory validContour = tokenContract.getContour(_validTokenId);
    uint256[] memory invalidContour = tokenContract.getContour(_invalidTokenId);

    bool intersects = lib.contourSegmentsIntersects(
      validContour,
      invalidContour,
      _validContourSegmentFirstPointIndex,
      _validContourSegmentFirstPoint,
      _validContourSegmentSecondPoint,
      _invalidContourSegmentFirstPointIndex,
      _invalidContourSegmentFirstPoint,
      _invalidContourSegmentSecondPoint,
      false
    );

    if (intersects == true) {
      if (tokenContract.getType(_validTokenId) == IPPToken.TokenType.ROOM) {
        _requireVerticalIntersection(_validTokenId, _invalidTokenId, validContour, invalidContour);
      }
    } else {
      revert("Tokens don't intersect");
    }

    _depositHolder().payout(address(tokenContract), _invalidTokenId, msg.sender);
    controller.reportCVMisbehaviour(_invalidTokenId);

    emit ReportIntersection(msg.sender, _validTokenId, _invalidTokenId);
  }

  function reportInclusion(
    uint256 _validTokenId,
    uint256 _invalidTokenId,
    PPContourVerificationLib.InclusionType _inclusionType,
    uint256 _includingPointIndex,
    uint256 _includingPoint
  )
    external
    onlyActiveVerification
  {
    _ensureInvalidity(_validTokenId, _invalidTokenId);

    IPPToken tokenContract = _tokenContract();

    uint256[] memory validContour = tokenContract.getContour(_validTokenId);
    uint256[] memory invalidContour = tokenContract.getContour(_invalidTokenId);

    bool isInside = lib.pointInsideContour(
      validContour,
      invalidContour,
      _inclusionType,
      _includingPointIndex,
      _includingPoint
    );

    if (isInside == true) {
      if (tokenContract.getType(_validTokenId) == IPPToken.TokenType.ROOM) {
        _requireVerticalIntersection(_validTokenId, _invalidTokenId, validContour, invalidContour);
      }
    } else {
      revert("Inclusion not found");
    }

    _depositHolder().payout(address(tokenContract), _invalidTokenId, msg.sender);
    controller.reportCVMisbehaviour(_invalidTokenId);

    emit ReportInclusion(msg.sender, _validTokenId, _invalidTokenId);
  }

  // INTERNAL

  function _tokenContract() internal returns (IPPToken) {
    return controller.tokenContract();
  }

  function _depositHolder() internal view returns(IPPDepositHolder) {
    return IPPDepositHolder(controller.globalRegistry().getContract(PPGR_DEPOSIT_HOLDER_KEY));
  }

  function _requireVerticalIntersection(
    uint256 _validTokenId,
    uint256 _invalidTokenId,
    uint256[] memory _validContour,
    uint256[] memory _invalidContour
  )
    internal
  {
    IPPToken tokenContract = controller.tokenContract();

    require(
      lib.checkForRoomVerticalIntersection(
        _validContour,
        _invalidContour,
        tokenContract.getHighestPoint(_validTokenId),
        tokenContract.getHighestPoint(_invalidTokenId)
      ) == true,
      "Contour intersects, but not the heights"
    );
  }

  function _ensureInvalidity(uint256 _validToken, uint256 _invalidToken) internal {
    IPPToken tokenContract = controller.tokenContract();

    require(tokenContract.exists(_validToken) == true, "Valid token doesn't exist");
    require(tokenContract.exists(_invalidToken) == true, "Invalid token doesn't exist");

    require(
      tokenContract.getType(_validToken) == tokenContract.getType(_invalidToken),
      "Tokens type mismatch"
    );

    require(controller.getDoNotClaimUniquenessFlag(_validToken) == false, "Valid token doesn't claim uniqueness");
    require(controller.getDoNotClaimUniquenessFlag(_invalidToken) == false, "Invalid token doesn't claim uniqueness");

    uint256 validLatestTimestamp = controller.getContourUpdatedAt(_validToken);
    if (validLatestTimestamp == 0) {
      validLatestTimestamp = tokenContract.propertyCreatedAt(_validToken);
    }
    assert(validLatestTimestamp > 0);

    uint256 invalidLatestTimestamp = controller.getContourUpdatedAt(_invalidToken);
    if (invalidLatestTimestamp == 0) {
      invalidLatestTimestamp = tokenContract.propertyCreatedAt(_invalidToken);
    }
    assert(invalidLatestTimestamp > 0);

    // Matching timestamps
    require(
      invalidLatestTimestamp >= validLatestTimestamp,
      // solium-disable-next-line error-reason
      "Expression 'invalidTimestamp >= validTimestamp' doesn't satisfied"
    );
  }
}
