/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@galtproject/core/contracts/ACL.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPToken.sol";
import "./interfaces/IPPTokenController.sol";


contract PPDepositHolder {
  using SafeMath for uint256;

  event Deposit(address indexed tokenContract, uint256 indexed tokenId, uint256 amount);
  event Withdrawal(address indexed tokenContract, uint256 indexed tokenId, uint256 total);
  event Payout(address indexed tokenContract, uint256 indexed tokenId, uint256 amount, address to);

  IPPGlobalRegistry public globalRegistry;

  // TokenContract => (tokenId => amount))
  mapping(address => mapping(uint256 => uint256)) internal deposits;

  modifier onlyValidTokenContract(address _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(address(_tokenContract));
    _;
  }

  constructor(IPPGlobalRegistry _globalRegistry) public {
    globalRegistry = _globalRegistry;
  }

  // anyone can deposit
  function deposit(address _tokenContract, uint256 _tokenId, uint256 _amount)
    external
    onlyValidTokenContract(_tokenContract)
  {
    require(IPPToken(_tokenContract).exists(_tokenId) == true, "Token doesn't exists");

    // deposits[_tokenContract][_tokenId] += _amount;
    deposits[_tokenContract][_tokenId] = deposits[_tokenContract][_tokenId].add(_amount);

    IERC20(globalRegistry.getGaltTokenAddress())
      .transferFrom(msg.sender, address(this), _amount);

    emit Deposit(_tokenContract, _tokenId, _amount);
  }

  // @dev user withdraws his deposit back, withdraws total amount
  function withdraw(address _tokenContract, uint256 _tokenId) external {
    require(msg.sender == IPPToken(_tokenContract).ownerOf(_tokenId), "Not the token owner");

    uint256 balance = deposits[_tokenContract][_tokenId];

    require(balance > 0, "Deposit is 0");

    deposits[_tokenContract][_tokenId] = 0;

    IERC20(globalRegistry.getGaltTokenAddress())
      .transfer(msg.sender, balance);

    emit Deposit(_tokenContract, _tokenId, balance);
  }

  // @dev ContourVerifier claims to payout a deposit in order to reward a fisherman
  function payout(address _tokenContract, uint256 _tokenId, address _to)
    external
    onlyValidTokenContract(_tokenContract)
  {
    require(
      msg.sender == IPPTokenController(IPPToken(_tokenContract).controller()).contourVerificationManager(),
      "Only valid verificationManager allowed"
    );

    uint256 balance = deposits[_tokenContract][_tokenId];

    require(balance > 0, "Deposit is 0");

    deposits[_tokenContract][_tokenId] = 0;

    IERC20(globalRegistry.getGaltTokenAddress())
      .transfer(_to, balance);

    emit Payout(_tokenContract, _tokenId, balance, _to);
  }

  function balanceOf(address _tokenContract, uint256 _tokenId) external view returns (uint256) {
    return deposits[_tokenContract][_tokenId];
  }
}
