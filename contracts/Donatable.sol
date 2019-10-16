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


contract Donatable is Ownable {
  function withdrawErc20(address _tokenAddress, address _recipient) external onlyOwner {
    IERC20(_tokenAddress).transfer(_recipient, IERC20(_tokenAddress).balanceOf(address(this)));
  }

  function withdrawErc721(address _tokenAddress, address _recipient, uint256 tokenId) external onlyOwner {
    IERC721(_tokenAddress).transferFrom(address(this), _recipient, tokenId);
  }

  function withdrawEth(address payable _recipient) external onlyOwner {
    _recipient.transfer(address(this).balance);
  }
}
