/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "../interfaces/IPPGlobalRegistry.sol";
import "../interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPBridgedToken.sol";
import "./interfaces/IPPBridgedLocker.sol";


contract PPBridgedLocker is IPPBridgedLocker {
  using ArraySet for ArraySet.AddressSet;

  event ReputationMint(address indexed sra);
  event ReputationBurn(address indexed sra);
  event Deposit(uint256 reputation);
  event Withdrawal(uint256 reputation);

  bytes32 public constant LOCKER_TYPE = bytes32("REPUTATION");

  IPPGlobalRegistry public globalRegistry;

  address public owner;
  uint256 public tokenId;
  uint256 public reputation;
  bool public tokenDeposited;
  IPPBridgedToken public tokenContract;

  // Token Reputation Accounting Contracts
  ArraySet.AddressSet internal traSet;

  modifier onlyOwner() {
    require(isOwner(), "Not the locker owner");
    _;
  }

  modifier onlyValidTokenContract(IPPBridgedToken _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(address(_tokenContract));
    _;
  }

  constructor(IPPGlobalRegistry _globalRegistry, address _owner) public {
    globalRegistry = _globalRegistry;
    owner = _owner;
  }

  function deposit(
    IPPBridgedToken _tokenContract,
    uint256 _tokenId
  )
    external
    payable
    onlyOwner
    onlyValidTokenContract(_tokenContract)
  {
    require(!tokenDeposited, "Token already deposited");

    tokenContract = _tokenContract;
    tokenId = _tokenId;
    reputation = _tokenContract.getArea(_tokenId);
    tokenDeposited = true;

    _tokenContract.transferFrom(msg.sender, address(this), _tokenId);

    emit Deposit(reputation);
  }

  function withdraw() external onlyOwner {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    IPPBridgedToken previousTokenContract = tokenContract;
    uint256 previousTokenId = tokenId;

    tokenContract = IPPBridgedToken(address(0));
    tokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    previousTokenContract.transferFrom(address(this), msg.sender, previousTokenId);

    emit Withdrawal(reputation);
  }

  function approveMint(IPPRA _tra) external onlyOwner {
    require(!traSet.has(address(_tra)), "Already minted to this RA");
    require(_tra.ping() == bytes32("pong"), "Handshake failed");

    traSet.add(address(_tra));

    emit ReputationMint(address(_tra));
  }

  function burn(IPPRA _tra) external onlyOwner {
    require(traSet.has(address(_tra)), "Not minted to the RA");
    require(_tra.reputationMinted(address(tokenContract), tokenId) == false, "Reputation not completely burned");

    traSet.remove(address(_tra));

    emit ReputationBurn(address(_tra));
  }

  // GETTERS

  function isOwner() public view returns (bool) {
    return msg.sender == owner;
  }

  function getTokenInfo()
    public
    view
    returns (
      address _owner,
      uint256 _tokenId,
      uint256 _reputation,
      bool _tokenDeposited,
      address _tokenContract
    )
  {
    return (
      owner,
      tokenId,
      reputation,
      tokenDeposited,
      address(tokenContract)
    );
  }

  function isMinted(address _tra) external view returns (bool) {
    return traSet.has(_tra);
  }

  function getTras() external view returns (address[] memory) {
    return traSet.elements();
  }

  function getTrasCount() external view returns (uint256) {
    return traSet.size();
  }
}
