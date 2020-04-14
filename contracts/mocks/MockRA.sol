/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../abstract/interfaces/IAbstractRA.sol";


contract MockRA is IAbstractRA {
  // registry => (tokenId => reputation)
  mapping(address => mapping(uint256 => uint256)) public tokenReputationMinted;

  function setMinted(address _tokenContract, uint256 _tokenId, uint256 _reputation) external {
    tokenReputationMinted[_tokenContract][_tokenId] = _reputation;
  }

  function balanceOf(address _address) external view returns (uint256) {
    // disables compilation warning ᕦ(ツ)ᕤ
    assert(_address == _address);
    return 0;
  }

  function totalSupply() external view returns (uint256) {
    return 42;
  }

  function ping() external pure returns (bytes32) {
    return bytes32("pong");
  }

  function mint(IAbstractLocker _tokenLocker) external {
    require(false, "Not implemented");
  }

  function approveBurn(IAbstractLocker _tokenLocker) external {
    require(false, "Not implemented");
  }
}
