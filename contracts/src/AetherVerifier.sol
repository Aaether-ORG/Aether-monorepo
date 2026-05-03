// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {
    IERC7857DataVerifier,
    PreimageProofOutput,
    TransferValidityProofOutput
} from "./interfaces/IERC7857DataVerifier.sol";

/// @title AetherVerifier
/// @notice Signature-based verifier compatible with IERC7857DataVerifier.
/// @dev    Production should swap this for a real TEE/ZKP verifier (e.g., Intel TDX via Phala).
///         For the hackathon, the "TEE worker" is a Node.js process that holds the authority key.
contract AetherVerifier is IERC7857DataVerifier {
    /// @notice The address authorized to sign valid proofs (TEE worker pubkey).
    address public immutable authority;

    error ProofTooShort();
    error InvalidSignatureLength();

    constructor(address _authority) {
        require(_authority != address(0), "AetherVerifier: zero authority");
        authority = _authority;
    }

    /// @notice Verify preimage proofs. Each proof = `dataHash (32) || sig (65)`.
    function verifyPreimage(
        bytes[] calldata _proofs
    ) external view returns (PreimageProofOutput[] memory out) {
        out = new PreimageProofOutput[](_proofs.length);
        for (uint i = 0; i < _proofs.length; i++) {
            bytes calldata p = _proofs[i];
            if (p.length < 32 + 65) revert ProofTooShort();

            bytes32 dataHash = bytes32(p[:32]);
            bytes calldata sig = p[32:];

            bytes32 claim = keccak256(abi.encodePacked("PREIMAGE", dataHash, authority));
            bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", claim));

            bool ok = _recover(ethHash, sig) == authority;
            out[i] = PreimageProofOutput({ dataHash: dataHash, isValid: ok });
        }
    }

    /// @notice Verify a transfer-validity proof. Each proof =
    ///         `oldHash (32) || newHash (32) || receiver (20) || sealedKey (16) || sig (65)`
    function verifyTransferValidity(
        bytes[] calldata _proofs
    ) external view returns (TransferValidityProofOutput[] memory out) {
        out = new TransferValidityProofOutput[](_proofs.length);
        for (uint i = 0; i < _proofs.length; i++) {
            bytes calldata p = _proofs[i];
            if (p.length < 32 + 32 + 20 + 16 + 65) revert ProofTooShort();

            bytes32 oldH = bytes32(p[:32]);
            bytes32 newH = bytes32(p[32:64]);
            address receiver = address(bytes20(p[64:84]));
            bytes16 sealedKey = bytes16(p[84:100]);
            bytes calldata sig = p[100:];

            bytes32 claim = keccak256(
                abi.encodePacked(
                    "TRANSFER_VALIDITY",
                    oldH,
                    newH,
                    receiver,
                    sealedKey,
                    authority
                )
            );
            bytes32 ethHash = keccak256(
                abi.encodePacked("\x19Ethereum Signed Message:\n32", claim)
            );

            bool ok = _recover(ethHash, sig) == authority;

            out[i] = TransferValidityProofOutput({
                oldDataHash: oldH,
                newDataHash: newH,
                receiver: receiver,
                sealedKey: sealedKey,
                isValid: ok
            });
        }
    }

    function _recover(bytes32 h, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) revert InvalidSignatureLength();
        bytes32 r = bytes32(sig[0:32]);
        bytes32 s = bytes32(sig[32:64]);
        uint8 v = uint8(sig[64]);
        // Tolerate non-EIP-155 v values
        if (v < 27) v += 27;
        return ecrecover(h, v, r, s);
    }
}
