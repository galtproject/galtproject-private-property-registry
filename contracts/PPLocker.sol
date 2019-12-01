/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity 0.5.10;

import "openzeppelin-solidity/contracts/token/ERC20/IERC20.sol";
import "@galtproject/libs/contracts/collections/ArraySet.sol";
import "@galtproject/core/contracts/reputation/interfaces/IRA.sol";
import "./interfaces/IPPToken.sol";
import "./interfaces/IPPLocker.sol";
import "./interfaces/IPPTokenRegistry.sol";
import "./interfaces/IPPGlobalRegistry.sol";


contract PPLocker is IPPLocker {
  using ArraySet for ArraySet.AddressSet;

  event ReputationMint(address indexed sra);
  event ReputationBurn(address indexed sra);
  event Deposit(uint256 reputation);
  event Withdrawal(uint256 reputation);
  event TokenBurned(uint256 tokenId);

  bytes32 public constant LOCKER_TYPE = bytes32("REPUTATION");

  IPPGlobalRegistry public globalRegistry;

  address public owner;
  uint256 public tokenId;
  uint256 public reputation;
  bool public tokenDeposited;
  bool public tokenBurned;
  IPPToken public tokenContract;

  // Token Reputation Accounting Contracts
  ArraySet.AddressSet internal traSet;

  modifier onlyOwner() {
    require(isOwner(), "Not the locker owner");
    _;
  }

  modifier notBurned() {
    require(tokenBurned == false, "Token has already burned");
    _;
  }

  modifier onlyValidTokenContract(IPPToken _tokenContract) {
    IPPTokenRegistry(globalRegistry.getPPTokenRegistryAddress()).requireValidToken(address(_tokenContract));
    _;
  }

  constructor(IPPGlobalRegistry _globalRegistry, address _owner) public {
    globalRegistry = _globalRegistry;
    owner = _owner;
  }

  function deposit(
    IPPToken _tokenContract,
    uint256 _tokenId
  )
    external
    payable
    onlyOwner
    onlyValidTokenContract(_tokenContract)
  {
    require(!tokenDeposited, "Token already deposited");
    _acceptPayment(_tokenContract);

    tokenContract = _tokenContract;
    tokenId = _tokenId;
    reputation = _tokenContract.getArea(_tokenId);
    tokenDeposited = true;

    _tokenContract.transferFrom(msg.sender, address(this), _tokenId);

    emit Deposit(reputation);
  }

  function _acceptPayment(IPPToken _tokenContract) internal {
    if (msg.value == 0) {
      uint256 fee = _tokenContract.lockerGaltFee();

      IERC20 galtToken = IERC20(globalRegistry.getGaltTokenAddress());
      galtToken.transferFrom(msg.sender, address(_tokenContract), fee);
    } else {
      uint256 fee = _tokenContract.lockerEthFee();

      require(msg.value == fee, "Invalid ETH fee");

      address(_tokenContract).transfer(msg.value);
    }
  }

  function withdraw() external onlyOwner notBurned {
    require(tokenDeposited, "Token not deposited");
    require(traSet.size() == 0, "RAs counter should be 0");

    IPPToken previousTokenContract = tokenContract;
    uint256 previousTokenId = tokenId;

    tokenContract = IPPToken(address(0));
    tokenId = 0;
    reputation = 0;
    tokenDeposited = false;

    previousTokenContract.transferFrom(address(this), msg.sender, previousTokenId);

    emit Withdrawal(reputation);
  }

  function approveMint(IRA _tra) external onlyOwner notBurned {
    require(!traSet.has(address(_tra)), "Already minted to this RA");
    require(_tra.ping() == bytes32("pong"), "Handshake failed");

    traSet.add(address(_tra));

    emit ReputationMint(address(_tra));
  }

  function burn(IRA _tra) external onlyOwner {
    require(traSet.has(address(_tra)), "Not minted to the RA");
    require(_tra.balanceOf(msg.sender) == 0, "Reputation not completely burned");

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
      bool _tokenBurned,
      address _tokenContract
    )
  {
    return (
      owner,
      tokenId,
      reputation,
      tokenDeposited,
      tokenBurned,
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
