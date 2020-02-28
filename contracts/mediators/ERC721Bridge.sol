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
import "../interfaces/IPPToken.sol";


contract ERC721Bridge {
  bytes32 internal constant ERC721_TOKEN = keccak256(abi.encodePacked("erc721token"));

  address public erc721Token;

  function _setErc721token(address _token) internal {
    require(Address.isContract(_token), "Address should be a contract");
    erc721Token = _token;
  }
}
