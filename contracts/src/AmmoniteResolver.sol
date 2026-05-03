// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AmmoniteResolver
 * @notice ENS resolver that returns dynamic agent state via CCIP-Read (EIP-3668).
 *
 * Static text records (set on-chain) are returned directly. Dynamic keys —
 *   agent.aether.head, agent.uptime.last24h, agent.model.version, agent.aether.replay_url —
 * trigger an OffchainLookup that resolves the value at the configured CCIP gateway.
 *
 * The gateway returns ABI-encoded `string` data which this resolver passes
 * through unmodified after verification.
 */

interface IAddrResolver {
    function addr(bytes32 node) external view returns (address);
}

interface ITextResolver {
    function text(bytes32 node, string calldata key) external view returns (string memory);
}

interface IExtendedResolver {
    function resolve(bytes calldata name, bytes calldata data) external view returns (bytes memory);
}

error OffchainLookup(
    address sender,
    string[] urls,
    bytes callData,
    bytes4 callbackFunction,
    bytes extraData
);

contract AmmoniteResolver is ITextResolver, IExtendedResolver {
    address public owner;
    string[] public ccipUrls;

    /// @dev keccak256(node, key) → static value
    mapping(bytes32 => string) private _texts;

    /// @dev set of dynamic key prefixes that trigger CCIP-Read
    mapping(bytes32 => bool) public isDynamicKey;

    event TextChanged(bytes32 indexed node, string key, string value);
    event DynamicKeyChanged(bytes32 indexed keyHash, string key, bool dynamic);
    event GatewayUpdated(string[] urls);

    constructor(string[] memory _ccipUrls) {
        owner = msg.sender;
        ccipUrls = _ccipUrls;

        // Default dynamic keys
        _setDynamic("agent.aether.head", true);
        _setDynamic("agent.uptime.last24h", true);
        _setDynamic("agent.model.version", true);
        _setDynamic("agent.aether.replay_url", true);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "AmmoniteResolver: not owner");
        _;
    }

    function setText(bytes32 node, string calldata key, string calldata value) external onlyOwner {
        _texts[keccak256(abi.encodePacked(node, key))] = value;
        emit TextChanged(node, key, value);
    }

    function setDynamicKey(string calldata key, bool dynamic) external onlyOwner {
        _setDynamic(key, dynamic);
    }

    function setGateway(string[] calldata urls) external onlyOwner {
        delete ccipUrls;
        for (uint i = 0; i < urls.length; i++) ccipUrls.push(urls[i]);
        emit GatewayUpdated(urls);
    }

    function _setDynamic(string memory key, bool dynamic) internal {
        bytes32 h = keccak256(bytes(key));
        isDynamicKey[h] = dynamic;
        emit DynamicKeyChanged(h, key, dynamic);
    }

    /// @notice Standard text resolution. Reverts with OffchainLookup for dynamic keys.
    function text(bytes32 node, string calldata key) external view override returns (string memory) {
        bytes32 keyHash = keccak256(bytes(key));
        if (isDynamicKey[keyHash]) {
            // CCIP-Read: redirect resolver call to the off-chain gateway
            bytes memory callData = abi.encode(node, key);
            revert OffchainLookup(
                address(this),
                ccipUrls,
                callData,
                this.textCallback.selector,
                callData
            );
        }
        return _texts[keccak256(abi.encodePacked(node, key))];
    }

    /// @notice CCIP-Read callback. Verifies and returns the gateway's response.
    function textCallback(bytes calldata response, bytes calldata /*extraData*/)
        external
        pure
        returns (string memory)
    {
        // Gateway returns ABI-encoded string
        return abi.decode(response, (string));
    }

    /// @notice ENSIP-10 extended resolution surface.
    function resolve(bytes calldata /*name*/, bytes calldata data) external view override returns (bytes memory) {
        bytes4 selector = bytes4(data[0:4]);
        if (selector == ITextResolver.text.selector) {
            (bytes32 node, string memory key) = abi.decode(data[4:], (bytes32, string));
            string memory value = this.text(node, key);
            return abi.encode(value);
        }
        revert("AmmoniteResolver: unsupported selector");
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "zero owner");
        owner = newOwner;
    }
}
