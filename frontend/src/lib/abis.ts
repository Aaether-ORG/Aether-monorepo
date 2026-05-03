/** Minimal ABIs for the contracts we read/write from the UI. */

export const AGENT_NFT_ABI = [
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'payable',
    inputs: [
      { name: '_proofs', type: 'bytes[]' },
      { name: '_dataDescriptions', type: 'string[]' },
      { name: '_to', type: 'address' },
    ],
    outputs: [{ name: '', type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'authorizeUsage',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_tokenId', type: 'uint256' },
      { name: '_user', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'ownerOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address' }],
  },
  {
    type: 'function',
    name: 'dataHashesOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bytes32[]' }],
  },
  {
    type: 'function',
    name: 'dataDescriptionsOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'string[]' }],
  },
  {
    type: 'function',
    name: 'authorizedUsersOf',
    stateMutability: 'view',
    inputs: [{ name: 'tokenId', type: 'uint256' }],
    outputs: [{ name: '', type: 'address[]' }],
  },
  {
    type: 'event',
    name: 'Minted',
    inputs: [
      { name: '_tokenId', type: 'uint256', indexed: true },
      { name: '_creator', type: 'address', indexed: true },
      { name: '_owner', type: 'address', indexed: true },
      { name: '_dataHashes', type: 'bytes32[]' },
      { name: '_dataDescriptions', type: 'string[]' },
    ],
  },
  {
    type: 'event',
    name: 'Authorization',
    inputs: [
      { name: '_from', type: 'address', indexed: true },
      { name: '_to', type: 'address', indexed: true },
      { name: '_tokenId', type: 'uint256', indexed: true },
    ],
  },
] as const;

export const ERC8004_REPUTATION_ABI = [
  {
    type: 'function',
    name: 'getSummary',
    stateMutability: 'view',
    inputs: [
      { name: 'agentId', type: 'uint256' },
      { name: 'clientAddresses', type: 'address[]' },
      { name: 'tag1', type: 'string' },
      { name: 'tag2', type: 'string' },
    ],
    outputs: [
      { name: 'count', type: 'uint64' },
      { name: 'summaryValue', type: 'int128' },
      { name: 'summaryValueDecimals', type: 'uint8' },
    ],
  },
] as const;
