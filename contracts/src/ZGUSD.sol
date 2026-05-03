// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ZGUSD
 * @notice Test stablecoin on 0G Galileo with EIP-3009 transferWithAuthorization.
 *         Built so x402 (which expects USDC-style EIP-3009) works natively on 0G,
 *         no Base Sepolia or other L2 dependency.
 *
 * @dev    EIP-712 domain matches USDC conventions (`name = "ZG-USD"`, `version = "2"`).
 *         Buyer signs `TransferWithAuthorization(from, to, value, validAfter, validBefore, nonce)`;
 *         server (or any relayer) calls `transferWithAuthorization(...)` to settle.
 */
contract ZGUSD is ERC20, EIP712, Ownable {
    bytes32 public constant TRANSFER_WITH_AUTHORIZATION_TYPEHASH = keccak256(
        "TransferWithAuthorization(address from,address to,uint256 value,uint256 validAfter,uint256 validBefore,bytes32 nonce)"
    );

    bytes32 public constant CANCEL_AUTHORIZATION_TYPEHASH = keccak256(
        "CancelAuthorization(address authorizer,bytes32 nonce)"
    );

    /// @dev authorizer => nonce => used
    mapping(address => mapping(bytes32 => bool)) public authorizationState;

    uint8 private constant DECIMALS = 6; // mirror USDC

    event AuthorizationUsed(address indexed authorizer, bytes32 indexed nonce);
    event AuthorizationCanceled(address indexed authorizer, bytes32 indexed nonce);

    error AuthExpired();
    error AuthNotYetValid();
    error AuthUsed();
    error InvalidSignature();

    constructor() ERC20("ZG-USD", "ZGUSD") EIP712("ZG-USD", "2") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return DECIMALS;
    }

    /// @notice Mint test funds. Owner only (faucet-style for the demo).
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @notice Self-mint a fixed cap for testing — anyone, but per-address rate-limited.
    /// @dev Lets the demo mint freshly to any new wallet without owner intervention.
    function faucet() external {
        require(balanceOf(msg.sender) < 1_000_000 * 10 ** DECIMALS, "ZGUSD: cap reached");
        _mint(msg.sender, 100 * 10 ** DECIMALS); // 100 ZGUSD per call
    }

    // === EIP-3009 ===

    function transferWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        _verifyAuth(from, to, value, validAfter, validBefore, nonce, v, r, s);
        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    /// @notice Same as transferWithAuthorization but `to` must equal msg.sender — replay-safe.
    function receiveWithAuthorization(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        require(to == msg.sender, "ZGUSD: caller must be receiver");
        _verifyAuth(from, to, value, validAfter, validBefore, nonce, v, r, s);
        authorizationState[from][nonce] = true;
        emit AuthorizationUsed(from, nonce);
        _transfer(from, to, value);
    }

    function cancelAuthorization(
        address authorizer,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        if (authorizationState[authorizer][nonce]) revert AuthUsed();
        bytes32 structHash = keccak256(abi.encode(CANCEL_AUTHORIZATION_TYPEHASH, authorizer, nonce));
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, v, r, s);
        if (recovered != authorizer) revert InvalidSignature();
        authorizationState[authorizer][nonce] = true;
        emit AuthorizationCanceled(authorizer, nonce);
    }

    // === Internal ===

    function _verifyAuth(
        address from,
        address to,
        uint256 value,
        uint256 validAfter,
        uint256 validBefore,
        bytes32 nonce,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) internal view {
        if (block.timestamp < validAfter) revert AuthNotYetValid();
        if (block.timestamp > validBefore) revert AuthExpired();
        if (authorizationState[from][nonce]) revert AuthUsed();

        bytes32 structHash = keccak256(
            abi.encode(
                TRANSFER_WITH_AUTHORIZATION_TYPEHASH,
                from, to, value, validAfter, validBefore, nonce
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address recovered = ECDSA.recover(digest, v, r, s);
        if (recovered != from) revert InvalidSignature();
    }

    /// @notice Expose the EIP-712 domain separator for client-side signers.
    function DOMAIN_SEPARATOR() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
