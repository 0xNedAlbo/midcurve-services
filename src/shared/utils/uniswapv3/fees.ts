/**
 * Uniswap V3 Fee Calculation Utilities
 *
 * Implements the fee growth calculation logic from the Uniswap V3 whitepaper
 * for computing unclaimed fees in positions.
 */

import { Q128 } from './constants.js';

/**
 * Safe difference calculation for uint256-like BigInt values.
 * Handles potential overflow by returning 0 when b > a.
 * This is crucial for fee growth calculations which can overflow uint256.
 */
export function safeDiff(a: bigint, b: bigint): bigint {
  return a >= b ? a - b : 0n;
}

/**
 * Fee growth inside data structure
 */
export interface FeeGrowthInside {
  inside0: bigint;
  inside1: bigint;
}

/**
 * Unclaimed fees breakdown for a position
 */
export interface UnclaimedFees {
  /** Incremental fees earned since last checkpoint (token0) */
  incremental0: bigint;
  /** Incremental fees earned since last checkpoint (token1) */
  incremental1: bigint;
  /** Fees already checkpointed in NFPM (token0) */
  checkpointed0: bigint;
  /** Fees already checkpointed in NFPM (token1) */
  checkpointed1: bigint;
  /** Total claimable fees right now (token0) */
  totalClaimable0: bigint;
  /** Total claimable fees right now (token1) */
  totalClaimable1: bigint;
}

/**
 * Unclaimed fees with additional metadata for service layer
 */
export interface UnclaimedFeesWithMetadata {
  /** Core fee data */
  fees: UnclaimedFees;
  /** Base token amount (determined by token0IsQuote flag) */
  baseTokenAmount: bigint;
  /** Quote token amount (determined by token0IsQuote flag) */
  quoteTokenAmount: bigint;
  /** Value in quote token units (baseTokenAmount * current pool price) */
  valueInQuoteToken: string; // BigInt as string following our storage pattern
}

/**
 * Computes feeGrowthInside for both tokens according to Uniswap V3 whitepaper logic.
 *
 * The fee growth inside a tick range is calculated as:
 * feeGrowthInside = feeGrowthGlobal - feeGrowthBelow - feeGrowthAbove
 *
 * Where:
 * - feeGrowthBelow: Fee growth accumulated below the lower tick
 * - feeGrowthAbove: Fee growth accumulated above the upper tick
 *
 * The logic handles the case where the current tick is above, below, or within
 * the position's tick range by using the feeGrowthOutside values appropriately.
 *
 * @param tickCurrent - Current pool tick
 * @param tickLower - Position's lower tick bound
 * @param tickUpper - Position's upper tick bound
 * @param feeGrowthGlobal0 - Global fee growth for token0
 * @param feeGrowthGlobal1 - Global fee growth for token1
 * @param feeGrowthOutsideLower0 - Fee growth outside lower tick for token0
 * @param feeGrowthOutsideLower1 - Fee growth outside lower tick for token1
 * @param feeGrowthOutsideUpper0 - Fee growth outside upper tick for token0
 * @param feeGrowthOutsideUpper1 - Fee growth outside upper tick for token1
 * @returns Object containing inside fee growth for both tokens
 */
export function computeFeeGrowthInside(
  tickCurrent: number,
  tickLower: number,
  tickUpper: number,
  feeGrowthGlobal0: bigint,
  feeGrowthGlobal1: bigint,
  feeGrowthOutsideLower0: bigint,
  feeGrowthOutsideLower1: bigint,
  feeGrowthOutsideUpper0: bigint,
  feeGrowthOutsideUpper1: bigint
): FeeGrowthInside {
  // Calculate below-range component
  // If current tick >= lower tick, fees below are already accounted in feeGrowthOutsideLower
  // Otherwise, fees below = feeGrowthGlobal - feeGrowthOutsideLower
  const below0 =
    tickCurrent >= tickLower
      ? feeGrowthOutsideLower0
      : safeDiff(feeGrowthGlobal0, feeGrowthOutsideLower0);

  const below1 =
    tickCurrent >= tickLower
      ? feeGrowthOutsideLower1
      : safeDiff(feeGrowthGlobal1, feeGrowthOutsideLower1);

  // Calculate above-range component
  // If current tick < upper tick, fees above are already accounted in feeGrowthOutsideUpper
  // Otherwise, fees above = feeGrowthGlobal - feeGrowthOutsideUpper
  const above0 =
    tickCurrent < tickUpper
      ? feeGrowthOutsideUpper0
      : safeDiff(feeGrowthGlobal0, feeGrowthOutsideUpper0);

  const above1 =
    tickCurrent < tickUpper
      ? feeGrowthOutsideUpper1
      : safeDiff(feeGrowthGlobal1, feeGrowthOutsideUpper1);

  // Fee growth inside = global fee growth - fees below range - fees above range
  const inside0 = safeDiff(safeDiff(feeGrowthGlobal0, below0), above0);
  const inside1 = safeDiff(safeDiff(feeGrowthGlobal1, below1), above1);

  return { inside0, inside1 };
}

/**
 * Calculates the incremental fees owed since the last checkpoint.
 *
 * @param feeGrowthInsideCurrent - Current fee growth inside the position range
 * @param feeGrowthInsideLast - Fee growth inside at last checkpoint (from NFPM)
 * @param liquidity - Position liquidity amount
 * @returns Incremental fees owed in token native units
 */
export function calculateIncrementalFees(
  feeGrowthInsideCurrent: bigint,
  feeGrowthInsideLast: bigint,
  liquidity: bigint
): bigint {
  // Calculate the delta in fee growth since last checkpoint
  const feeGrowthDelta = safeDiff(feeGrowthInsideCurrent, feeGrowthInsideLast);

  // Convert Q128.128 fee growth to actual token amount
  // fees = (feeGrowthDelta * liquidity) / Q128
  return (feeGrowthDelta * liquidity) / Q128;
}
