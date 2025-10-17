/**
 * UniswapV3PositionService
 *
 * Specialized service for Uniswap V3 position management.
 * Handles serialization/deserialization of Uniswap V3 position config and state.
 */

import { PrismaClient } from '@prisma/client';
import type {
  UniswapV3PositionConfig,
  UniswapV3PositionState,
  UniswapV3Position,
} from '../../shared/types/uniswapv3/position.js';
import type {
  UniswapV3PositionDiscoverInput,
  CreatePositionInput,
} from '../types/position/position-input.js';
import { PositionService } from './position-service.js';
import { log } from '../../logging/index.js';

/**
 * Dependencies for UniswapV3PositionService
 * All dependencies are optional and will use defaults if not provided
 */
export interface UniswapV3PositionServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * UniswapV3PositionService
 *
 * Provides position management for Uniswap V3 concentrated liquidity positions.
 * Implements serialization methods for Uniswap V3-specific config and state types.
 */
export class UniswapV3PositionService extends PositionService<'uniswapv3'> {
  /**
   * Creates a new UniswapV3PositionService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: UniswapV3PositionServiceDependencies = {}) {
    super(dependencies);
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS - SERIALIZATION
  // ============================================================================

  /**
   * Parse config from database JSON to application type
   *
   * For Uniswap V3, config contains only primitive types (no bigint),
   * so this is essentially a pass-through with type casting.
   *
   * @param configDB - Config object from database (JSON)
   * @returns Parsed Uniswap V3 config
   */
  parseConfig(configDB: unknown): UniswapV3PositionConfig {
    const db = configDB as {
      chainId: number;
      nftId: number;
      poolAddress: string;
      token0IsQuote: boolean;
      tickUpper: number;
      tickLower: number;
    };

    return {
      chainId: db.chainId,
      nftId: db.nftId,
      poolAddress: db.poolAddress,
      token0IsQuote: db.token0IsQuote,
      tickUpper: db.tickUpper,
      tickLower: db.tickLower,
    };
  }

  /**
   * Serialize config from application type to database JSON
   *
   * For Uniswap V3, config contains only primitive types (no bigint),
   * so this is essentially a pass-through.
   *
   * @param config - Application config
   * @returns Serialized config for database storage (JSON-serializable)
   */
  serializeConfig(config: UniswapV3PositionConfig): unknown {
    return {
      chainId: config.chainId,
      nftId: config.nftId,
      poolAddress: config.poolAddress,
      token0IsQuote: config.token0IsQuote,
      tickUpper: config.tickUpper,
      tickLower: config.tickLower,
    };
  }

  /**
   * Parse state from database JSON to application type
   *
   * Converts string values to bigint for Uniswap V3 state fields
   * (liquidity, feeGrowth values, tokensOwed).
   *
   * @param stateDB - State object from database (JSON with string values)
   * @returns Parsed Uniswap V3 state with bigint values
   */
  parseState(stateDB: unknown): UniswapV3PositionState {
    const db = stateDB as {
      ownerAddress: string;
      liquidity: string;
      feeGrowthInside0LastX128: string;
      feeGrowthInside1LastX128: string;
      tokensOwed0: string;
      tokensOwed1: string;
    };

    return {
      ownerAddress: db.ownerAddress,
      liquidity: BigInt(db.liquidity),
      feeGrowthInside0LastX128: BigInt(db.feeGrowthInside0LastX128),
      feeGrowthInside1LastX128: BigInt(db.feeGrowthInside1LastX128),
      tokensOwed0: BigInt(db.tokensOwed0),
      tokensOwed1: BigInt(db.tokensOwed1),
    };
  }

