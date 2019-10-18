/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.10;

import "openzeppelin-solidity/contracts/ownership/Ownable.sol";
import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "openzeppelin-solidity/contracts/token/ERC721/IERC721.sol";


contract ChargesFee is Ownable {
  event SetEthFee(uint256 ethFee);
  event SetGaltFee(uint256 ethFee);
  event WithdrawEth(address indexed to, uint256 amount);
  event WithdrawErc20(address indexed to, address indexed tokenAddress, uint256 amount);
  event WithdrawErc721(address indexed to, address indexed tokenAddress, uint256 tokenId);

  IERC20 public galtToken;

  uint256 public ethFee;
  uint256 public galtFee;

  constructor(address _galtToken, uint256 _ethFee, uint256 _galtFee) public {
    galtToken = IERC20(_galtToken);
    ethFee = _ethFee;
    galtFee = _galtFee;
  }

  // Setters

  function setEthFee(uint256 _ethFee) external onlyOwner {
    ethFee = _ethFee;

    emit SetEthFee(_ethFee);
  }

  function setGaltFee(uint256 _galtFee) external onlyOwner {
    galtFee = _galtFee;

    emit SetGaltFee(_galtFee);
  }

  // Withdrawers

  function withdrawErc20(address _tokenAddress, address _to) external onlyOwner {
    uint256 balance = IERC20(_tokenAddress).balanceOf(address(this));

    require(
      IERC20(_tokenAddress).transfer(_to, balance) == true,
      "Failed to transfer ERC20 tokens"
    );

    emit WithdrawErc20(_to, _tokenAddress, balance);
  }

  function withdrawErc721(address _tokenAddress, address _to, uint256 _tokenId) external onlyOwner {
    IERC721(_tokenAddress).transferFrom(address(this), _to, _tokenId);

    emit WithdrawErc721(_to, _tokenAddress, _tokenId);
  }

  function withdrawEth(address payable _to) external onlyOwner {
    uint256 balance = address(this).balance;

    _to.transfer(balance);

    emit WithdrawEth(_to, balance);
  }

  // INTERNAL

  function _acceptPayment() internal {
    if (msg.value == 0) {
      require(galtToken.transferFrom(msg.sender, address(this), galtFee) == true, "Failed to transfer GALT tokens");
    } else {
      require(msg.value == ethFee, "Fee and msg.value not equal");
    }
  }
}
