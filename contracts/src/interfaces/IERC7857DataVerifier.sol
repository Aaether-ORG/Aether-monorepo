// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Output of preimage verification.
/// @dev Mirrors `0glabs/0g-agent-nft` (eip-7857-draft) interface verbatim.
struct PreimageProofOutput {
    bytes32 dataHash;
    bool isValid;
}

/// @notice Output of transfer-validity verification.
/// @dev `sealedKey` is `bytes16` because ERC-7857 reference uses AES-128 master keys.
struct TransferValidityProofOutput {
    bytes32 oldDataHash;
    bytes32 newDataHash;
    address receiver;
    bytes16 sealedKey;
    bool isValid;
}

interface IERC7857DataVerifier {
    /// @notice Verify the preimage of a dataHash.
    /// @param _proofs Array of opaque proof bytes.
    function verifyPreimage(
        bytes[] calldata _proofs
    ) external returns (PreimageProofOutput[] memory);

    /// @notice Verify a re-encryption transfer is valid for the receiver.
    function verifyTransferValidity(
        bytes[] calldata _proofs
    ) external returns (TransferValidityProofOutput[] memory);
}
