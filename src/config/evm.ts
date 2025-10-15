/**
 * EVM Chain Configuration
 *
 * Centralized configuration for all supported EVM chains.
 * Manages RPC endpoints, public clients, and chain metadata.
 *
 * Environment Variables (REQUIRED):
 * - RPC_URL_ETHEREUM    - Ethereum mainnet RPC
 * - RPC_URL_ARBITRUM    - Arbitrum One RPC
 * - RPC_URL_BASE        - Base RPC
 * - RPC_URL_BSC         - BNB Smart Chain RPC
 * - RPC_URL_POLYGON     - Polygon RPC
 * - RPC_URL_OPTIMISM    - Optimism RPC
 *
 * Note: getChainConfig() and getPublicClient() will throw an error if the
 * required RPC URL environment variable is not set for the requested chain.
 */

import { createPublicClient, http, type PublicClient } from 'viem';
import {
  mainnet,
  arbitrum,
  base,
  bsc,
  polygon,
  optimism,
  type Chain,
} from 'viem/chains';

/**
 * Configuration for a single EVM chain
 */
export interface ChainConfig {
  /** Chain ID (e.g., 1 for Ethereum) */
  chainId: number;
  /** Human-readable chain name */
  name: string;
  /** RPC URL for this chain */
  rpcUrl: string;
  /** Block explorer URL (optional) */
  blockExplorer?: string;
  /** Viem chain definition */
  viemChain: Chain;
}

/**
 * Supported chain identifiers
 */
export enum SupportedChainId {
  ETHEREUM = 1,
  ARBITRUM = 42161,
  BASE = 8453,
  BSC = 56,
  POLYGON = 137,
  OPTIMISM = 10,
}

/**
 * Sentinel value used to mark missing RPC URLs
 * getChainConfig() will validate and throw comprehensive error when encountered
 */
const INVALID_RPC_SENTINEL = '-INVALID-';

/**
 * EVM Configuration Manager
 *
 * Manages chain configurations, RPC endpoints, and viem public clients.
 * Uses singleton pattern for convenient default access.
 */
export class EvmConfig {
  private static instance: EvmConfig | null = null;
  private readonly chains: Map<number, ChainConfig>;
  private readonly clients: Map<number, PublicClient>;

  /**
   * Creates a new EvmConfig instance
   *
   * Loads RPC URLs from environment variables. Missing RPC URLs are marked
   * with a sentinel value and will cause getChainConfig() to throw an error.
   * Environment variable format: RPC_URL_<CHAIN_NAME>
   */
  constructor() {
    this.chains = new Map();
    this.clients = new Map();
    this.initializeChains();
  }

  /**
   * Get singleton instance of EvmConfig
   * Lazily creates instance on first access
   */
  static getInstance(): EvmConfig {
    if (!EvmConfig.instance) {
      EvmConfig.instance = new EvmConfig();
    }
    return EvmConfig.instance;
  }

  /**
   * Reset singleton instance (useful for testing)
   */
  static resetInstance(): void {
    EvmConfig.instance = null;
  }

