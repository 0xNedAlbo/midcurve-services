/**
 * APR Calculation Utilities
 *
 * Pure functions for calculating Annual Percentage Rate (APR) from fee collection data.
 * All functions are protocol-agnostic and work with any ledger event system.
 *
 * Design Principles:
 * - Pure functions with no state
 * - BigInt throughout (no precision loss)
 * - Smallest units (no decimal conversions)
 * - Type-safe with explicit inputs/outputs
 *
 * @module apr-calculations
 */

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Seconds per year (accounting for leap years)
 * 365.25 days × 24 hours × 60 minutes × 60 seconds = 31,557,600 seconds
 */
export const SECONDS_PER_YEAR = 31_557_600;

/**
 * Basis points multiplier
 * 1 bps = 0.01%, so 10000 bps = 100%
 */
export const BASIS_POINTS_MULTIPLIER = 10_000;

// ============================================================================
// APR CALCULATION
// ============================================================================

/**
 * Calculate APR in basis points from fee collection data
 *
 * Formula:
 * APR (bps) = (collectedFeeValue / costBasis) × (SECONDS_PER_YEAR / durationSeconds) × 10000
 *
 * This annualizes the return and expresses it in basis points.
 *
 * @param collectedFeeValue - Total fees collected during period (in smallest quote token units)
 * @param costBasis - Average cost basis during period (in smallest quote token units)
 * @param durationSeconds - Duration of the period in seconds
 * @returns APR in basis points (e.g., 2500 = 25%)
 * @throws Error if costBasis is zero or durationSeconds is non-positive
 *
 * @example
 * ```typescript
 * // 50 USDC fees on 10,000 USDC over 7 days
 * const apr = calculateAprBps(
 *   50_000000n,     // 50 USDC (6 decimals)
 *   10000_000000n,  // 10,000 USDC
 *   604_800         // 7 days in seconds
 * );
 * // Returns: 2609 (26.09%)
 * ```
 *
 * @example
 * ```typescript
 * // 100 USDC fees on 5,000 USDC over 30 days
 * const apr = calculateAprBps(
 *   100_000000n,    // 100 USDC
 *   5000_000000n,   // 5,000 USDC
 *   2_592_000       // 30 days in seconds
 * );
 * // Returns: 2433 (24.33%)
 * ```
 */
export function calculateAprBps(
  collectedFeeValue: bigint,
  costBasis: bigint,
  durationSeconds: number
): number {
  // Validate inputs
  if (costBasis === 0n) {
    throw new Error('Cost basis cannot be zero');
  }

  if (durationSeconds <= 0) {
    throw new Error('Duration must be positive');
  }

  if (collectedFeeValue < 0n) {
    throw new Error('Collected fee value cannot be negative');
  }

  // Special case: no fees collected
  if (collectedFeeValue === 0n) {
    return 0;
  }

  // Calculate APR in basis points
  // Formula: (fees / costBasis) × (SECONDS_PER_YEAR / durationSeconds) × BASIS_POINTS_MULTIPLIER
  // To avoid precision loss, we multiply numerators first, then divide by denominators
  const numerator = collectedFeeValue * BigInt(SECONDS_PER_YEAR) * BigInt(BASIS_POINTS_MULTIPLIER);
  const denominator = costBasis * BigInt(durationSeconds);

  const aprBps = Number(numerator / denominator);

  return aprBps;
}

// ============================================================================
// TIME CALCULATIONS
// ============================================================================

/**
 * Calculate duration in seconds between two timestamps
 *
 * @param startTimestamp - Start time
 * @param endTimestamp - End time
 * @returns Duration in seconds
 * @throws Error if endTimestamp is before startTimestamp
 *
 * @example
 * ```typescript
 * const start = new Date('2024-01-01T00:00:00Z');
 * const end = new Date('2024-01-08T00:00:00Z');
 * const duration = calculateDurationSeconds(start, end);
 * // Returns: 604800 (7 days)
 * ```
 */
export function calculateDurationSeconds(
  startTimestamp: Date,
  endTimestamp: Date
): number {
  const durationMs = endTimestamp.getTime() - startTimestamp.getTime();

  if (durationMs < 0) {
    throw new Error('End timestamp must be after start timestamp');
  }

  return Math.floor(durationMs / 1000);
}

/**
 * Convert duration in seconds to days (fractional)
 *
 * @param durationSeconds - Duration in seconds
 * @returns Duration in days (fractional)
 *
 * @example
 * ```typescript
 * const days = secondsToDays(604800); // 7 days
 * // Returns: 7
 * ```
 *
 * @example
 * ```typescript
 * const days = secondsToDays(691200); // 8 days
 * // Returns: 8
 * ```
 */
export function secondsToDays(durationSeconds: number): number {
  return durationSeconds / 86400; // 86400 seconds per day
}

// ============================================================================
// AVERAGE COST BASIS CALCULATION
// ============================================================================

/**
 * Calculate average cost basis from a list of cost basis values
 *
 * Simple arithmetic mean.
 *
 * @param costBasisValues - Array of cost basis values (in smallest quote token units)
 * @returns Average cost basis
 * @throws Error if array is empty
 *
 * @example
 * ```typescript
 * const average = calculateAverageCostBasis([
 *   10000_000000n,  // 10,000 USDC
 *   12000_000000n,  // 12,000 USDC
 *   11000_000000n,  // 11,000 USDC
 * ]);
 * // Returns: 11000_000000n (11,000 USDC)
 * ```
 */
export function calculateAverageCostBasis(costBasisValues: bigint[]): bigint {
  if (costBasisValues.length === 0) {
    throw new Error('Cannot calculate average of empty array');
  }

  const sum = costBasisValues.reduce((acc, val) => acc + val, 0n);
  return sum / BigInt(costBasisValues.length);
}

// ============================================================================
// APR TO PERCENTAGE CONVERSION
// ============================================================================

/**
 * Convert APR from basis points to percentage
 *
 * @param aprBps - APR in basis points
 * @returns APR as percentage (e.g., 25.00 for 25%)
 *
 * @example
 * ```typescript
 * const percent = aprBpsToPercent(2500);
 * // Returns: 25.00
 * ```
 */
export function aprBpsToPercent(aprBps: number): number {
  return aprBps / 100;
}

/**
 * Convert APR from percentage to basis points
 *
 * @param aprPercent - APR as percentage
 * @returns APR in basis points
 *
 * @example
 * ```typescript
 * const bps = aprPercentToBps(25.00);
 * // Returns: 2500
 * ```
 */
export function aprPercentToBps(aprPercent: number): number {
  return Math.round(aprPercent * 100);
}
