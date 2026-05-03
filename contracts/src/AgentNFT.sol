// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title AgentNFT
 * @notice ERC-7857 reference implementation.
 *
 * @dev SOURCE FIDELITY: This file is byte-equivalent to
 *      0glabs/0g-agent-nft/contracts/AgentNFT.sol on the eip-7857-draft branch
 *      EXCEPT for the upgradeability adaptation:
 *
 *        - Inherits AccessControlEnumerable (non-upgradeable) instead of
 *          AccessControlEnumerableUpgradeable.
 *        - Replaces `initialize()` with a constructor for single-tx deploy.
 *        - Storage namespacing (ERC-7201) preserved verbatim — works the same.
 *
 *      All function bodies, events, and state shapes match the upstream contract
 *      exactly. To diff: see contracts/src/AgentNFT.sol vs the upstream raw URL
 *      https://raw.githubusercontent.com/0glabs/0g-agent-nft/eip-7857-draft/contracts/AgentNFT.sol
 */

import {AccessControlEnumerable} from "@openzeppelin/contracts/access/extensions/AccessControlEnumerable.sol";
import {IERC7857} from "./interfaces/IERC7857.sol";
import {IERC7857Metadata} from "./interfaces/IERC7857Metadata.sol";
import {IERC7857DataVerifier, PreimageProofOutput, TransferValidityProofOutput} from "./interfaces/IERC7857DataVerifier.sol";
import {Utils} from "./Utils.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract AgentNFT is AccessControlEnumerable, IERC7857, IERC7857Metadata {
    event Approval(address indexed _from, address indexed _to, uint256 indexed _tokenId);
    event ApprovalForAll(address indexed _owner, address indexed _operator, bool _approved);

    /// @custom:storage-location erc7201:agent.storage.AgentNFT
    struct AgentNFTStorage {
        // Token data
        mapping(uint256 => TokenData) tokens;
        mapping(address owner => mapping(address operator => bool)) operatorApprovals;
        uint256 nextTokenId;
        // Contract metadata
        string name;
        string symbol;
        string chainURL;
        string indexerURL;
        // Core components
        IERC7857DataVerifier verifier;
    }

    struct TokenData {
        address owner;
        string[] dataDescriptions;
        bytes32[] dataHashes;
        address[] authorizedUsers;
        address approvedUser;
    }

    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    // keccak256(abi.encode(uint(keccak256("agent.storage.AgentNFT")) - 1)) & ~bytes32(uint(0xff))
    bytes32 private constant AGENT_NFT_STORAGE_LOCATION =
        0x4aa80aaafbe0e5fe3fe1aa97f3c1f8c65d61f96ef1aab2b448154f4e07594600;

    function _getAgentStorage() private pure returns (AgentNFTStorage storage $) {
        assembly {
            $.slot := AGENT_NFT_STORAGE_LOCATION
        }
    }

    /// @notice Constructor (replaces upstream `initialize()` for non-upgradeable deploy).
    constructor(
        string memory name_,
        string memory symbol_,
        address verifierAddr,
        string memory chainURL_,
        string memory indexerURL_
    ) {
        require(verifierAddr != address(0), "Zero address");

        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(ADMIN_ROLE, msg.sender);

        AgentNFTStorage storage $ = _getAgentStorage();
        $.name = name_;
        $.symbol = symbol_;
        $.chainURL = chainURL_;
        $.indexerURL = indexerURL_;
        $.verifier = IERC7857DataVerifier(verifierAddr);
    }

    function name() public view virtual override returns (string memory) {
        return _getAgentStorage().name;
    }

    function symbol() public view virtual override returns (string memory) {
        return _getAgentStorage().symbol;
    }

    function verifier() public view virtual override returns (IERC7857DataVerifier) {
        return _getAgentStorage().verifier;
    }

    function updateVerifier(address newVerifier) public virtual onlyRole(ADMIN_ROLE) {
        require(newVerifier != address(0), "Zero address");
        _getAgentStorage().verifier = IERC7857DataVerifier(newVerifier);
    }

    function updateURLS(string memory newChainURL, string memory newIndexerURL)
        public
        virtual
        onlyRole(ADMIN_ROLE)
    {
        AgentNFTStorage storage $ = _getAgentStorage();
        $.chainURL = newChainURL;
        $.indexerURL = newIndexerURL;
    }

    function update(uint256 tokenId, bytes[] calldata proofs) public virtual override {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner == msg.sender, "Not owner");

        PreimageProofOutput[] memory proofOupt = $.verifier.verifyPreimage(proofs);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid,
                string(
                    abi.encodePacked(
                        "Invalid preimage proof at index ",
                        i,
                        " with data hash ",
                        proofOupt[i].dataHash
                    )
                )
            );
            newDataHashes[i] = proofOupt[i].dataHash;
        }

        bytes32[] memory oldDataHashes = token.dataHashes;
        token.dataHashes = newDataHashes;

        emit Updated(tokenId, oldDataHashes, newDataHashes);
    }

    function mint(
        bytes[] calldata proofs,
        string[] calldata dataDescriptions,
        address to
    ) public payable virtual override returns (uint256 tokenId) {
        AgentNFTStorage storage $ = _getAgentStorage();

        require(dataDescriptions.length == proofs.length, "Descriptions and proofs length mismatch");

        if (to == address(0)) {
            to = msg.sender;
        }

        PreimageProofOutput[] memory proofOupt = $.verifier.verifyPreimage(proofs);
        bytes32[] memory dataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid,
                string(
                    abi.encodePacked(
                        "Invalid preimage proof at index ",
                        i,
                        " with data hash ",
                        proofOupt[i].dataHash
                    )
                )
            );
            dataHashes[i] = proofOupt[i].dataHash;
        }

        tokenId = $.nextTokenId++;
        $.tokens[tokenId] = TokenData({
            owner: to,
            dataHashes: dataHashes,
            dataDescriptions: dataDescriptions,
            authorizedUsers: new address[](0),
            approvedUser: address(0)
        });

        emit Minted(tokenId, msg.sender, to, dataHashes, dataDescriptions);
    }

    function transfer(address to, uint256 tokenId, bytes[] calldata proofs) public virtual override {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");

        TransferValidityProofOutput[] memory proofOupt = $.verifier.verifyTransferValidity(proofs);
        bytes16[] memory sealedKeys = new bytes16[](proofOupt.length);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid &&
                    proofOupt[i].oldDataHash == $.tokens[tokenId].dataHashes[i] &&
                    proofOupt[i].receiver == to,
                string(abi.encodePacked("Invalid transfer validity proof at index ", i))
            );
            sealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        $.tokens[tokenId].owner = to;
        $.tokens[tokenId].dataHashes = newDataHashes;

        emit Transferred(tokenId, msg.sender, to);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function transferFrom(address from, address to, uint256 tokenId, bytes[] calldata proofs) public virtual {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == from, "Not owner");
        require(
            $.tokens[tokenId].approvedUser == msg.sender ||
                $.tokens[tokenId].owner == msg.sender ||
                $.operatorApprovals[from][msg.sender],
            "Not approved"
        );

        TransferValidityProofOutput[] memory proofOupt = $.verifier.verifyTransferValidity(proofs);
        bytes16[] memory sealedKeys = new bytes16[](proofOupt.length);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(proofOupt[i].isValid, "Invalid transfer validity proof");
            require(
                proofOupt[i].newDataHash == $.tokens[tokenId].dataHashes[i],
                string(
                    abi.encodePacked(
                        "New data hash mismatch, hash in proof: ",
                        Strings.toHexString(uint256(proofOupt[i].newDataHash), 32),
                        ", but hash in token: ",
                        Strings.toHexString(uint256($.tokens[tokenId].dataHashes[i]), 32)
                    )
                )
            );
            require(
                proofOupt[i].receiver == to,
                string(
                    abi.encodePacked(
                        "Receiver mismatch, receiver in proof: ",
                        Strings.toHexString(uint256(uint160(proofOupt[i].receiver)), 20),
                        ", but transfer to: ",
                        Strings.toHexString(uint256(uint160(to)), 20)
                    )
                )
            );
            sealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        $.tokens[tokenId].owner = to;
        $.tokens[tokenId].dataHashes = newDataHashes;

        emit Transferred(tokenId, msg.sender, to);
        emit PublishedSealedKey(to, tokenId, sealedKeys);
    }

    function clone(address to, uint256 tokenId, bytes[] calldata proofs)
        public
        virtual
        override
        returns (uint256)
    {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == msg.sender, "Not owner");

        TransferValidityProofOutput[] memory proofOupt = $.verifier.verifyTransferValidity(proofs);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);
        bytes16[] memory sealedKeys = new bytes16[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid &&
                    proofOupt[i].oldDataHash == $.tokens[tokenId].dataHashes[i] &&
                    proofOupt[i].receiver == to,
                string(abi.encodePacked("Invalid transfer validity proof at index ", i))
            );
            sealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        uint256 newTokenId = $.nextTokenId++;
        $.tokens[newTokenId] = TokenData({
            owner: to,
            dataHashes: newDataHashes,
            dataDescriptions: $.tokens[tokenId].dataDescriptions,
            authorizedUsers: new address[](0),
            approvedUser: address(0)
        });

        emit Cloned(tokenId, newTokenId, msg.sender, to);
        emit PublishedSealedKey(to, newTokenId, sealedKeys);
        return newTokenId;
    }

    function cloneFrom(address from, address to, uint256 tokenId, bytes[] calldata proofs)
        public
        virtual
        returns (uint256)
    {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(to != address(0), "Zero address");
        require($.tokens[tokenId].owner == from, "Not owner");
        require(
            $.tokens[tokenId].approvedUser == msg.sender ||
                $.tokens[tokenId].owner == msg.sender ||
                $.operatorApprovals[from][msg.sender],
            "Not approved"
        );

        TransferValidityProofOutput[] memory proofOupt = $.verifier.verifyTransferValidity(proofs);
        bytes32[] memory newDataHashes = new bytes32[](proofOupt.length);
        bytes16[] memory sealedKeys = new bytes16[](proofOupt.length);

        for (uint i = 0; i < proofOupt.length; i++) {
            require(
                proofOupt[i].isValid &&
                    proofOupt[i].oldDataHash == $.tokens[tokenId].dataHashes[i] &&
                    proofOupt[i].receiver == to,
                string(abi.encodePacked("Invalid transfer validity proof at index ", i))
            );
            sealedKeys[i] = proofOupt[i].sealedKey;
            newDataHashes[i] = proofOupt[i].newDataHash;
        }

        uint256 newTokenId = $.nextTokenId++;
        $.tokens[newTokenId] = TokenData({
            owner: to,
            dataHashes: newDataHashes,
            dataDescriptions: $.tokens[tokenId].dataDescriptions,
            authorizedUsers: new address[](0),
            approvedUser: address(0)
        });

        emit Cloned(tokenId, newTokenId, msg.sender, to);
        emit PublishedSealedKey(to, newTokenId, sealedKeys);
        return newTokenId;
    }

    function authorizeUsage(uint256 tokenId, address to) public virtual override {
        AgentNFTStorage storage $ = _getAgentStorage();
        require($.tokens[tokenId].owner == msg.sender, "Not owner");
        $.tokens[tokenId].authorizedUsers.push(to);
        emit Authorization(msg.sender, to, tokenId);
    }

    function ownerOf(uint256 tokenId) public view virtual override(IERC7857) returns (address) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.owner;
    }

    function authorizedUsersOf(uint256 tokenId) public view virtual override returns (address[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.authorizedUsers;
    }

    function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        require(_exists(tokenId), "Token does not exist");
        return string(
            abi.encodePacked('{"chainURL":"', $.chainURL, '","indexerURL":"', $.indexerURL, '"}')
        );
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return _getAgentStorage().tokens[tokenId].owner != address(0);
    }

    function dataHashesOf(uint256 tokenId) public view virtual override returns (bytes32[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.dataHashes;
    }

    function dataDescriptionsOf(uint256 tokenId) public view virtual override returns (string[] memory) {
        AgentNFTStorage storage $ = _getAgentStorage();
        TokenData storage token = $.tokens[tokenId];
        require(token.owner != address(0), "Token not exist");
        return token.dataDescriptions;
    }

    function approve(address to, uint256 tokenId) public virtual {
        AgentNFTStorage storage $ = _getAgentStorage();
        require($.tokens[tokenId].owner == msg.sender, "Not owner");
        $.tokens[tokenId].approvedUser = to;
        emit Approval(msg.sender, to, tokenId);
    }

    function setApprovalForAll(address to, bool approved) public virtual {
        AgentNFTStorage storage $ = _getAgentStorage();
        $.operatorApprovals[msg.sender][to] = approved;
        emit ApprovalForAll(msg.sender, to, approved);
    }

    function getApproved(uint256 tokenId) public view virtual returns (address operator) {
        AgentNFTStorage storage $ = _getAgentStorage();
        return $.tokens[tokenId].approvedUser;
    }

    function isApprovedForAll(address owner, address operator) public view virtual returns (bool) {
        AgentNFTStorage storage $ = _getAgentStorage();
        return $.operatorApprovals[owner][operator];
    }

    string public constant VERSION = "1.0.0";
}
