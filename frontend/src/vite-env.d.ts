/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENABLE_TEST_LOGIN?: string;
  readonly VITE_API_URL?: string;
  /** "true" → testnet (sandbox=true), "false" → mainnet (sandbox=false). */
  readonly VITE_PI_SANDBOX?: string;
}



