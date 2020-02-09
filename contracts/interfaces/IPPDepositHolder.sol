/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


contract IPPDepositHolder {
  event Deposit(address indexed tokenContract, uint256 indexed tokenId, uint256 amount);
  event Withdrawal(address indexed tokenContract, uint256 indexed tokenId, uint256 total);
  event Payout(address indexed tokenContract, uint256 indexed tokenId, uint256 amount, address to);

  function deposit(address _tokenContract, uint256 _tokenId, uint256 _amount) external;
  function withdraw(address _tokenContract, uint256 _tokenId) external;
  function payout(address _tokenContract, uint256 _tokenId, address _to) external;
  function balanceOf(address _tokenContract, uint256 _tokenId) external view returns (uint256);
  function isInsufficient(address _tokenContract, uint256 _tokenId, uint256 _minimalDeposit)
    external
    view
    returns (bool);
}
