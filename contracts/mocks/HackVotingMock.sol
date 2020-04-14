pragma solidity ^0.5.13;

import "../interfaces/IPPToken.sol";


contract HackVotingMock {
  event PreCall(bytes data);
  event Result(bool status, bytes response);

  address public registry;

  constructor(address _registry) public {
    registry = _registry;
  }

  function voteByTokens(
    uint256[] calldata _tokenIds,
    uint256 _voteId,
    bool _support,
    bool _executesIfDecided
  )
   external
  {
    bytes4 methodSelector = IAbstractToken(0).transferFrom.selector;
    bytes memory _data = abi.encodeWithSelector(methodSelector, msg.sender, address(this), _tokenIds[0]);
    emit PreCall(_data);
    (bool status, bytes memory response) = registry.delegatecall(_data);
    emit Result(status, response);
  }
}