  /**
   * Initialize chain configurations from environment variables
   * Missing RPC URLs are marked with sentinel value for validation in getChainConfig()
   */
  private initializeChains(): void {
    const env = process.env;

    // Ethereum
    this.chains.set(SupportedChainId.ETHEREUM, {
      chainId: SupportedChainId.ETHEREUM,
      name: 'Ethereum',
      rpcUrl: env['RPC_URL_ETHEREUM'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://etherscan.io',
      viemChain: mainnet,
    });

    // Arbitrum
    this.chains.set(SupportedChainId.ARBITRUM, {
      chainId: SupportedChainId.ARBITRUM,
      name: 'Arbitrum One',
      rpcUrl: env['RPC_URL_ARBITRUM'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://arbiscan.io',
      viemChain: arbitrum,
    });

    // Base
    this.chains.set(SupportedChainId.BASE, {
      chainId: SupportedChainId.BASE,
      name: 'Base',
      rpcUrl: env['RPC_URL_BASE'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://basescan.org',
      viemChain: base,
    });

    // BNB Smart Chain
    this.chains.set(SupportedChainId.BSC, {
      chainId: SupportedChainId.BSC,
      name: 'BNB Smart Chain',
      rpcUrl: env['RPC_URL_BSC'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://bscscan.com',
      viemChain: bsc,
    });

    // Polygon
    this.chains.set(SupportedChainId.POLYGON, {
      chainId: SupportedChainId.POLYGON,
      name: 'Polygon',
      rpcUrl: env['RPC_URL_POLYGON'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://polygonscan.com',
      viemChain: polygon,
    });

    // Optimism
    this.chains.set(SupportedChainId.OPTIMISM, {
      chainId: SupportedChainId.OPTIMISM,
      name: 'Optimism',
      rpcUrl: env['RPC_URL_OPTIMISM'] ?? INVALID_RPC_SENTINEL,
      blockExplorer: 'https://optimistic.etherscan.io',
      viemChain: optimism,
    });
  }

  /**
   * Get the environment variable name for a chain ID
   *
   * @param chainId - Chain ID
   * @returns Environment variable name (e.g., 'RPC_URL_ETHEREUM')
   */
  private getEnvVarNameForChain(chainId: number): string {
    const envVarMap: Record<number, string> = {
      [SupportedChainId.ETHEREUM]: 'RPC_URL_ETHEREUM',
      [SupportedChainId.ARBITRUM]: 'RPC_URL_ARBITRUM',
      [SupportedChainId.BASE]: 'RPC_URL_BASE',
      [SupportedChainId.BSC]: 'RPC_URL_BSC',
      [SupportedChainId.POLYGON]: 'RPC_URL_POLYGON',
      [SupportedChainId.OPTIMISM]: 'RPC_URL_OPTIMISM',
    };

    return envVarMap[chainId] ?? `RPC_URL_UNKNOWN_${chainId}`;
  }

  /**
   * Get chain configuration by chain ID
   *
   * @param chainId - Chain ID to look up
   * @returns Chain configuration
   * @throws Error if chain ID is not supported
   * @throws Error if RPC URL is not configured (environment variable not set)
   */
  getChainConfig(chainId: number): ChainConfig {
    const config = this.chains.get(chainId);
    if (!config) {
      throw new Error(
        `Chain ${chainId} is not configured. Supported chains: ${Array.from(
          this.chains.keys()
        ).join(', ')}`
      );
    }

    // Check if RPC URL is missing (marked as invalid)
    if (config.rpcUrl === INVALID_RPC_SENTINEL) {
      const envVarName = this.getEnvVarNameForChain(chainId);
      throw new Error(
        `RPC URL not configured for ${config.name} (Chain ID: ${chainId}).\n\n` +
          `The environment variable '${envVarName}' is not set.\n\n` +
          `To fix this:\n` +
          `1. Copy .env.example to .env in your project root\n` +
          `2. Set ${envVarName} to your RPC endpoint:\n` +
          `   ${envVarName}=https://your-rpc-provider.com/v2/YOUR_API_KEY\n\n` +
          `Example providers: Alchemy, Infura, QuickNode, or run your own node.\n\n` +
          `Note: Environment variables must be set before starting the application.`
      );
    }

    return config;
  }

  /**
   * Get viem PublicClient for a specific chain
   *
   * Creates and caches client instances for efficiency.
   * Clients are reused across multiple calls.
   *
   * @param chainId - Chain ID to get client for
   * @returns Viem PublicClient instance
   * @throws Error if chain ID is not supported
   */
  getPublicClient(chainId: number): PublicClient {
    // Return cached client if available
    const cached = this.clients.get(chainId);
    if (cached) {
      return cached;
    }

    // Get chain configuration
    const config = this.getChainConfig(chainId);

    // Create new public client
    const client = createPublicClient({
      chain: config.viemChain,
      transport: http(config.rpcUrl),
    });

    // Cache for future use
    this.clients.set(chainId, client);

    return client;
  }

  /**
   * Get all supported chain IDs
   *
   * @returns Array of supported chain IDs
   */
  getSupportedChainIds(): number[] {
    return Array.from(this.chains.keys());
  }

  /**
   * Check if a chain ID is supported
   *
   * @param chainId - Chain ID to check
   * @returns true if chain is supported
   */
  isChainSupported(chainId: number): boolean {
    return this.chains.has(chainId);
  }
}

/**
 * Get the default EvmConfig singleton instance
 */
export function getEvmConfig(): EvmConfig {
  return EvmConfig.getInstance();
}
