/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "../interfaces/IPPTokenRegistry.sol";
import "../interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IAbstractLocker.sol";
import "./interfaces/IAbstractToken.sol";
import "./interfaces/IAbstractRA.sol";

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/core/contracts/Checkpointable.sol";


contract AbstractLocker is IAbstractLocker, Checkpointable {
  using ArraySet for ArraySet.AddressSet;

  uint256 public constant VERSION = 3;

  event ReputationMint(address indexed sra);
  event ReputationBurn(address indexed sra);
  event Deposit(uint256 totalReputation);
  event Withdrawal(uint256 totalReputation);

  event ChangeOwners();
  event TransferShare(address indexed oldOwner, address indexed newOwner);

  bytes32 public constant LOCKER_TYPE = bytes32("REPUTATION");

  IPPGlobalRegistry public globalRegistry;

  uint256 public tokenId;
  uint256 public totalReputation;
  bool public tokenDeposited;
  IAbstractToken public tokenContract;

  address public depositManager;
  address public proposalManager;

  uint256 public totalShares;
  address[] public owners;
  uint256[] public shares;
  mapping(address => uint256) public reputationByOwner;
  mapping(address => uint256) public shareByOwner;

  // Token Reputation Accounting Contracts
  ArraySet.AddressSet internal traSet;

  modifier onlyOwner() {
    require(reputationByOwner[msg.sender] > 0, "Not the locker owner");
    _;
  }

  modifier onlyDepositManager() {
    require(msg.sender == depositManager, "Not the deposit manager");
    _;
  }

  modifier onlyProposalManager() {
    require(msg.sender == proposalManager, "Not the proposal manager");
    _;
  }

  modifier onlyValidTokenContract(IAbstractToken _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(address(_tokenContract));
    _;
  }

  constructor(
    address _globalRegistry,
    address _depositManager,
    address _proposalManager
  ) public {
    globalRegistry = IPPGlobalRegistry(_globalRegistry);
    depositManager = _depositManager;
    proposalManager = _proposalManager;
  }

  // DEPOSIT MANAGER INTERFACE
  function deposit(
    IAbstractToken _tokenContract,
    uint256 _tokenId,
    address[] memory _owners,
    uint256[] memory _shares,
    uint256 _totalShares
  )
    public
    payable
    onlyValidTokenContract(_tokenContract)
    onlyDepositManager
  {
    require(!tokenDeposited, "Token already deposited");

    tokenContract = _tokenContract;
    tokenId = _tokenId;
    tokenDeposited = true;

    _setOwners(_owners, _shares, _totalShares);

    _tokenContract.transferFrom(msg.sender, address(this), _tokenId);

    emit Deposit(totalReputation);
  }

  function depositAndMint(
    IAbstractToken _tokenContract,
    uint256 _tokenId,
    address[] calldata _owners,
    uint256[] calldata _shares,
    uint256 _totalShares,
    IAbstractRA _tra,
    bool _mintReputation
  )
    external
    payable
    onlyDepositManager
  {
    deposit(_tokenContract, _tokenId, _owners, _shares, _totalShares);
    _approveMint(_tra);
    if (_mintReputation) {
      _tra.mint(this);
    }
  }

  // PROPOSAL MANAGER INTERFACE
  function withdraw(address _newOwner, address _newDepositManager) external onlyProposalManager {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    depositManager = _newDepositManager;

    IAbstractToken previousTokenContract = tokenContract;
    uint256 previousTokenId = tokenId;

    tokenContract = IAbstractToken(address(0));
    tokenId = 0;
    totalReputation = 0;
    tokenDeposited = false;

    uint256 len = owners.length;
    for (uint256 i = 0; i < len; i++) {
      reputationByOwner[owners[i]] = 0;
      shareByOwner[owners[i]] = 0;
      _updateValueAtNow(_cachedBalances[owners[i]], 0);
    }
    _updateValueAtNow(_cachedTotalSupply, 0);

    owners = new address[](0);
    totalShares = 0;

    previousTokenContract.transferFrom(address(this), _newOwner, previousTokenId);

    emit Withdrawal(totalReputation);
  }

  function approveMint(IAbstractRA _tra) external onlyProposalManager {
    _approveMint(_tra);
  }

  function approveAndMint(IAbstractRA _tra) external onlyProposalManager {
    _approveMint(_tra);
    _tra.mint(this);
  }

  function burn(IAbstractRA _tra) public onlyProposalManager {
    require(traSet.has(address(_tra)), "Not minted to the RA");
    require(_tra.tokenReputationMinted(address(tokenContract), tokenId) == 0, "Reputation not completely burned");

    traSet.remove(address(_tra));

    emit ReputationBurn(address(_tra));
  }

  function burnWithReputation(IAbstractRA _tra) external onlyProposalManager {
    _tra.approveBurn(this);
    burn(_tra);
  }

  function changeOwners(
    address[] memory _owners,
    uint256[] memory _shares,
    uint256 _totalShares
  )
    public
    payable
    onlyProposalManager
  {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    _setOwners(_owners, _shares, _totalShares);

    emit ChangeOwners();
  }

  function transferShare(address _newShareOwner) public payable onlyOwner {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    address[] memory lastOwners = owners;
    uint256[] memory lastShares = shares;
    uint256 lastTotalShares = totalShares;

    uint256 shareOfOwner = shareByOwner[msg.sender];
    uint256 shareOfNewOwner = shareByOwner[_newShareOwner];

    _clearOwnersShareAndReputation();

    owners.push(_newShareOwner);
    shares.push(shareOfOwner + shareOfNewOwner);

    uint256 len = lastOwners.length;
    for (uint256 i = 0; i < len; i++) {
      if (lastOwners[i] == msg.sender || lastOwners[i] == _newShareOwner) {
        continue;
      }
      owners.push(lastOwners[i]);
      shares.push(lastShares[i]);
    }

    _setOwners(owners, shares, lastTotalShares);

    emit TransferShare(msg.sender, _newShareOwner);
  }

  // INTERNAL
  function _approveMint(IAbstractRA _tra) internal {
    require(!traSet.has(address(_tra)), "Already minted to this RA");
    require(_tra.ping() == bytes32("pong"), "Handshake failed");

    traSet.add(address(_tra));

    emit ReputationMint(address(_tra));
  }

  function _clearOwnersShareAndReputation() internal {
    uint256 len = owners.length;
    for (uint256 i = 0; i < len; i++) {
      reputationByOwner[owners[i]] = 0;
      shareByOwner[owners[i]] = 0;
      _updateValueAtNow(_cachedBalances[owners[i]], 0);
    }

    owners = new address[](0);
    shares = new uint256[](0);
    totalShares = 0;
  }

  function _setOwners(address[] memory _owners, uint256[] memory _shares, uint256 _totalShares) internal {
    uint256 tokenArea = tokenContract.getArea(tokenId);
    require(tokenArea > 0, "Token area can not be 0");

    _clearOwnersShareAndReputation();

    owners = _owners;
    shares = _shares;
    totalShares = _totalShares;

    uint256 len = _owners.length;
    require(len == _shares.length, "Owners and shares length does not match");

    uint256 calcTotalShares = 0;
    uint256 calcReputation = 0;
    for (uint256 i = 0; i < len; i++) {
      require(_shares[i] > 0, "Share can not be 0");
      uint256 ownerReputation = (_shares[i] * tokenArea) / _totalShares;
      reputationByOwner[_owners[i]] = ownerReputation;
      shareByOwner[owners[i]] = _shares[i];
      _updateValueAtNow(_cachedBalances[_owners[i]], ownerReputation);
      calcTotalShares += _shares[i];
      calcReputation += ownerReputation;
    }
    totalReputation = calcReputation;

    _updateValueAtNow(_cachedTotalSupply, totalReputation);
    require(calcTotalShares == _totalShares, "Calculated shares and total shares does not equal");
  }

  // GETTERS

  function getLockerInfo()
    public
    view
    returns (
      address[] memory _owners,
      uint256[] memory _ownersReputation,
      address _tokenContract,
      uint256 _tokenId,
      uint256 _totalReputation,
      bool _tokenDeposited,
      uint256[] memory _shares,
      uint256 _totalShares
    )
  {
    uint256 len = owners.length;
    uint256[] memory ownersReputation = new uint256[](len);
    for (uint256 i = 0; i < len; i++) {
      ownersReputation[i] = reputationByOwner[owners[i]];
    }

    return (
      owners,
      ownersReputation,
      address(tokenContract),
      tokenId,
      totalReputation,
      tokenDeposited,
      shares,
      totalShares
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

  function reputationOf(address _address) public view returns (uint256) {
    return reputationByOwner[_address];
  }

  function reputationOfAt(address _address, uint256 _blockNumber) public view returns (uint256) {
    return _balanceOfAt(_address, _blockNumber);
  }

  function totalReputationSupplyAt(uint256 _blockNumber) public view returns (uint256) {
    return _totalSupplyAt(_blockNumber);
  }
}
