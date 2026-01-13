/**
 * Configuration for a single RPC endpoint
 */
export interface RpcEndpointSettings {
  /** HTTP RPC URL */
  rpcUrl: string;
  /** WebSocket URL (optional) */
  wsUrl?: string;
  /** Optional API key for authenticated endpoints */
  apiKey?: string;
}

/**
 * Generic blockchain network settings.
 * Supports multiple named endpoints per network for redundancy/load balancing.
 */
export interface NetworkSettings {
  /** Primary RPC endpoint */
  primary: RpcEndpointSettings;
  /** Optional secondary/fallback endpoints */
  secondary?: RpcEndpointSettings[];
}

/**
 * Blockchain settings supporting multiple networks.
 *
 * @example
 * ```typescript
 * const settings: BlockchainSettings = {
 *   networks: {
 *     solana: {
 *       primary: { rpcUrl: "https://api.mainnet-beta.solana.com" },
 *       secondary: [{ rpcUrl: "https://solana-api.projectserum.com" }]
 *     },
 *     ethereum: {
 *       primary: { rpcUrl: "https://mainnet.infura.io/v3/YOUR_KEY" }
 *     }
 *   }
 * }
 * ```
 */
export interface BlockchainSettings {
  networks: Record<string, NetworkSettings>;
}

/**
 * @deprecated Use BlockchainSettings with networks map instead.
 * Kept for backward compatibility.
 */
export interface SolanaSettings {
  /** @deprecated Use networks.solana.primary.rpcUrl */
  sparkRpcUrl: string;
  /** @deprecated Use networks.solana.primary.wsUrl */
  sparkWsUrl: string;
  /** @deprecated Use networks.solana.secondary[0].rpcUrl */
  heliusRpcUrl: string;
  /** @deprecated Use networks.solana.secondary[0].wsUrl */
  heliusWsUrl: string;
}

/**
 * @deprecated Use BlockchainSettings instead
 */
export interface LegacyBlockchainSettings {
  solana: SolanaSettings;
}
