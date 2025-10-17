/**
 * Position Type Definitions
 *
 * Generic position interface for concentrated liquidity positions.
 * Supports multiple protocols: Uniswap V3, Orca, Raydium, PancakeSwap V3.
 *
 * Design:
 * - Common fields: Shared across all protocols
 * - config: Protocol-specific configuration (JSON)
 *
 * @see position-config.ts for protocol-specific config types
 */

import type { PositionConfigMap } from './position-config.js';

// Re-export PositionConfigMap for use in service layer
export type { PositionConfigMap } from './position-config.js';

/**
 * Position interface
 *
 * Represents a concentrated liquidity position across any supported protocol.
 * Uses mapped types to enforce correct config/state pairing per protocol.
 *
 * Type safety: Position<'uniswapv3'> can only have UniswapV3PositionConfig
 * and UniswapV3PositionState. Invalid combinations (e.g., Uniswap config with
 * Orca state) are prevented at compile time.
 *
 * @template P - Protocol key from PositionConfigMap ('uniswapv3', etc.)
 */
export interface Position<P extends keyof PositionConfigMap> {
  /**
   * Unique identifier (database-generated)
   */
  id: string;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last update timestamp
   */
  updatedAt: Date;

  // ============================================================================
  // PROTOCOL IDENTIFICATION
  // ============================================================================

  /**
   * Protocol identifier
   * Specifies which DEX protocol this position belongs to
   *
   * @example 'uniswapv3'
   */
  protocol: P;

  /**
   * Position type
   * Specifies the liquidity model used by the position
   *
   * Currently only 'CL_TICKS' (concentrated liquidity with tick-based ranges)
   * is supported. Other types may be added in the future.
   *
   * @example 'CL_TICKS'
   */
  positionType: PositionType;

  // ============================================================================
  // DATA OWNERSHIP
  // ============================================================================

  /**
   * User who owns this position
   * Foreign key reference to User.id
   */
  userId: string;

  // ============================================================================
  // PNL RELATED FIELDS
  // ============================================================================

  /**
   * Current position value in quote token units (smallest denomination)
   *
   * This represents the current market value of the position if it were
   * closed at the current pool price.
   *
   * @example
   * // Position worth 1500 USDC (6 decimals)
   * currentValue = 1500_000000n
   */
  currentValue: bigint;

  /**
   * Current cost basis in quote token units (smallest denomination)
   *
   * This represents the total capital invested in the position.
   * Updated when liquidity is added or removed.
   *
   * @example
   * // Invested 1000 USDC (6 decimals)
   * currentCostBasis = 1000_000000n
   */
  currentCostBasis: bigint;

  /**
   * Realized PnL in quote token units (smallest denomination)
   *
   * Profit or loss that has been "locked in" through position changes
   * (partial closes, liquidity reductions).
   *
   * @example
   * // Realized 50 USDC profit (6 decimals)
   * realizedPnl = 50_000000n
   */
  realizedPnl: bigint;

  /**
   * Unrealized PnL in quote token units (smallest denomination)
   *
   * Current profit or loss based on current market price.
   * Formula: currentValue - currentCostBasis
   *
   * @example
   * // Current unrealized profit of 500 USDC (6 decimals)
   * unrealizedPnl = 500_000000n
   */
  unrealizedPnl: bigint;

  // ============================================================================
  // CASH FLOW RELATED FIELDS
  // ============================================================================

  /**
   * Total fees collected (claimed) in quote token units (smallest denomination)
   *
   * Historical sum of all fees that have been collected from the pool.
   *
   * @example
   * // Collected 25 USDC in fees (6 decimals)
   * collectedFees = 25_000000n
   */
  collectedFees: bigint;

  /**
   * Unclaimed fees in quote token units (smallest denomination)
   *
   * Fees that have accrued but haven't been collected yet.
   *
   * @example
   * // 5 USDC in unclaimed fees (6 decimals)
   * unClaimedFees = 5_000000n
   */
  unClaimedFees: bigint;

  /**
   * Timestamp of last fee collection
   *
   * Used for APR calculations. Defaults to positionOpenedAt if fees have
   * never been collected.
   */
  lastFeesCollectedAt: Date;

  // ============================================================================
  // PRICE RANGE
  // ============================================================================

  /**
   * Lower bound of price range in quote token units per 1 base token
   *
   * The minimum price at which the position provides liquidity.
   * Price is expressed as: quote tokens per 1 base token (in smallest units).
   *
   * @example
   * // Lower price: 1500 USDC per 1 ETH (USDC has 6 decimals, ETH has 18)
   * // Formula: 1500 * 10^6 / 10^18 = 1500 * 10^6
   * priceRangeLower = 1500_000000n
   */
  priceRangeLower: bigint;

  /**
   * Upper bound of price range in quote token units per 1 base token
   *
   * The maximum price at which the position provides liquidity.
   * Price is expressed as: quote tokens per 1 base token (in smallest units).
   *
   * @example
   * // Upper price: 2000 USDC per 1 ETH (USDC has 6 decimals, ETH has 18)
   * priceRangeUpper = 2000_000000n
   */
  priceRangeUpper: bigint;

  // ============================================================================
  // POOL AND TOKEN ROLES
  // ============================================================================

