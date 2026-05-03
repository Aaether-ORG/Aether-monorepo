import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import * as dotenv from 'dotenv';

// Load env from repo root
dotenv.config({ path: '../.env' });

const ZG_RPC = process.env.ZG_RPC_URL ?? 'https://evmrpc-testnet.0g.ai';
const ZG_PK = process.env.ZG_TESTNET_PRIVATE_KEY;
const SEPOLIA_RPC = process.env.SEPOLIA_RPC_URL ?? 'https://ethereum-sepolia.publicnode.com';
const SEPOLIA_PK = process.env.SEPOLIA_PRIVATE_KEY;

const accounts = (pk?: string) => (pk ? [pk] : []);

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.24',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      evmVersion: 'cancun',
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    zgTestnet: {
      url: ZG_RPC,
      chainId: 16602,
      accounts: accounts(ZG_PK),
    },
    sepolia: {
      url: SEPOLIA_RPC,
      chainId: 11155111,
      accounts: accounts(SEPOLIA_PK),
    },
    baseSepolia: {
      url: process.env.BASE_SEPOLIA_RPC ?? 'https://sepolia.base.org',
      chainId: 84532,
      accounts: accounts(SEPOLIA_PK),
    },
  },
  paths: {
    sources: './src',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
};

export default config;
