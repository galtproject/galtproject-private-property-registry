/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


contract MockRA {
  function balanceOf(address _address) external pure returns (uint256) {
    // disables compilation warning ᕦ(ツ)ᕤ
    assert(_address == _address);
    return 0;
  }

  function ping() external pure returns (bytes32) {
    return bytes32("pong");
  }
}
