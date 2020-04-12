/*
 * Copyright ©️ 2018-2020 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018-2020 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./BasicMediator.sol";
import "./interfaces/IForeignMediator.sol";
import "../bridged/interfaces/IPPBridgedToken.sol";
import "./interfaces/IHomeMediator.sol";


contract PPHomeMediator is IHomeMediator, BasicMediator {
  function passMessage(address _from, uint256 _tokenId, bytes memory/* ignoring metadata */) internal {
    bytes4 methodSelector = IForeignMediator(0).handleBridgedTokens.selector;
    bytes memory data = abi.encodeWithSelector(methodSelector, _from, _tokenId, nonce);

    bytes32 dataHash = keccak256(data);
    setMessageHashTokenId(dataHash, _tokenId);
    setMessageHashRecipient(dataHash, _from);
    setNonce(dataHash);

    bridgeContract.requireToPassMessage(mediatorContractOnOtherSide, data, requestGasLimit);
  }

  function handleBridgedTokens(
    address _recipient,
    uint256 _tokenId,
    bytes calldata _metadata,
    bytes32 /* _nonce */
  ) external {
    require(msg.sender == address(bridgeContract), "Only bridge allowed");
    require(bridgeContract.messageSender() == mediatorContractOnOtherSide, "Invalid contract on other side");

    mintToken(_recipient, _tokenId, _metadata);
  }

  function handleBurnedToken(uint256 _tokenId) external {
    require(msg.sender == address(bridgeContract), "Only bridge allowed");
    require(bridgeContract.messageSender() == mediatorContractOnOtherSide, "Invalid contract on other side");

    IAbstractToken(erc721Token).burn(_tokenId);
  }

  function mintToken(address _recipient, uint256 _tokenId, bytes memory _metadata) internal {
    IAbstractToken.TokenType _tokenType;
    IAbstractToken.AreaSource _areaSource;
    uint256 _area;
    bytes32 _ledgerIdentifier;
    string memory _humanAddress;
    string memory _dataLink;
    uint256[] memory _contour;
    int256 _highestPoint;

    (
      _tokenType,
      _contour,
      _highestPoint,
      _areaSource,
      _area,
      _ledgerIdentifier,
      _humanAddress,
      _dataLink,
      ,
      ,
    ) = abi.decode(_metadata, (
      IAbstractToken.TokenType,
      // contour
      uint256[],
      // highestPoint
      int256,
      IAbstractToken.AreaSource,
      // area
      uint256,
      // ledgerIdentifier
      bytes32,
      // humanAddress
      string,
      // dataLink
      string,
      // dropping the rest
      uint256, // setupStage
      bytes32, // vertexRootHash
      string // vertexStorageLink
    ));

    IPPBridgedToken(erc721Token).mint(
      _recipient,
      _tokenId,
      _tokenType,
      _areaSource,
      _area,
      _ledgerIdentifier,
      _humanAddress,
      _dataLink,
      _contour,
      _highestPoint
    );
  }

  function recover(address _recipient, uint256 _tokenId) internal {
    IPPBridgedToken(erc721Token).recover(
      _recipient,
      _tokenId
    );
  }

  function bridgeSpecificActionsOnTokenTransfer(address _from, uint256 _tokenId) internal {
    bytes memory metadata = getMetadata(_tokenId);

    IAbstractToken(erc721Token).burn(_tokenId);

    passMessage(_from, _tokenId, metadata);
  }

  mapping(bytes32 => bytes) internal messageHashMetadata;

  function setMessageHashMetadata(bytes32 _hash, bytes memory _metadata) internal {
    messageHashMetadata[_hash] = _metadata;
  }

  function fixFailedMessage(bytes32 _dataHash) external {
    require(msg.sender == address(bridgeContract), "Only bridge allowed");
    require(bridgeContract.messageSender() == mediatorContractOnOtherSide, "Invalid contract on other side");
    require(!messageHashFixed[_dataHash], "Already fixed");

    address recipient = messageHashRecipient[_dataHash];
    uint256 tokenId = messageHashTokenId[_dataHash];

    setMessageHashFixed(_dataHash);
    recover(recipient, tokenId);

    emit FailedMessageFixed(_dataHash, recipient, tokenId);
  }
}
