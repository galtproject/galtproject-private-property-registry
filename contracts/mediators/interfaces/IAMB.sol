/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IAMB {
  function messageSender() external view returns (address);
  function maxGasPerTx() external view returns (uint256);
  function transactionHash() external view returns (bytes32);
  function messageCallStatus(bytes32 _txHash) external view returns (bool);
  function failedMessageDataHash(bytes32 _txHash) external view returns (bytes32);
  function failedMessageReceiver(bytes32 _txHash) external view returns (address);
  function failedMessageSender(bytes32 _txHash) external view returns (address);
  function requireToPassMessage(address _contract, bytes calldata _data, uint256 _gas) external;
}
