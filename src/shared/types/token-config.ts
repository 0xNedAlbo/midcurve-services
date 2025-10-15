/**
 * Platform-specific token configurations
 *
 * These configs contain platform-specific fields that are stored
 * in the `config` JSON field of the Token interface.
 */

import type { Token } from './token.js';

/**
 * ERC-20 token configuration (EVM-compatible chains)
 * Used for: Uniswap V3 (Ethereum), PancakeSwap (BSC), and other EVM chains
 */
export interface Erc20TokenConfig {
  /**
   * Token contract address (ERC-20)
   * Format: 0x... (42 characters)
   */
  address: string;

  /**
   * Chain ID (identifies the specific EVM chain)
   * - Ethereum mainnet: 1
   * - BSC mainnet: 56
   * - Polygon: 137
   * - Arbitrum: 42161
   */
  chainId: number;
}

/**
 * Solana token configuration
 * Used for: Orca, Raydium
 */
export interface SolanaTokenConfig {
  /**
   * Token mint address (SPL token)
   * Format: Base58 encoded public key (32-44 characters)
   */
  mint: string;

  /**
   * Token program ID (usually SPL Token Program)
   * Default: TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA
   */
  programId?: string;
}

/**
 * Union type of all supported platform configs
 */
export type TokenConfig = Erc20TokenConfig | SolanaTokenConfig;

/**
 * Type aliases for platform-specific tokens
 * These provide better type safety when working with specific platforms
 */
export type Erc20Token = Token<Erc20TokenConfig>;
export type SolanaToken = Token<SolanaTokenConfig>;

/**
 * Generic token that can be any platform
 */
export type AnyToken = Token<TokenConfig>;
