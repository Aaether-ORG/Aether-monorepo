// SPDX-License-Identifier: GPL-3.0
pragma solidity ^0.8.20;

import "./IERC7857DataVerifier.sol";

/// @notice Verbatim ERC-7857 interface from 0glabs/0g-agent-nft (eip-7857-draft).
interface IERC7857 {
    event Minted(
        uint256 indexed _tokenId,
        address indexed _creator,
        address indexed _owner,
        bytes32[] _dataHashes,
        string[] _dataDescriptions
    );
    event Authorization(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event Transferred(uint256 _tokenId, address indexed _from, address indexed _to);
    event Cloned(uint256 indexed _tokenId, uint256 indexed _newTokenId, address _from, address _to);
    event PublishedSealedKey(address indexed _to, uint256 indexed _tokenId, bytes16[] _sealedKeys);

    function verifier() external view returns (IERC7857DataVerifier);

    function mint(
        bytes[] calldata _proofs,
        string[] calldata _dataDescriptions,
        address _to
    ) external payable returns (uint256 _tokenId);

    function transfer(address _to, uint256 _tokenId, bytes[] calldata _proofs) external;
    function clone(address _to, uint256 _tokenId, bytes[] calldata _proofs) external returns (uint256);
    function authorizeUsage(uint256 _tokenId, address _user) external;
    function ownerOf(uint256 _tokenId) external view returns (address);
    function authorizedUsersOf(uint256 _tokenId) external view returns (address[] memory);
}
