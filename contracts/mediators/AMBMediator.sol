/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/ownership/Ownable.sol";
import "./interfaces/IAMB.sol";


contract AMBMediator is Ownable {
  event SetBridgeContract(address bridgeContract);
  event SetMediatorContractOnOtherSide(address mediatorContract);
  event SetRequestGasLimit(uint256 requestGasLimit);

  uint256 public oppositeChainId;
  IAMB public bridgeContract;
  address public mediatorContractOnOtherSide;
  uint256 public requestGasLimit;

  // OWNER INTERFACE

  function setBridgeContract(address _bridgeContract) external onlyOwner {
    _setBridgeContract(_bridgeContract);

    emit SetBridgeContract(_bridgeContract);
  }

  function setMediatorContractOnOtherSide(address _mediatorContract) external onlyOwner {
    _setMediatorContractOnOtherSide(_mediatorContract);

    emit SetMediatorContractOnOtherSide(_mediatorContract);
  }

  function setRequestGasLimit(uint256 _requestGasLimit) external onlyOwner {
    _setRequestGasLimit(_requestGasLimit);

    emit SetRequestGasLimit(_requestGasLimit);
  }

  // INTERNAL

  function _setBridgeContract(address _bridgeContract) internal {
    require(Address.isContract(_bridgeContract), "Address should be a contract");
    bridgeContract = IAMB(_bridgeContract);
  }

  function _setMediatorContractOnOtherSide(address _mediatorContract) internal {
    mediatorContractOnOtherSide = _mediatorContract;
  }

  function _setRequestGasLimit(uint256 _requestGasLimit) internal {
    require(_requestGasLimit <= bridgeContract.maxGasPerTx(), "Gas value exceeds bridge limit");
    requestGasLimit = _requestGasLimit;
  }
}
