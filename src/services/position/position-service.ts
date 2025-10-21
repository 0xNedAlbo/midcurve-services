/**
 * Abstract Position Service
 *
 * Base class for protocol-specific position services.
 * Handles serialization/deserialization of config and state between
 * database JSON format and application types.
 *
 * Protocol implementations (e.g., UniswapV3PositionService) must implement
 * all abstract serialization and discovery methods.
 */

import { PrismaClient } from '@prisma/client';
import type { Position, PositionConfigMap } from '@midcurve/shared';
import type {
  PositionDiscoverInput,
  CreatePositionInput,
  UpdatePositionInput,
} from '../types/position/position-input.js';
import { createServiceLogger, log } from '../../logging/index.js';
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
  poolId: string;
  isToken0Quote: boolean;
  pool: any; // Pool with token0, token1 from include
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
  // ABSTRACT DISCOVERY METHOD
  // Protocol implementations MUST implement this method
  // ============================================================================

  /**
   * Discover and create a position from on-chain data
   *
   * Checks the database first for an existing position. If not found, reads
   * position configuration and state from on-chain sources (NFT contract),
   * discovers/fetches the pool and tokens, determines token roles (base/quote),
   * and creates a new position entry.
   *
   * Implementation note: Each protocol defines its own discovery input type
   * via PositionDiscoverInputMap. For example, Uniswap V3 uses { chainId, nftId, quoteTokenAddress }.
   *
   * Discovery should:
   * 1. Check database first (idempotent)
   * 2. Read immutable position config from on-chain (NFT ID, ticks, pool address)
   * 3. Discover/fetch the Pool and its tokens
   * 4. Determine which token is base and which is quote based on quoteTokenAddress
   * 5. Read current position state from on-chain (liquidity, fees, etc.)
   * 6. Calculate initial PnL and price range values
   * 7. Save to database and return Position
   *
   * @param userId - User ID who owns this position (database foreign key to User.id)
   * @param params - Discovery parameters (type-safe via PositionDiscoverInputMap[P])
   * @returns The discovered or existing position
   * @throws Error if discovery fails (protocol-specific errors)
   */
  abstract discover(
    userId: string,
    params: PositionDiscoverInput<P>
  ): Promise<Position<P>>;

  // ============================================================================
  // ABSTRACT REFRESH METHOD
  // Protocol implementations MUST implement this method
  // ============================================================================

  /**
   * Refresh position state from on-chain data
   *
   * Fetches the current position state from the blockchain and updates the database.
   * This is the primary method for updating position state (vs update() which is a generic helper).
   *
   * Note: Only updates mutable state fields (liquidity, feeGrowth, tokensOwed).
   * Config fields (chainId, nftId, ticks) are immutable and not updated.
   * Also recalculates PnL fields (currentValue, unrealizedPnl) based on fresh state.
   *
   * @param id - Position ID
   * @returns Updated position with fresh on-chain state
   * @throws Error if position not found
   * @throws Error if position is not the correct protocol
   * @throws Error if chain is not supported
   * @throws Error if on-chain read fails
   */
  abstract refresh(id: string): Promise<Position<P>>;

  // ============================================================================
  // ABSTRACT QUERY METHOD
  // Protocol implementations MUST implement this method
  // ============================================================================

  /**
   * Find many positions with filtering and pagination
   *
   * Query positions for a specific user with optional filters.
   * Each protocol defines its own filter options based on protocol-specific
   * configuration fields (e.g., chainId for EVM chains).
   *
   * Common filters across all protocols:
   * - userId (required) - User who owns the positions
   * - status - Position status: 'active', 'closed', or 'all'
   * - limit - Number of results to return (pagination)
   * - offset - Number of results to skip (pagination)
   *
   * Protocol-specific filters:
   * - Uniswap V3: chainId (filter by EVM chain ID from config JSON)
   * - Future protocols: May have different filter options
   *
   * Implementation requirements:
   * - MUST filter by protocol type (e.g., protocol = 'uniswapv3')
   * - MUST filter by userId
   * - SHOULD support status filter (active/closed/all via isActive field)
   * - SHOULD support pagination (limit, offset)
   * - SHOULD include full pool with token0/token1
   * - SHOULD order by createdAt DESC
   * - MUST return both positions array AND total count (for pagination)
   *
   * @param userId - User ID who owns the positions
   * @param options - Query options (protocol-specific + common filters)
   * @param options.status - Position status filter: 'active', 'closed', or 'all' (default: 'all')
   * @param options.limit - Number of results to return (default: 20, max recommended: 100)
   * @param options.offset - Number of results to skip (default: 0)
   * @returns Object containing positions array and total count
   *
   * @example
   * ```typescript
   * // Uniswap V3 implementation
   * const { positions, total } = await service.findMany(userId, {
   *   chainId: 1,       // Protocol-specific: EVM chain ID
   *   status: 'active', // Common: filter by active positions
   *   limit: 20,        // Common: pagination
   *   offset: 0         // Common: pagination
   * });
   * ```
   */
  abstract findMany(
    userId: string,
    options?: {
      status?: 'active' | 'closed' | 'all';
      limit?: number;
      offset?: number;
      [key: string]: unknown; // Allow protocol-specific options
    }
  ): Promise<{ positions: Position<P>[]; total: number }>;

  // ============================================================================
  // CRUD OPERATIONS
  // Base implementations without protocol-specific validation
  // Protocol implementations SHOULD override to add type filtering
  // ============================================================================

  /**
   * Create a new position
   *
   * Base implementation that handles database operations.
   * Derived classes should override this method to add validation.
   *
   * Note: This is a manual creation helper. For creating positions from on-chain data,
   * use discover() which handles pool discovery, token role determination, and state fetching.
   *
   * Implementation handles:
   * - Serialization of config and state to JSON
   * - Conversion of bigint fields to strings for database storage
   * - Default values for calculated fields (PnL, fees, price range)
   *
   * @param input - Position data to create (omits id, createdAt, updatedAt, calculated fields)
   * @returns The created position with generated id and timestamps
   */
  async create(input: CreatePositionInput<P>): Promise<Position<P>> {
    log.methodEntry(this.logger, 'create', {
      protocol: input.protocol,
      userId: input.userId,
      poolId: input.poolId,
    });

    try {
      // Serialize config for database storage
      const configDB = this.serializeConfig(input.config);

      // State is required for position creation
      // discover() method provides state from on-chain data
      if (!input.state) {
        const error = new Error(
          'state is required for position creation. Use discover() to create from on-chain data.'
        );
        log.methodError(this.logger, 'create', error, { input });
        throw error;
      }

      const stateDB = this.serializeState(input.state);

      // Default calculated values (will be computed properly in discover())
      const now = new Date();
      const zeroValue = '0';

      log.dbOperation(this.logger, 'create', 'Position', {
        protocol: input.protocol,
        positionType: input.positionType,
        userId: input.userId,
      });

      const result = await this.prisma.position.create({
        data: {
          protocol: input.protocol,
          positionType: input.positionType,
          userId: input.userId,
          poolId: input.poolId,
          isToken0Quote: input.isToken0Quote,
          config: configDB as object,
          state: stateDB as object,
          // Default calculated values
          currentValue: zeroValue,
          currentCostBasis: zeroValue,
          realizedPnl: zeroValue,
          unrealizedPnl: zeroValue,
          collectedFees: zeroValue,
          unClaimedFees: zeroValue,
          lastFeesCollectedAt: now,
          priceRangeLower: zeroValue,
          priceRangeUpper: zeroValue,
          positionOpenedAt: now,
          positionClosedAt: null,
          isActive: true,
        },
        include: {
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      });

      // Map database result to Position type
      const position = this.mapToPosition(result as PositionDbResult);

      this.logger.info(
        {
          id: position.id,
          protocol: position.protocol,
          positionType: position.positionType,
          userId: position.userId,
        },
        'Position created'
      );
      log.methodExit(this.logger, 'create', { id: position.id });
      return position;
    } catch (error) {
      log.methodError(this.logger, 'create', error as Error, {
        protocol: input.protocol,
      });
      throw error;
    }
  }

  /**
   * Find position by ID
   *
   * Base implementation returns position data.
   * Protocol-specific implementations should override to:
   * - Filter by protocol type
   *
   * @param id - Position ID
   * @returns Position if found, null otherwise
   */
  async findById(id: string): Promise<Position<P> | null> {
    log.methodEntry(this.logger, 'findById', { id });

    try {
      log.dbOperation(this.logger, 'findUnique', 'Position', { id });

      const result = await this.prisma.position.findUnique({
        where: { id },
        include: {
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      });

      if (!result) {
        log.methodExit(this.logger, 'findById', { id, found: false });
        return null;
      }

      // Map to Position type
      const position = this.mapToPosition(result as PositionDbResult);

      log.methodExit(this.logger, 'findById', { id, found: true });
      return position;
    } catch (error) {
      log.methodError(this.logger, 'findById', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update position
   *
   * Generic helper for rare manual updates.
   * - Config updates are rare (position parameters are immutable on-chain)
   * - State updates should typically use refresh() method
   * - Calculated fields (PnL, fees) should be recomputed after state changes
   *
   * Base implementation performs the update and returns the result.
   * Protocol-specific implementations should override to add validation.
   *
   * @param id - Position ID
   * @param input - Update input with optional fields
   * @returns Updated position
   * @throws Error if position not found
   */
  async update(id: string, input: UpdatePositionInput<P>): Promise<Position<P>> {
    log.methodEntry(this.logger, 'update', { id, input });

    try {
      // Currently, UpdatePositionInput<P> has no mutable fields
      // All updates should use refresh() method for state updates
      const data: any = {};

      log.dbOperation(this.logger, 'update', 'Position', {
        id,
        fields: Object.keys(data),
      });

      const result = await this.prisma.position.update({
        where: { id },
        data,
        include: {
          pool: {
            include: {
              token0: true,
              token1: true,
            },
          },
        },
      });

      // Map to Position type
      const position = this.mapToPosition(result as PositionDbResult);

      log.methodExit(this.logger, 'update', { id });
      return position;
    } catch (error) {
      log.methodError(this.logger, 'update', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete position
   *
   * Base implementation silently succeeds if position doesn't exist.
   * Protocol-specific implementations should override to:
   * - Verify protocol type (error if wrong protocol)
   *
   * @param id - Position ID
   * @returns Promise that resolves when deletion is complete
   */
  async delete(id: string): Promise<void> {
    log.methodEntry(this.logger, 'delete', { id });

    try {
      log.dbOperation(this.logger, 'delete', 'Position', { id });

      await this.prisma.position.delete({
        where: { id },
      });

      log.methodExit(this.logger, 'delete', { id, deleted: true });
    } catch (error: any) {
      // P2025 = Record not found
      if (error.code === 'P2025') {
        this.logger.debug({ id }, 'Position not found, delete operation is no-op');
        log.methodExit(this.logger, 'delete', { id, deleted: false });
        return;
      }

      log.methodError(this.logger, 'delete', error as Error, { id });
      throw error;
    }
  }

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
      pool: dbResult.pool as any, // Pool with token0, token1 from include
      isToken0Quote: dbResult.isToken0Quote,
      positionOpenedAt: dbResult.positionOpenedAt,
      positionClosedAt: dbResult.positionClosedAt,
      isActive: dbResult.isActive,
      config: this.parseConfig(dbResult.config),
      state: this.parseState(dbResult.state),
    };
  }
}
