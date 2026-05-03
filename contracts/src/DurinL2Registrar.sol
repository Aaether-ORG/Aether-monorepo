// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {IL2RegistryDurin} from "./interfaces/IL2RegistryDurin.sol";

/**
 * @title DurinL2Registrar
 * @notice Self-contained mintable registrar for Durin L2 subnames.
 *         Mirrors namestonehq/durin/src/examples/L2Registrar.sol minus StringUtils
 *         (we inline a 3-char minimum check).
 */
contract DurinL2Registrar {
    event NameRegistered(string indexed label, address indexed owner);

    IL2RegistryDurin public immutable registry;
    uint256 public chainId;
    uint256 public immutable coinType;

    error LabelTooShort();
    error LabelTaken();

    constructor(address _registry) {
        assembly {
            sstore(chainId.slot, chainid())
        }
        // ENSIP-11 coinType for the current EVM chain
        coinType = (0x80000000 | chainId) >> 0;
        registry = IL2RegistryDurin(_registry);
    }

    /// @notice Register a subname.
    function register(string calldata label, address owner_) external {
        if (_strlen(label) < 3) revert LabelTooShort();

        bytes32 node = _labelToNode(label);
        // Will revert if already registered (ERC-721 transfer to existing token).
        bytes memory addr = abi.encodePacked(owner_);

        registry.setAddr(node, coinType, addr);
        registry.setAddr(node, 60, addr); // mainnet ETH coin type for compat

        registry.createSubnode(
            registry.baseNode(),
            label,
            owner_,
            new bytes[](0)
        );
        emit NameRegistered(label, owner_);
    }

    /// @notice Convenience: register and immediately set a batch of text records.
    function registerWithTexts(
        string calldata label,
        address owner_,
        string[] calldata keys,
        string[] calldata values
    ) external {
        require(keys.length == values.length, "len mismatch");
        if (_strlen(label) < 3) revert LabelTooShort();

        bytes32 node = _labelToNode(label);
        bytes memory addr = abi.encodePacked(owner_);

        registry.setAddr(node, coinType, addr);
        registry.setAddr(node, 60, addr);

        registry.createSubnode(
            registry.baseNode(),
            label,
            owner_,
            new bytes[](0)
        );

        for (uint i = 0; i < keys.length; i++) {
            registry.setText(node, keys[i], values[i]);
        }

        emit NameRegistered(label, owner_);
    }

    function available(string calldata label) external view returns (bool) {
        if (_strlen(label) < 3) return false;
        bytes32 node = _labelToNode(label);
        try registry.ownerOf(uint256(node)) {
            return false;
        } catch {
            return true;
        }
    }

    function _labelToNode(string calldata label) private view returns (bytes32) {
        return registry.makeNode(registry.baseNode(), label);
    }

    /// @dev UTF-8-aware string length (counts code points, not bytes).
    function _strlen(string memory s) private pure returns (uint256) {
        uint256 len;
        uint256 i = 0;
        uint256 bytelength = bytes(s).length;
        for (len = 0; i < bytelength; len++) {
            bytes1 b = bytes(s)[i];
            if (b < 0x80) i += 1;
            else if (b < 0xE0) i += 2;
            else if (b < 0xF0) i += 3;
            else i += 4;
        }
        return len;
    }
}
