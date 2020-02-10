/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./PPTokenController.sol";
import "./libs/PPContourVerificationPublicLib.sol";
import "./PPContourVerification.sol";


contract PPContourVerificationFactory {
  event NewPPContourVerification(address contourVerificationContract);

  PPContourVerificationPublicLib public lib;

  constructor(PPContourVerificationPublicLib _lib) public {
    lib = _lib;
  }

  function build(PPTokenController _controller, uint256 _minimalTimeout) external returns (PPContourVerification) {
    PPContourVerification cv = new PPContourVerification(_controller, lib, _minimalTimeout);

    emit NewPPContourVerification(address(cv));

    cv.transferOwnership(msg.sender);

    return cv;
  }
}