  /**
   * Serialize state from application type to database JSON
   *
   * Converts bigint values to strings for database storage.
   *
   * @param state - Application state with bigint values
   * @returns Serialized state with string values (JSON-serializable)
   */
  serializeState(state: UniswapV3PositionState): unknown {
    return {
      ownerAddress: state.ownerAddress,
      liquidity: state.liquidity.toString(),
      feeGrowthInside0LastX128: state.feeGrowthInside0LastX128.toString(),
      feeGrowthInside1LastX128: state.feeGrowthInside1LastX128.toString(),
      tokensOwed0: state.tokensOwed0.toString(),
      tokensOwed1: state.tokensOwed1.toString(),
    };
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS - DISCOVERY
  // ============================================================================

  /**
   * Discover and create a Uniswap V3 position from on-chain NFT data
   *
   * Checks the database first for an existing position. If not found:
   * 1. Reads position data from NonfungiblePositionManager contract (pool, ticks, liquidity)
   * 2. Discovers/fetches the pool via UniswapV3PoolService
   * 3. Determines which token is base and which is quote by comparing quoteTokenAddress
   *    with the pool's token0 and token1 addresses (sets token0IsQuote in config)
   * 4. Reads current position state from NFT contract (owner, liquidity, fees)
   * 5. Calculates initial PnL and price range values
   * 6. Saves position to database
   * 7. Returns Position
   *
   * Discovery is idempotent - calling multiple times with the same userId/chainId/nftId
   * returns the existing position.
   *
   * Note: Position state can be refreshed later using the refresh() method to get
   * the latest on-chain values.
   *
   * @param userId - User ID who owns this position (database foreign key to User.id)
   * @param params - Discovery parameters { chainId, nftId, quoteTokenAddress }
   * @returns The discovered or existing position
   * @throws Error if chainId is not supported
   * @throws Error if quoteTokenAddress format is invalid
   * @throws Error if NFT doesn't exist or isn't a Uniswap V3 position
   * @throws Error if quoteTokenAddress doesn't match either pool token
   * @throws Error if on-chain read fails
   */
  override async discover(
    userId: string,
    params: UniswapV3PositionDiscoverInput
  ): Promise<UniswapV3Position> {
    const { chainId, nftId, quoteTokenAddress } = params;
    log.methodEntry(this.logger, 'discover', {
      userId,
      chainId,
      nftId,
      quoteTokenAddress,
    });

    // TODO: Implement discovery logic
    // 1. Check database first (optimization) - search by userId + chainId + nftId
    // 2. Validate quoteTokenAddress format
    // 3. Read position data from NonfungiblePositionManager
    // 4. Discover pool via UniswapV3PoolService
    // 5. Determine base/quote tokens and set token0IsQuote
    // 6. Calculate PnL and price ranges
    // 7. Create position via create() method with userId

    const error = new Error('discover() not yet implemented');
    log.methodError(this.logger, 'discover', error, {
      userId,
      chainId,
      nftId,
      quoteTokenAddress,
    });
    throw error;
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATION - REFRESH
  // ============================================================================

  /**
   * Refresh position state from on-chain NFT data
   *
   * Fetches the current position state from the NonfungiblePositionManager contract
   * and updates the database.
   *
   * Updates:
   * - Mutable state fields (liquidity, feeGrowthInside0/1LastX128, tokensOwed0/1, ownerAddress)
   * - Recalculates PnL fields (currentValue, unrealizedPnl) based on fresh state and pool price
   * - Recalculates unclaimedFees based on tokensOwed0/1
   *
   * Note: Config fields (chainId, nftId, ticks, poolAddress) are immutable and not updated.
   *
   * @param id - Position ID
   * @returns Updated position with fresh on-chain state
   * @throws Error if position not found
   * @throws Error if position is not uniswapv3 protocol
   * @throws Error if chain is not supported
   * @throws Error if on-chain read fails
   */
  override async refresh(id: string): Promise<UniswapV3Position> {
    log.methodEntry(this.logger, 'refresh', { id });

    // TODO: Implement refresh logic
    // 1. Get existing position to verify it exists and get config
    // 2. Verify chain is supported
    // 3. Read fresh state from NonfungiblePositionManager contract
    // 4. Fetch pool to get current price
    // 5. Recalculate PnL and fees
    // 6. Update position via update() method

    const error = new Error('refresh() not yet implemented');
    log.methodError(this.logger, 'refresh', error, { id });
    throw error;
  }

  // ============================================================================
  // CRUD OPERATIONS OVERRIDES
  // ============================================================================

  /**
   * Create a new Uniswap V3 position
   *
   * Overrides base implementation to add:
   * - Duplicate prevention: Checks if position already exists for this user/chain/nftId
   * - Returns existing position if duplicate found (idempotent)
   *
   * Note: This is a manual creation helper. For creating positions from on-chain data,
   * use discover() which handles pool discovery, token role determination, and state fetching.
   *
   * @param input - Position data to create
   * @returns The created position, or existing position if duplicate found
   */
  override async create(
    input: CreatePositionInput<'uniswapv3'>
  ): Promise<UniswapV3Position> {
    log.methodEntry(this.logger, 'create', {
      userId: input.userId,
      chainId: input.config.chainId,
      nftId: input.config.nftId,
    });

    try {
      // Check for existing position by userId + chainId + nftId
      const existing = await this.findByUserAndChainAndNftId(
        input.userId,
        input.config.chainId,
        input.config.nftId
      );

      if (existing) {
        this.logger.info(
          {
            id: existing.id,
            userId: input.userId,
            chainId: input.config.chainId,
            nftId: input.config.nftId,
          },
          'Position already exists, returning existing position'
        );
        log.methodExit(this.logger, 'create', {
          id: existing.id,
          duplicate: true,
        });
        return existing;
      }

      // No duplicate found, create new position
      const position = await super.create(input);

      log.methodExit(this.logger, 'create', { id: position.id, duplicate: false });
      return position as UniswapV3Position;
    } catch (error) {
      log.methodError(this.logger, 'create', error as Error, {
        userId: input.userId,
        chainId: input.config.chainId,
        nftId: input.config.nftId,
      });
      throw error;
    }
  }

  /**
   * Find position by ID
   *
   * Overrides base implementation to:
   * - Filter by protocol type (returns null if not uniswapv3)
   *
   * @param id - Position ID
   * @returns Position if found and is uniswapv3 protocol, null otherwise
   */
  override async findById(id: string): Promise<UniswapV3Position | null> {
    log.methodEntry(this.logger, 'findById', { id });

    try {
      log.dbOperation(this.logger, 'findUnique', 'Position', { id });

      const result = await this.prisma.position.findUnique({
        where: { id },
      });

      if (!result) {
        log.methodExit(this.logger, 'findById', { id, found: false });
        return null;
      }

      // Filter by protocol type
      if (result.protocol !== 'uniswapv3') {
        this.logger.debug(
          { id, protocol: result.protocol },
          'Position found but is not uniswapv3 protocol'
        );
        log.methodExit(this.logger, 'findById', {
          id,
          found: false,
          reason: 'wrong_protocol',
        });
        return null;
      }

      // Map to UniswapV3Position
      const position = this.mapToPosition(result as any);

      log.methodExit(this.logger, 'findById', { id, found: true });
      return position as UniswapV3Position;
    } catch (error) {
      log.methodError(this.logger, 'findById', error as Error, { id });
      throw error;
    }
  }

  /**
   * Delete position
   *
   * Overrides base implementation to:
   * - Verify protocol type (error if position exists but is not uniswapv3)
   * - Silently succeed if position doesn't exist (idempotent)
   *
   * @param id - Position ID
   * @returns Promise that resolves when deletion is complete
   * @throws Error if position exists but is not uniswapv3 protocol
   */
  override async delete(id: string): Promise<void> {
    log.methodEntry(this.logger, 'delete', { id });

    try {
      // Check if position exists and verify protocol type
      log.dbOperation(this.logger, 'findUnique', 'Position', { id });

      const existing = await this.prisma.position.findUnique({
        where: { id },
      });

      if (!existing) {
        this.logger.debug({ id }, 'Position not found, delete operation is no-op');
        log.methodExit(this.logger, 'delete', { id, deleted: false });
        return;
      }

      // Verify protocol type
      if (existing.protocol !== 'uniswapv3') {
        const error = new Error(
          `Cannot delete position ${id}: expected protocol 'uniswapv3', got '${existing.protocol}'`
        );
        log.methodError(this.logger, 'delete', error, {
          id,
          protocol: existing.protocol,
        });
        throw error;
      }

      // Call base implementation
      await super.delete(id);

      log.methodExit(this.logger, 'delete', { id, deleted: true });
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && error.message.includes('Cannot delete'))) {
        log.methodError(this.logger, 'delete', error as Error, { id });
      }
      throw error;
    }
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Find position by user ID, chain ID, and NFT ID
   *
   * Used for duplicate checking during position creation and discovery.
   *
   * @param userId - User ID who owns the position
   * @param chainId - Chain ID where the position is deployed
   * @param nftId - NFT token ID representing the position
   * @returns Position if found, null otherwise
   */
  private async findByUserAndChainAndNftId(
    userId: string,
    chainId: number,
    nftId: number
  ): Promise<UniswapV3Position | null> {
    log.dbOperation(this.logger, 'findFirst', 'Position', {
      userId,
      chainId,
      nftId,
      protocol: 'uniswapv3',
    });

    const result = await this.prisma.position.findFirst({
      where: {
        protocol: 'uniswapv3',
        userId,
        // Query config JSON field for chainId and nftId
        config: {
          path: ['chainId'],
          equals: chainId,
        },
      },
    });

    if (!result) {
      return null;
    }

    // Parse config to verify nftId matches (additional safeguard)
    const config = this.parseConfig(result.config);
    if (config.nftId !== nftId) {
      return null;
    }

    // Map to UniswapV3Position
    const position = this.mapToPosition(result as any);
    return position as UniswapV3Position;
  }
}
