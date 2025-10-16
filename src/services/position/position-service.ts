/**
 * Abstract Position Service
 *
 * Base class for protocol-specific position services.
 * Handles serialization/deserialization of config and state between
 * database JSON format and application types.
 *
 * Protocol implementations (e.g., UniswapV3PositionService) must implement
 * all abstract serialization methods.
 */

import { PrismaClient } from '@prisma/client';
import type { Position, PositionConfigMap } from '../../shared/types/position.js';
import { createServiceLogger } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * Dependencies for PositionService
 * All dependencies are optional and will use defaults if not provided
 */
export interface PositionServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * Generic position result from database (before deserialization)
 */
interface PositionDbResult {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  protocol: string;
  positionType: string;
  userId: string;
  currentValue: string; // bigint as string
  currentCostBasis: string;
  realizedPnl: string;
  unrealizedPnl: string;
  collectedFees: string;
  unClaimedFees: string;
  lastFeesCollectedAt: Date;
  priceRangeLower: string;
  priceRangeUpper: string;
  baseTokenId: string;
  quoteTokenId: string;
  poolId: string;
  positionOpenedAt: Date;
  positionClosedAt: Date | null;
  isActive: boolean;
  config: unknown;
  state: unknown;
}

/**
 * Abstract PositionService
 *
 * Provides base functionality for position management.
 * Protocol-specific services must extend this class and implement
 * serialization methods for config and state.
 *
 * @template P - Protocol key from PositionConfigMap ('uniswapv3', etc.)
 */
export abstract class PositionService<P extends keyof PositionConfigMap> {
  protected readonly _prisma: PrismaClient;
  protected readonly logger: ServiceLogger;

  /**
   * Creates a new PositionService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: PositionServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this.logger = createServiceLogger(this.constructor.name);
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
  }

  // ============================================================================
  // ABSTRACT SERIALIZATION METHODS
  // Protocol implementations MUST implement these methods
  // ============================================================================

  /**
   * Parse config from database JSON to application type
   *
   * Converts serialized values (if any) to native types.
   * For configs with only primitives, this may be a pass-through.
   *
   * @param configDB - Config object from database (JSON)
   * @returns Parsed config with native types
   */
  abstract parseConfig(configDB: unknown): PositionConfigMap[P]['config'];

  /**
   * Serialize config from application type to database JSON
   *
   * Converts native values (if any) to serializable types.
   * For configs with only primitives, this may be a pass-through.
   *
   * @param config - Application config with native types
   * @returns Serialized config for database storage
   */
  abstract serializeConfig(config: PositionConfigMap[P]['config']): unknown;

  /**
   * Parse state from database JSON to application type
   *
   * Converts serialized values (e.g., bigint strings) to native types.
   *
   * @param stateDB - State object from database (JSON with string values)
   * @returns Parsed state with native types (bigint, etc.)
   */
  abstract parseState(stateDB: unknown): PositionConfigMap[P]['state'];

  /**
   * Serialize state from application type to database JSON
   *
   * Converts native values (e.g., bigint) to serializable types (strings).
   *
   * @param state - Application state with native types
   * @returns Serialized state for database storage
   */
  abstract serializeState(state: PositionConfigMap[P]['state']): unknown;

  // ============================================================================
  // PROTECTED HELPERS
  // ============================================================================

  /**
   * Map database result to Position type
   *
   * Converts string values to bigint for numeric fields and calls
   * parseConfig/parseState for config/state deserialization.
   *
   * @param dbResult - Raw database result
   * @returns Position with native types
   */
  protected mapToPosition(dbResult: PositionDbResult): Position<P> {
    return {
      id: dbResult.id,
      createdAt: dbResult.createdAt,
      updatedAt: dbResult.updatedAt,
      protocol: dbResult.protocol as P,
      positionType: dbResult.positionType as Position<P>['positionType'],
      userId: dbResult.userId,
      currentValue: BigInt(dbResult.currentValue),
      currentCostBasis: BigInt(dbResult.currentCostBasis),
      realizedPnl: BigInt(dbResult.realizedPnl),
      unrealizedPnl: BigInt(dbResult.unrealizedPnl),
      collectedFees: BigInt(dbResult.collectedFees),
      unClaimedFees: BigInt(dbResult.unClaimedFees),
      lastFeesCollectedAt: dbResult.lastFeesCollectedAt,
      priceRangeLower: BigInt(dbResult.priceRangeLower),
      priceRangeUpper: BigInt(dbResult.priceRangeUpper),
      baseTokenId: dbResult.baseTokenId,
      quoteTokenId: dbResult.quoteTokenId,
      poolId: dbResult.poolId,
      positionOpenedAt: dbResult.positionOpenedAt,
      positionClosedAt: dbResult.positionClosedAt,
      isActive: dbResult.isActive,
      config: this.parseConfig(dbResult.config),
      state: this.parseState(dbResult.state),
    };
  }
}
