/**
 * Position Configuration Types
 *
 * Protocol-specific configuration types for Position.config field.
 * These are stored as JSON in the database.
 *
 * This file uses a mapped types pattern to enforce correct config/state pairing.
 * Each protocol is mapped to its specific config and state types.
 */

import type { UniswapV3PositionState } from './uniswapv3/position-state.js';

/**
 * Uniswap V3 Position Configuration
 *
 * Immutable configuration for Uniswap V3 positions.
 */
export interface UniswapV3PositionConfig {
  /**
   * Chain ID where the position exists
   * @example 1 (Ethereum), 42161 (Arbitrum), 8453 (Base)
   */
  chainId: number;

  /**
   * NFT token ID
   * Unique identifier for the Uniswap V3 position NFT
   */
  nftId: number;

  /**
   * Pool address on the blockchain
   * EIP-55 checksummed address
   */
  poolAddress: string;

  /**
   * Whether token0 is the quote token
   * true: token0 is quote, token1 is base
   * false: token1 is quote, token0 is base
   */
  token0IsQuote: boolean;

  /**
   * Upper tick bound
   * The upper tick of the position's price range
   */
  tickUpper: number;

  /**
   * Lower tick bound
   * The lower tick of the position's price range
   */
  tickLower: number;
}

/**
 * Position Config/State Mapping
 *
 * Maps protocol identifiers to their corresponding config and state types.
 * This ensures type safety: Position<'uniswapv3'> can only have
 * UniswapV3PositionConfig and UniswapV3PositionState.
 *
 * When adding a new protocol:
 * 1. Create the config interface (e.g., OrcaPositionConfig)
 * 2. Create the state interface (e.g., OrcaPositionState)
 * 3. Add entry to this mapping: orca: { config: OrcaPositionConfig; state: OrcaPositionState }
 */
export interface PositionConfigMap {
  uniswapv3: {
    config: UniswapV3PositionConfig;
    state: UniswapV3PositionState;
  };
  // Future protocols:
  // orca: { config: OrcaPositionConfig; state: OrcaPositionState };
  // raydium: { config: RaydiumPositionConfig; state: RaydiumPositionState };
  // pancakeswapv3: { config: PancakeSwapV3PositionConfig; state: PancakeSwapV3PositionState };
}

/**
 * Type alias for Uniswap V3 position
 * Re-exported from position.ts for convenience
 */
export type { UniswapV3Position, AnyPosition } from './position.js';
