// SPDX-License-Identifier: MIT
// Verbatim from 0glabs/0g-agent-nft (eip-7857-draft)
pragma solidity ^0.8.20;

interface IERC7857Metadata {
    event Updated(
        uint256 indexed _tokenId,
        bytes32[] _oldDataHashes,
        bytes32[] _newDataHashes
    );

    function name() external view returns (string memory);
    function symbol() external view returns (string memory);
    function tokenURI(uint256 tokenId) external view returns (string memory);
    function update(uint256 _tokenId, bytes[] calldata _proofs) external;
    function dataHashesOf(uint256 _tokenId) external view returns (bytes32[] memory);
    function dataDescriptionsOf(uint256 _tokenId) external view returns (string[] memory);
}
