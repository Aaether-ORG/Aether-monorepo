// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * Minimal interface to Durin's L2Registry for our deploy + register flow.
 * We only need the functions we actually call.
 */
interface IL2RegistryDurin {
    function baseNode() external view returns (bytes32);
    function makeNode(bytes32 parentNode, string calldata label) external pure returns (bytes32);
    function namehash(string calldata name) external pure returns (bytes32);
    function owner() external view returns (address);
    function owner(bytes32 node) external view returns (address);
    function ownerOf(uint256 tokenId) external view returns (address);
    function registrars(address registrar) external view returns (bool);

    function createSubnode(
        bytes32 node,
        string calldata label,
        address owner_,
        bytes[] calldata data
    ) external returns (bytes32);

    function setAddr(bytes32 node, uint256 coinType, bytes calldata a) external;
    function setText(bytes32 node, string calldata key, string calldata value) external;

    // Admin
    function addRegistrar(address registrar) external;
    function removeRegistrar(address registrar) external;
}