  /**
   * Pool this position belongs to
   * Full Pool object with embedded Token objects (token0, token1)
   *
   * Type is determined by the protocol parameter P via PositionConfigMap.
   * For Position<'uniswapv3'>, this will be UniswapV3Pool.
   *
   * The pool includes:
   * - pool.token0: Full token object (including id, symbol, decimals, config, etc.)
   * - pool.token1: Full token object
   * - pool.config: Pool configuration (address, chainId, tickSpacing, etc.)
   * - pool.state: Pool state (sqrtPriceX96, liquidity, currentTick, etc.)
   */
  pool: PositionConfigMap[P]['pool'];

  /**
   * Token role indicator
   *
   * Determines which token in the pool is the quote token (unit of account):
   * - true: token0 is quote, token1 is base
   * - false: token0 is base, token1 is quote
   *
   * Use this to derive token roles:
   * ```typescript
   * const baseToken = position.isToken0Quote ? position.pool.token1 : position.pool.token0;
   * const quoteToken = position.isToken0Quote ? position.pool.token0 : position.pool.token1;
   * ```
   *
   * @example
   * // ETH/USDC pool where USDC is quote
   * // pool.token0 = USDC (0xA0b8...), pool.token1 = WETH (0xC02a...)
   * // isToken0Quote = true
   * // Therefore: baseToken = WETH, quoteToken = USDC
   */
  isToken0Quote: boolean;

  // ============================================================================
  // POSITION STATE
  // ============================================================================

  /**
   * Timestamp when position was opened
   */
  positionOpenedAt: Date;

  /**
   * Timestamp when position was closed
   * Null if position is still active
   */
  positionClosedAt: Date | null;

  /**
   * Whether the position is currently active
   *
   * true: Position is open and providing liquidity
   * false: Position has been closed
   */
  isActive: boolean;

  // ============================================================================
  // PROTOCOL-SPECIFIC DATA
  // ============================================================================

  /**
   * Protocol-specific configuration (JSON) - IMMUTABLE
   *
   * Contains immutable position parameters specific to the protocol:
   * - Uniswap V3: chainId, nftId, poolAddress, token0IsQuote, tickUpper, tickLower
   *
   * Type is determined by the protocol parameter P.
   * For Position<'uniswapv3'>, this will be UniswapV3PositionConfig.
   *
   * @see position-config.ts for specific config types
   */
  config: PositionConfigMap[P]['config'];

  /**
   * Protocol-specific state (JSON) - MUTABLE
   *
   * Contains mutable position state that changes over time:
   * - Uniswap V3: ownerAddress, liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, tokensOwed0, tokensOwed1
   *
   * Type is determined by the protocol parameter P.
   * For Position<'uniswapv3'>, this will be UniswapV3PositionState.
   *
   * Note: For TypeScript, state uses bigint. In database, bigint values are stored as strings.
   *
   * @see uniswapv3/position-state.ts for specific state types
   */
  state: PositionConfigMap[P]['state'];
}

/**
 * Protocol identifiers for positions
 *
 * Derived from PositionConfigMap keys for type safety.
 */
export type PositionProtocol = keyof PositionConfigMap;

/**
 * Position type identifiers
 *
 * Specifies the liquidity model used by the position.
 */
export type PositionType = 'CL_TICKS';

// ============================================================================
// TYPE ALIASES FOR SPECIFIC PROTOCOLS
// ============================================================================

/**
 * Uniswap V3 Position
 *
 * Type-safe position with Uniswap V3 configuration and state.
 * Equivalent to Position<'uniswapv3'>.
 */
export type UniswapV3Position = Position<'uniswapv3'>;

/**
 * Union type for any position
 *
 * Can be a position from any supported protocol.
 */
export type AnyPosition = Position<keyof PositionConfigMap>;

// ============================================================================
// HELPER FUNCTIONS FOR TOKEN ROLE DERIVATION
// ============================================================================

/**
 * Get the base token from a position
 *
 * The base token is the asset being priced (e.g., ETH in ETH/USDC).
 *
 * @param position - The position to get the base token from
 * @returns The base token object
 *
 * @example
 * ```typescript
 * const position: UniswapV3Position = ...;
 * const baseToken = getBaseToken(position);
 * console.log(`Base: ${baseToken.symbol}`); // "WETH"
 * ```
 */
export function getBaseToken<P extends keyof PositionConfigMap>(
  position: Position<P>
): Position<P>['pool']['token0'] {
  return position.isToken0Quote ? position.pool.token1 : position.pool.token0;
}

/**
 * Get the quote token from a position
 *
 * The quote token is the unit of account (e.g., USDC in ETH/USDC).
 *
 * @param position - The position to get the quote token from
 * @returns The quote token object
 *
 * @example
 * ```typescript
 * const position: UniswapV3Position = ...;
 * const quoteToken = getQuoteToken(position);
 * console.log(`Quote: ${quoteToken.symbol}`); // "USDC"
 * ```
 */
export function getQuoteToken<P extends keyof PositionConfigMap>(
  position: Position<P>
): Position<P>['pool']['token0'] {
  return position.isToken0Quote ? position.pool.token0 : position.pool.token1;
}
