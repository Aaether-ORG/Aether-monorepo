/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AGENT_NFT_ADDRESS?: string;
  readonly VITE_AETHER_VERIFIER_ADDRESS?: string;
  readonly VITE_BACKEND_URL?: string;
  readonly VITE_THORNBURY_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
