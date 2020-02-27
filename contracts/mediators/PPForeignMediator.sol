/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./BasicMediator.sol";
import "./interfaces/IHomeMediator.sol";


contract PPForeignMediator is BasicMediator {
  function passMessage(address _from, uint256 _tokenId) internal {
    bytes memory metadata = getMetadata(_tokenId);

    bytes4 methodSelector = IHomeMediator(0).handleBridgedTokens.selector;
    bytes memory data = abi.encodeWithSelector(methodSelector, _from, _tokenId, metadata, nonce);

    bytes32 dataHash = keccak256(data);
    setMessageHashTokenId(dataHash, _tokenId);
    setMessageHashRecipient(dataHash, _from);
    setNonce(dataHash);

    bridgeContract.requireToPassMessage(mediatorContractOnOtherSide, data, requestGasLimit);
  }

  function handleBridgedTokens(
    address _recipient,
    uint256 _tokenId,
    bytes32 /* _nonce */
  )
    external
  {
    require(msg.sender == address(bridgeContract), "Only bridge allowed");
    require(bridgeContract.messageSender() == mediatorContractOnOtherSide, "Invalid contract on other side");
    IERC721(erc721Token).transferFrom(address(this), _recipient, _tokenId);
  }

  function bridgeSpecificActionsOnTokenTransfer(address _from, uint256 _tokenId) internal {
    passMessage(_from, _tokenId);
  }

  function fixFailedMessage(bytes32 _dataHash) external {
    require(msg.sender == address(bridgeContract), "Only bridge allowed");
    require(bridgeContract.messageSender() == mediatorContractOnOtherSide, "Invalid contract on other side");
    require(!messageHashFixed[_dataHash], "Already fixed");

    address recipient = messageHashRecipient[_dataHash];
    uint256 tokenId = messageHashTokenId[_dataHash];

    setMessageHashFixed(_dataHash);
    IERC721(erc721Token).transferFrom(address(this), recipient, tokenId);

    emit FailedMessageFixed(_dataHash, recipient, tokenId);
  }
}
