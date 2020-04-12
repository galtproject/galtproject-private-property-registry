/*
 * Copyright ©️ 2018 Galt•Project Society Construction and Terraforming Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka)
 *
 * Copyright ©️ 2018 Galt•Core Blockchain Company
 * (Founded by [Nikolai Popeka](https://github.com/npopeka) by
 * [Basic Agreement](ipfs/QmaCiXUmSrP16Gz8Jdzq6AJESY1EAANmmwha15uR3c1bsS)).
 */

pragma solidity ^0.5.13;

import "./IAbstractToken.sol";
import "./IAbstractRA.sol";


interface IAbstractLocker {
  function deposit(
    IAbstractToken _tokenContract,
    uint256 _tokenId,
    address[] calldata _owners,
    uint256[] calldata _shares,
    uint256 _totalShares
  ) external payable;
  function withdraw(address _newOwner, address _newDepositManager) external;
  function approveMint(IAbstractRA _tra) external;
  function burn(IAbstractRA _tra) external;
  function isMinted(address _tra) external view returns (bool);
  function getTras() external view returns (address[] memory);
  function getTrasCount() external view returns (uint256);
  function depositManager() external view returns(address);
  function tokenId() external view returns(uint256);
  function totalReputation() external view returns(uint256);
  function tokenContract() external view returns(IAbstractToken);

  function getLockerInfo()
    external
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
    );
}
