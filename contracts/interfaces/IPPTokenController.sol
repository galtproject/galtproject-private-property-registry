/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;


interface IPPTokenController {
  event SetGeoDataManager(address indexed geoDataManager);
  event NewProposal(
    uint256 indexed proposalId,
    uint256 indexed tokenId,
    address indexed creator
  );
  event ProposalExecuted(uint256 indexed proposalId);
  event ProposalExecutionFailed(uint256 indexed proposalId);
  event ProposalApproval(
    uint256 indexed proposalId,
    uint256 indexed tokenId
  );
  event ProposalRejection(
    uint256 indexed proposalId,
    uint256 indexed tokenId
  );
  event SetBurner(address burner);
  event SetBurnTimeout(uint256 indexed tokenId, uint256 timeout);
  event InitiateTokenBurn(uint256 indexed tokenId, uint256 timeoutAt);
  event BurnTokenByTimeout(uint256 indexed tokenId);
  event CancelTokenBurn(uint256 indexed tokenId);
  event SetFee(bytes32 indexed key, uint256 value);
  event WithdrawEth(address indexed to, uint256 amount);
  event WithdrawErc20(address indexed to, address indexed tokenAddress, uint256 amount);

  function fees(bytes32) external returns (uint256);
  function setBurner(address _burner) external;
  function setGeoDataManager(address _geoDataManager) external;
  function setBurnTimeoutDuration(uint256 _tokenId, uint256 _duration) external;
  function setFee(bytes32 _key, uint256 _value) external;
  function withdrawErc20(address _tokenAddress, address _to) external;
  function withdrawEth(address payable _to) external;
  function initiateTokenBurn(uint256 _tokenId) external;
  function cancelTokenBurn(uint256 _tokenId) external;
  function burnTokenByTimeout(uint256 _tokenId) external;
  function propose(bytes calldata _data, string calldata _dataLink) external;
  function approve(uint256 _proposalId) external;
  function execute(uint256 _proposalId) external;
  function fetchTokenId(bytes calldata _data) external pure returns (uint256 tokenId);
  function() external payable;
}
