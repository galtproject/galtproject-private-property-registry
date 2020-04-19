/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./abstract/AbstractLocker.sol";
import "./interfaces/IPPTokenController.sol";
import "./interfaces/IPPToken.sol";


contract PPLocker is AbstractLocker {

  bytes32 public constant GALT_FEE_KEY = bytes32("LOCKER_GALT");
  bytes32 public constant ETH_FEE_KEY = bytes32("LOCKER_ETH");

  constructor(
    address _globalRegistry,
    address _depositManager,
    address _proposalManager
  )
    public
    AbstractLocker(_globalRegistry, _depositManager, _proposalManager)
  {

  }

  function deposit(
    IAbstractToken _tokenContract,
    uint256 _tokenId,
    address[] memory _owners,
    uint256[] memory _shares,
    uint256 _totalShares
  )
    public
    payable
  {
    super.deposit(_tokenContract, _tokenId, _owners, _shares, _totalShares);

    _acceptPayment(_tokenContract);
  }

  function _acceptPayment(IAbstractToken _tokenContract) internal {
    IPPTokenController controller = IPPTokenController(IPPToken(address(_tokenContract)).controller());
    if (msg.value == 0) {
      uint256 fee = controller.fees(GALT_FEE_KEY);

      IERC20 galtToken = IERC20(globalRegistry.getGaltTokenAddress());
      galtToken.transferFrom(msg.sender, address(controller), fee);
    } else {
      uint256 fee = controller.fees(ETH_FEE_KEY);

      require(msg.value == fee, "Invalid ETH fee");

      address(controller).transfer(msg.value);
    }
  }
}
