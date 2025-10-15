/**
 * Uniswap V3 Pool Database Types and Conversion Logic
 *
 * These types and functions are used by the service layer for database operations.
 * Not shared with UI/frontend as they don't have direct database access.
 */

import type { UniswapV3PoolState } from '../../../shared/types/uniswapv3/index.js';

/**
 * Uniswap V3 Pool State - Database Representation
 *
 * Same structure as UniswapV3PoolState but with bigint values
 * serialized as strings for PostgreSQL JSON storage.
 * This is the interface used when reading from/writing to the database.
 */
export interface UniswapV3PoolStateDB {
  /**
   * Current sqrt(price) as a Q64.96 fixed-point value (as string)
   */
  sqrtPriceX96: string;

  /**
   * Current tick of the pool
   */
  currentTick: number;

  /**
   * Total liquidity currently in the pool (as string)
   */
  liquidity: string;

  /**
   * Accumulated fees per unit of liquidity for token0 (as string)
   */
  feeGrowthGlobal0: string;

  /**
   * Accumulated fees per unit of liquidity for token1 (as string)
   */
  feeGrowthGlobal1: string;
}

/**
 * Convert database representation to TypeScript application type
 * Parses string values to native bigint
 *
 * @param db - Database state with string values
 * @returns Application state with bigint values
 */
export function toPoolState(db: UniswapV3PoolStateDB): UniswapV3PoolState {
  return {
    sqrtPriceX96: BigInt(db.sqrtPriceX96),
    currentTick: db.currentTick,
    liquidity: BigInt(db.liquidity),
    feeGrowthGlobal0: BigInt(db.feeGrowthGlobal0),
    feeGrowthGlobal1: BigInt(db.feeGrowthGlobal1),
  };
}

/**
 * Convert TypeScript application type to database representation
 * Serializes bigint values to strings
 *
 * @param state - Application state with bigint values
 * @returns Database state with string values
 */
export function toPoolStateDB(state: UniswapV3PoolState): UniswapV3PoolStateDB {
  return {
    sqrtPriceX96: state.sqrtPriceX96.toString(),
    currentTick: state.currentTick,
    liquidity: state.liquidity.toString(),
    feeGrowthGlobal0: state.feeGrowthGlobal0.toString(),
    feeGrowthGlobal1: state.feeGrowthGlobal1.toString(),
  };
}
