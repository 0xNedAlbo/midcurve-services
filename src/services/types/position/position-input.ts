/**
 * Position Input Types
 *
 * Input types for Position CRUD operations.
 * These types are NOT shared with UI/API - they're specific to the service layer.
 *
 * Uses mapped types to ensure type-safe protocol-specific operations.
 */

import type {
  Position,
  PositionConfigMap,
} from '../../../shared/types/position.js';

/**
 * Uniswap V3 Position Discovery Input
 *
 * Parameters needed to discover a Uniswap V3 position from on-chain data.
 */
export interface UniswapV3PositionDiscoverInput {
  /**
   * Chain ID where the position is deployed
   * Examples: 1 (Ethereum), 42161 (Arbitrum), 8453 (Base)
   */
  chainId: number;

  /**
   * NFT token ID representing the position
   * Each Uniswap V3 position is represented by an NFT in the NonfungiblePositionManager contract
   */
  nftId: number;

  /**
   * Address of the quote token (the token used as unit of account)
   * Will be validated and normalized to EIP-55 checksum format
   *
   * The service will discover the pool and determine which token is token0/token1,
   * then set token0IsQuote in config based on comparison with this address.
   *
   * @example
   * // For ETH/USDC position with USDC as quote
   * quoteTokenAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
   */
  quoteTokenAddress: string;
}

/**
 * Position Discovery Input Map
 *
 * Maps protocol identifiers to their corresponding discovery input types.
 * Ensures type safety: discover() for protocol 'uniswapv3' requires UniswapV3PositionDiscoverInput.
 *
 * When adding a new protocol:
 * 1. Create the discovery input interface (e.g., OrcaPositionDiscoverInput)
 * 2. Add entry to this mapping
 */
export interface PositionDiscoverInputMap {
  uniswapv3: UniswapV3PositionDiscoverInput;
  // Future protocols:
  // orca: OrcaPositionDiscoverInput;
  // raydium: RaydiumPositionDiscoverInput;
  // pancakeswapv3: PancakeSwapV3PositionDiscoverInput;
}

/**
 * Generic position discovery input type
 * Type-safe based on protocol parameter
 */
export type PositionDiscoverInput<P extends keyof PositionDiscoverInputMap> =
  PositionDiscoverInputMap[P];

/**
 * Union type for any position discovery input
 */
export type AnyPositionDiscoverInput =
  PositionDiscoverInput<keyof PositionDiscoverInputMap>;

/**
 * Input type for creating a new position
 *
 * Omits all calculated fields (which are computed by the service):
 * - currentValue, currentCostBasis, realizedPnl, unrealizedPnl
 * - collectedFees, unClaimedFees, lastFeesCollectedAt
 * - priceRangeLower, priceRangeUpper
 * - positionOpenedAt, positionClosedAt, isActive
 * - state (computed from on-chain data)
 *
 * Also omits database-generated fields: id, createdAt, updatedAt
 *
 * Note: This is a manual creation helper. For creating positions from on-chain data,
 * use discover() which handles pool discovery, token role determination, and state fetching.
 *
 * @template P - Protocol key from PositionConfigMap ('uniswapv3', etc.)
 */
export type CreatePositionInput<P extends keyof PositionConfigMap> = Pick<
  Position<P>,
  | 'protocol'
  | 'positionType'
  | 'userId'
  | 'baseTokenId'
  | 'quoteTokenId'
  | 'poolId'
  | 'config'
>;

/**
 * Input type aliases for creating positions
 */
export type CreateUniswapV3PositionInput = CreatePositionInput<'uniswapv3'>;
export type CreateAnyPositionInput = CreatePositionInput<keyof PositionConfigMap>;

/**
 * Input type for updating an existing position
 *
 * All fields are optional (partial update).
 * Calculated fields are omitted (recomputed by service).
 * Immutable fields are omitted: id, userId, config, state, createdAt, updatedAt
 *
 * Note: This is a basic helper for rare manual updates.
 * - Config updates are rare (position parameters are immutable on-chain)
 * - State updates should typically use refresh() method
 * - Token roles (baseToken, quoteToken) and pool are immutable - set at discovery
 *
 * @template P - Protocol key from PositionConfigMap ('uniswapv3', etc.)
 */
export type UpdatePositionInput<P extends keyof PositionConfigMap> = Partial<
  Pick<Position<P>, 'baseTokenId' | 'quoteTokenId' | 'poolId'>
>;

/**
 * Input type aliases for updating positions
 */
export type UpdateUniswapV3PositionInput = UpdatePositionInput<'uniswapv3'>;
export type UpdateAnyPositionInput = UpdatePositionInput<keyof PositionConfigMap>;
