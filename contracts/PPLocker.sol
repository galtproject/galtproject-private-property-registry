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
import "./interfaces/IPPToken.sol";
import "./interfaces/IPPLocker.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPTokenController.sol";
import "./interfaces/IPPGlobalRegistry.sol";
import "./interfaces/IPPRA.sol";
import "./interfaces/IPPTokenVoting.sol";

import "@galtproject/core/contracts/reputation/AbstractProposalManager.sol";


contract PPLocker is IPPLocker, AbstractProposalManager {
  using ArraySet for ArraySet.AddressSet;

  uint256 public constant VERSION = 2;

  event ReputationMint(address indexed sra);
  event ReputationBurn(address indexed sra);
  event Deposit(uint256 totalReputation);
  event Withdrawal(uint256 totalReputation);

  bytes32 public constant LOCKER_TYPE = bytes32("REPUTATION");
  bytes32 public constant GALT_FEE_KEY = bytes32("LOCKER_GALT");
  bytes32 public constant ETH_FEE_KEY = bytes32("LOCKER_ETH");

  IPPGlobalRegistry public globalRegistry;

  uint256 public tokenId;
  uint256 public reputation;
  bool public tokenDeposited;
  IPPToken public tokenContract;

  address public depositManager;

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
    require(msg.sender == address(this), "Not the proposal manager");
    _;
  }

  modifier onlyValidTokenContract(IPPToken _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(address(_tokenContract));
    _;
  }

  constructor(IPPGlobalRegistry _globalRegistry, address _depositManager) public {
    globalRegistry = _globalRegistry;
    depositManager = _depositManager;
  }

  function deposit(
    IPPToken _tokenContract,
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
    _acceptPayment(_tokenContract);

    tokenContract = _tokenContract;
    tokenId = _tokenId;
    reputation = _tokenContract.getArea(_tokenId);
    tokenDeposited = true;

    owners = _owners;
    shares = _shares;
    totalShares = _totalShares;

    uint256 len = _owners.length;
    require(len == _shares.length, "Owners and shares length does not match");

    uint256 _calcTotalShares = 0;
    for(uint256 i = 0; i < len; i++) {
      require(_shares[i] > 0, "Share can not be 0");
      reputationByOwner[_owners[i]] = (_shares[i] * reputation) / _totalShares;
      _calcTotalShares += _shares[i];
    }
    require(_calcTotalShares == _totalShares, "Calculated shares and total shares does not equal");

    _tokenContract.transferFrom(msg.sender, address(this), _tokenId);

    emit Deposit(reputation);
  }

  function _acceptPayment(IPPToken _tokenContract) internal {
    if (msg.value == 0) {
      uint256 fee = IPPTokenController(_tokenContract.controller()).fees(GALT_FEE_KEY);

      IERC20 galtToken = IERC20(globalRegistry.getGaltTokenAddress());
      galtToken.transferFrom(msg.sender, _tokenContract.controller(), fee);
    } else {
      uint256 fee = IPPTokenController(_tokenContract.controller()).fees(ETH_FEE_KEY);

      require(msg.value == fee, "Invalid ETH fee");

      _tokenContract.controller().transfer(msg.value);
    }
  }

  function withdraw(address _newOwner, address _newDepositManager) external onlyProposalManager {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    depositManager = _newDepositManager;

    IPPToken previousTokenContract = tokenContract;
    uint256 previousTokenId = tokenId;

    tokenContract = IPPToken(address(0));
    tokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    uint256 len = owners.length;
    for(uint256 i = 0; i < len; i++) {
      reputationByOwner[owners[i]] = 0;
      shareByOwner[owners[i]] = 0;
    }

    owners = new address[](0);
    totalShares = 0;

    previousTokenContract.transferFrom(address(this), _newOwner, previousTokenId);

    emit Withdrawal(reputation);
  }

  function approveMint(IPPRA _tra) public onlyProposalManager {
    require(!traSet.has(address(_tra)), "Already minted to this RA");
    require(_tra.ping() == bytes32("pong"), "Handshake failed");

    traSet.add(address(_tra));

    emit ReputationMint(address(_tra));
  }

  function depositAndApproveMint(
    IPPToken _tokenContract,
    uint256 _tokenId,
    address[] calldata _owners,
    uint256[] calldata _shares,
    uint256 _totalShares,
    IPPRA _tra
  )
    external
    payable
    onlyDepositManager
  {
    deposit(_tokenContract, _tokenId, _owners, _shares, _totalShares);
    approveMint(_tra);
  }

  function depositAndMint(
    IPPToken _tokenContract,
    uint256 _tokenId,
    address[] calldata _owners,
    uint256[] calldata _shares,
    uint256 _totalShares,
    IPPRA _tra
  )
    external
    payable
    onlyDepositManager
  {
    deposit(_tokenContract, _tokenId, _owners, _shares, _totalShares);
    approveMint(_tra);
    _tra.mint(this);
  }

  function approveAndMint(IPPRA _tra) external onlyProposalManager {
    approveMint(_tra);
    _tra.mint(this);
  }

  function burn(IPPRA _tra) public onlyProposalManager {
    require(traSet.has(address(_tra)), "Not minted to the RA");
    require(_tra.reputationMinted(address(tokenContract), tokenId) == false, "Reputation not completely burned");

    traSet.remove(address(_tra));

    emit ReputationBurn(address(_tra));
  }

  function burnWithReputation(IPPRA _tra) external onlyProposalManager {
    _tra.approveBurn(this);
    burn(_tra);
  }

  function propose(
    address _destination,
    uint256 _value,
    bool _castVote,
    bool _executesIfDecided,
    bytes calldata _data,
    string calldata _dataLink
  )
    external
    payable
    onlyOwner
  {
    require(tokenDeposited, "Token not deposited");
    require(_destination != address(tokenContract), "Destination can not be the tokenContract");
    _propose(_destination, _value, _castVote, _executesIfDecided, _data, _dataLink);
  }

  // GETTERS

  function getTokenInfo()
    public
    view
    returns (
      address[] memory _owners,
      uint256[] memory _ownersReputation,
      uint256[] memory _shares,
      uint256 _totalShares,
      uint256 _tokenId,
      uint256 _reputation,
      bool _tokenDeposited,
      address _tokenContract
    )
  {
    uint256 len = owners.length;
    uint256[] memory ownersReputation = new uint256[](len);
    for(uint256 i = 0; i < len; i++) {
      ownersReputation[i] = reputationByOwner[owners[i]];
    }

    return (
      owners,
      ownersReputation,
      shares,
      totalShares,
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
