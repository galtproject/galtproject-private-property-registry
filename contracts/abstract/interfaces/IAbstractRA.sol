/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./IAbstractLocker.sol";


interface IAbstractRA {
  function mint(IAbstractLocker _tokenLocker) external;
  function approveBurn(IAbstractLocker _tokenLocker) external;

  // ERC20 compatible
  function balanceOf(address _owner) external view returns (uint256);

  // ERC20 compatible
  function totalSupply() external view returns (uint256);

  // Private Property specific getter
  function tokenReputationMinted(address _tokenContract, uint256 _tokenId) external view returns (uint256);

  // Private Property specific getter
  function ownerReputationMinted(address _owner, address _tokenContract, uint256 _tokenId) external view returns (uint256);

  // Ping-Pong Handshake
  function ping() external pure returns (bytes32);
}
