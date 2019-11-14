/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "@galtproject/core/contracts/reputation/interfaces/IRA.sol";
import "./IPPToken.sol";


interface IPPLocker {
  function deposit(IPPToken _tokenContract, uint256 _tokenId) external;
  function withdraw(IPPToken _tokenContract, uint256 _tokenId) external;
  function approveMint(IRA _tra) external;
  function burn(IRA _tra) external;
  function burnToken(bytes32 _tokenIdHash) external;
  function isMinted(address _tra) external returns (bool);
  function getTras() external returns (address[] memory);
  function getTrasCount() external returns (uint256);
  function isOwner() external view returns (bool);
  function owner() external view returns(address);
  function tokenId() external view returns(uint256);
  function reputation() external view returns(uint256);
  function tokenContract() external view returns(IPPToken);
}
