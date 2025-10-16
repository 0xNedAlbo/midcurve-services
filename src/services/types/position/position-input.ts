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
 * Input type for updating an existing position
 *
 * All fields are optional (partial update).
 * Calculated fields are omitted (recomputed by service).
 * Immutable fields are omitted: id, userId, config, state, createdAt, updatedAt
 *
 * @template P - Protocol key from PositionConfigMap ('uniswapv3', etc.)
 */
export type UpdatePositionInput<P extends keyof PositionConfigMap> = Partial<
  Pick<Position<P>, 'baseTokenId' | 'quoteTokenId' | 'poolId'>
>;
