/**
 * Platform-specific pool configurations
 *
 * Pool config mapping pattern ensures type-safe protocol/config/state/token pairing.
 */

import type { Pool } from './pool.js';

/**
 * Uniswap V3 Pool Configuration (Immutable)
 *
 * Contains all immutable parameters that define a Uniswap V3 pool.
 * These values are set when the pool is created and never change.
 */
export interface UniswapV3PoolConfig {
  /**
   * Chain ID where the pool is deployed
   * Examples: 1 (Ethereum), 56 (BSC), 137 (Polygon), 42161 (Arbitrum)
   */
  chainId: number;

  /**
   * Pool contract address
   * Format: 0x... (42 characters, EIP-55 checksummed)
   */
  address: string;

  /**
   * Token0 ERC-20 contract address
   * By convention, token0 < token1 (lexicographic comparison)
   */
  token0: string;

  /**
   * Token1 ERC-20 contract address
   * By convention, token1 > token0 (lexicographic comparison)
   */
  token1: string;

  /**
   * Fee tier in basis points
   * Duplicated from base Pool.feeBps for convenience
   * - 100 = 0.01% (1 bps)
   * - 500 = 0.05% (5 bps)
   * - 3000 = 0.3% (30 bps)
   * - 10000 = 1% (100 bps)
   */
  feeBps: number;

  /**
   * Tick spacing for this fee tier
   * Determines the granularity of price ranges
   * - 1 for 0.01% fee tier
   * - 10 for 0.05% fee tier
   * - 60 for 0.3% fee tier
   * - 200 for 1% fee tier
   */
  tickSpacing: number;
}

/**
 * Uniswap V3 Pool State (Mutable)
 *
 * Contains the current state of a Uniswap V3 pool.
 * Uses native bigint for type safety and calculations.
 * This state changes with swaps and liquidity updates.
 */
export interface UniswapV3PoolState {
  /**
   * Current sqrt(price) as a Q64.96 fixed-point value
   * Range: uint160
   *
   * To calculate price:
   * price = (sqrtPriceX96 / 2^96)^2
   */
  sqrtPriceX96: bigint;

  /**
   * Current tick of the pool
   * Represents log base 1.0001 of the price
   * Range: int24 (-887272 to 887272)
   */
  currentTick: number;

  /**
   * Total liquidity currently in the pool
   * Range: uint128
   */
  liquidity: bigint;

  /**
   * Accumulated fees per unit of liquidity for token0
   * Range: uint256
   * Used to calculate fees owed to liquidity providers
   */
  feeGrowthGlobal0: bigint;

  /**
   * Accumulated fees per unit of liquidity for token1
   * Range: uint256
   * Used to calculate fees owed to liquidity providers
   */
  feeGrowthGlobal1: bigint;
}

/**
 * Pool Config/State/Token Mapping
 *
 * Maps protocol identifiers to their corresponding config types, state types,
 * and token types. Ensures type safety: Pool<'uniswapv3'> can only have
 * UniswapV3PoolConfig, UniswapV3PoolState, and Token<'erc20'> for both tokens.
 *
 * When adding a new protocol:
 * 1. Create the config interface (e.g., OrcaPoolConfig)
 * 2. Create the state interface (e.g., OrcaPoolState)
 * 3. Determine token types (e.g., 'solana-spl')
 * 4. Add entry to this mapping
 */
export interface PoolConfigMap {
  uniswapv3: {
    config: UniswapV3PoolConfig;
    state: UniswapV3PoolState;
    token0Type: 'erc20';
    token1Type: 'erc20';
  };
  // Future protocols:
  // orca: {
  //   config: OrcaPoolConfig;
  //   state: OrcaPoolState;
  //   token0Type: 'solana-spl';
  //   token1Type: 'solana-spl';
  // };
  // raydium: {
  //   config: RaydiumPoolConfig;
  //   state: RaydiumPoolState;
  //   token0Type: 'solana-spl';
  //   token1Type: 'solana-spl';
  // };
  // pancakeswapv3: {
  //   config: PancakeSwapV3PoolConfig;
  //   state: PancakeSwapV3PoolState;
  //   token0Type: 'erc20';
  //   token1Type: 'erc20';
  // };
}

/**
 * Type alias for Uniswap V3 pool
 */
export type UniswapV3Pool = Pool<'uniswapv3'>;

/**
 * Union type for any pool
 */
export type AnyPool = Pool<keyof PoolConfigMap>;
