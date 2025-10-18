/**
 * Uniswap V3 Position Ledger Service
 *
 * Specialized service for Uniswap V3 position ledger event management.
 * Handles serialization/deserialization and discovery of position events from blockchain.
 *
 * Key features:
 * - Fetches events from Etherscan API
 * - Uses **historic pool prices** for accurate PnL calculations
 * - Calculates cost basis, realized PnL, and fee separation
 * - Maintains event chain with previousId linkage
 * - Idempotent discovery (same events won't be duplicated)
 */

import { createHash } from 'crypto';
import { PositionLedgerService } from './position-ledger-service.js';
import type { PositionLedgerServiceDependencies } from './position-ledger-service.js';
import type {
  UniswapV3LedgerEvent,
  UniswapV3LedgerEventConfig,
  UniswapV3LedgerEventState,
} from '../../shared/types/uniswapv3/position-ledger-event.js';
import type {
  CreateUniswapV3LedgerEventInput,
  UniswapV3EventDiscoverInput,
} from '../types/position-ledger/position-ledger-event-input.js';
import {
  toEventConfig,
  toEventConfigDB,
  toEventState,
  toEventStateDB,
} from '../types/uniswapv3/position-ledger-event-db.js';
import { EtherscanClient } from '../../clients/etherscan/index.js';
import type { RawPositionEvent } from '../../clients/etherscan/types.js';
import { UniswapV3PositionService } from '../position/uniswapv3-position-service.js';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { UniswapV3PoolPriceService } from '../pool-price/uniswapv3-pool-price-service.js';
import type { UniswapV3Position } from '../../shared/types/uniswapv3/position.js';
import type { UniswapV3Pool } from '../../shared/types/uniswapv3/pool.js';
import type { Erc20Token } from '../../shared/types/token.js';
import type { UniswapV3PoolPrice } from '../../shared/types/uniswapv3/pool-price.js';
import {
  calculatePoolPriceInQuoteToken,
  calculateTokenValueInQuote,
  calculateProportionalCostBasis,
  separateFeesFromPrincipal,
} from '../../utils/uniswapv3/ledger-calculations.js';
import { log } from '../../logging/index.js';

/**
 * Dependencies for UniswapV3PositionLedgerService
 * All dependencies are optional and will use defaults if not provided
 */
export interface UniswapV3PositionLedgerServiceDependencies
  extends PositionLedgerServiceDependencies {
  /**
   * Etherscan client for fetching position events from blockchain
   * If not provided, the singleton EtherscanClient instance will be used
   */
  etherscanClient?: EtherscanClient;

  /**
   * Uniswap V3 position service for position data access
   * If not provided, a new UniswapV3PositionService instance will be created
   */
  positionService?: UniswapV3PositionService;

  /**
   * Uniswap V3 pool service for pool data access
   * If not provided, a new UniswapV3PoolService instance will be created
   */
  poolService?: UniswapV3PoolService;

  /**
   * Uniswap V3 pool price service for historic pool price discovery
   * If not provided, a new UniswapV3PoolPriceService instance will be created
   */
  poolPriceService?: UniswapV3PoolPriceService;
}

/**
 * Position data fetched from database
 */
interface PositionData {
  position: UniswapV3Position;
  nftId: bigint;
  chainId: number;
  poolId: string;
}

/**
 * Pool metadata with tokens
 */
interface PoolMetadata {
  pool: UniswapV3Pool;
  token0: Erc20Token;
  token1: Erc20Token;
  token0IsQuote: boolean;
  token0Decimals: number;
  token1Decimals: number;
}

/**
 * Historic pool price data
 */
interface HistoricPoolPrice {
  poolPrice: UniswapV3PoolPrice;
  sqrtPriceX96: bigint;
  timestamp: Date;
}

/**
 * Parameters for building event from raw data
 */
interface BuildEventParams {
  rawEvent: RawPositionEvent;
  previousState: PreviousEventState;
  poolMetadata: PoolMetadata;
  sqrtPriceX96: bigint;
  previousEventId: string | null;
  positionId: string;
}

/**
 * Previous event state for sequential building
 */
interface PreviousEventState {
  uncollectedPrincipal0: bigint;
  uncollectedPrincipal1: bigint;
  liquidity: bigint;
  costBasis: bigint;
  pnl: bigint;
}

/**
 * Uniswap V3 Position Ledger Service
 *
 * Extends PositionLedgerService with Uniswap V3-specific implementation.
 * Fetches events from Etherscan and calculates financial data using historic pool prices.
 */
export class UniswapV3PositionLedgerService extends PositionLedgerService<'uniswapv3'> {
  private readonly _etherscanClient: EtherscanClient;
  private readonly _positionService: UniswapV3PositionService;
  private readonly _poolService: UniswapV3PoolService;
  private readonly _poolPriceService: UniswapV3PoolPriceService;

  /**
   * Creates a new UniswapV3PositionLedgerService instance
   *
   * @param dependencies - Optional dependencies object
   */
  constructor(dependencies: UniswapV3PositionLedgerServiceDependencies = {}) {
    super(dependencies);

    this._etherscanClient =
      dependencies.etherscanClient ?? EtherscanClient.getInstance();
    this._positionService =
      dependencies.positionService ??
      new UniswapV3PositionService({ prisma: this.prisma });
    this._poolService =
      dependencies.poolService ?? new UniswapV3PoolService({ prisma: this.prisma });
    this._poolPriceService =
      dependencies.poolPriceService ??
      new UniswapV3PoolPriceService({ prisma: this.prisma });

    this.logger.info('UniswapV3PositionLedgerService initialized');
  }

  /**
   * Get the Etherscan client instance
   */
  protected get etherscanClient(): EtherscanClient {
    return this._etherscanClient;
  }

  /**
   * Get the position service instance
   */
  protected get positionService(): UniswapV3PositionService {
    return this._positionService;
  }

  /**
   * Get the pool service instance
   */
  protected get poolService(): UniswapV3PoolService {
    return this._poolService;
  }

  /**
   * Get the pool price service instance
   */
  protected get poolPriceService(): UniswapV3PoolPriceService {
    return this._poolPriceService;
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS - SERIALIZATION
  // ============================================================================

  /**
   * Parse config from database JSON to application type
   *
   * Converts string values (bigint) to native bigint for Uniswap V3 config.
   *
   * @param configDB - Config object from database (JSON)
   * @returns Parsed config with native bigint values
   */
  parseConfig(configDB: unknown): UniswapV3LedgerEventConfig {
    return toEventConfig(configDB as any);
  }

  /**
   * Serialize config from application type to database JSON
   *
   * Converts native bigint values to strings for database storage.
   *
   * @param config - Application config with native bigint values
   * @returns Serialized config for database storage (JSON-serializable)
   */
  serializeConfig(config: UniswapV3LedgerEventConfig): unknown {
    return toEventConfigDB(config);
  }

  /**
   * Parse state from database JSON to application type
   *
   * Handles discriminated union (INCREASE/DECREASE/COLLECT) and converts
   * string values to bigint.
   *
   * @param stateDB - State object from database (JSON with string values)
   * @returns Parsed state with native bigint values
   */
  parseState(stateDB: unknown): UniswapV3LedgerEventState {
    return toEventState(stateDB as any);
  }

  /**
   * Serialize state from application type to database JSON
   *
   * Handles discriminated union serialization and converts bigint to strings.
   *
   * @param state - Application state with native bigint values
   * @returns Serialized state for database storage (JSON-serializable)
   */
  serializeState(state: UniswapV3LedgerEventState): unknown {
    return toEventStateDB(state);
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS - HASH GENERATION
  // ============================================================================

  /**
   * Generate input hash for deduplication
   *
   * Creates MD5 hash from blockchain coordinates (blockNumber, txIndex, logIndex).
   * This ensures idempotent event processing - same event won't be added twice.
   *
   * @param input - Event creation input
   * @returns MD5 hash string (32 hex characters)
   */
  generateInputHash(input: CreateUniswapV3LedgerEventInput): string {
    const { blockNumber, txIndex, logIndex } = input.config;
    const hashInput = `${blockNumber}-${txIndex}-${logIndex}`;
    return createHash('md5').update(hashInput).digest('hex');
  }

  // ============================================================================
  // ABSTRACT METHOD IMPLEMENTATIONS - DISCOVERY
  // ============================================================================

  /**
   * Discover all events for a position from blockchain
   *
   * Fetches complete event history from Etherscan and builds financial state sequentially.
   * Uses **historic pool prices** for each event to ensure accurate PnL calculations.
   *
   * Process:
   * 1. Fetch position data (nftId, chainId, poolId)
   * 2. Delete existing events (rebuild from scratch)
   * 3. Fetch pool metadata (tokens, decimals, etc.)
   * 4. Fetch raw events from Etherscan
   * 5. Deduplicate and sort chronologically
   * 6. For each event:
   *    - Discover historic pool price at event block
   *    - Calculate financial data (cost basis, PnL, fees)
   *    - Save event to database
   * 7. Return complete history (descending by timestamp)
   *
   * @param positionId - Position database ID
   * @returns Complete event history, sorted descending by timestamp (newest first)
   * @throws Error if position/pool not found or discovery fails
   */
  async discoverAllEvents(positionId: string): Promise<UniswapV3LedgerEvent[]> {
    log.methodEntry(this.logger, 'discoverAllEvents', { positionId });

    try {
      // 1. Fetch position data
      const positionData = await this.fetchPositionData(positionId);
      const { nftId, chainId, poolId } = positionData;

      this.logger.info(
        { positionId, nftId, chainId, poolId },
        'Starting event discovery'
      );

      // 2. Delete existing events (rebuild from scratch)
      await this.deleteAllItems(positionId);

      // 3. Fetch pool metadata
      const poolMetadata = await this.fetchPoolMetadata(poolId);

      // 4. Fetch raw events from Etherscan
      this.logger.info({ chainId, nftId }, 'Fetching events from Etherscan');
      const rawEvents = await this.etherscanClient.fetchPositionEvents(
        chainId,
        nftId.toString()
      );

      this.logger.info(
        { positionId, eventCount: rawEvents.length },
        'Raw events fetched from Etherscan'
      );

      if (rawEvents.length === 0) {
        this.logger.info({ positionId }, 'No events found for position');
        log.methodExit(this.logger, 'discoverAllEvents', { count: 0 });
        return [];
      }

      // 5. Deduplicate and sort chronologically
      const sortedEvents = this.sortEventsChronologically(rawEvents);

      // 6. Build state sequentially
      let previousState: PreviousEventState = {
        uncollectedPrincipal0: 0n,
        uncollectedPrincipal1: 0n,
        liquidity: 0n,
        costBasis: 0n,
        pnl: 0n,
      };
      let previousEventId: string | null = null;

      for (const rawEvent of sortedEvents) {
        this.logger.debug(
          {
            positionId,
            blockNumber: rawEvent.blockNumber,
            eventType: rawEvent.eventType,
          },
          'Processing event'
        );

        // Discover historic pool price at event block
        const historicPrice = await this.getHistoricPoolPrice(
          poolId,
          rawEvent.blockNumber
        );

        // Build event from raw data
        const eventInput = await this.buildEventFromRawData({
          rawEvent,
          previousState,
          poolMetadata,
          sqrtPriceX96: historicPrice.sqrtPriceX96,
          previousEventId,
          positionId,
        });

        // Save event
        const savedEvents = await this.addItem(positionId, eventInput);

        // Update state for next iteration
        previousEventId = savedEvents[0]!.id; // Newest event is first (descending order)
        previousState = {
          uncollectedPrincipal0: eventInput.config.uncollectedPrincipal0After,
          uncollectedPrincipal1: eventInput.config.uncollectedPrincipal1After,
          liquidity: eventInput.config.liquidityAfter,
          costBasis: eventInput.costBasisAfter,
          pnl: eventInput.pnlAfter,
        };

        this.logger.debug(
          {
            positionId,
            eventId: previousEventId,
            eventType: eventInput.eventType,
            costBasisAfter: eventInput.costBasisAfter.toString(),
            pnlAfter: eventInput.pnlAfter.toString(),
          },
          'Event processed and saved'
        );
      }

      // 7. Return complete history
      const allEvents = await this.findAllItems(positionId);

      this.logger.info(
        {
          positionId,
          eventCount: allEvents.length,
          finalCostBasis: previousState.costBasis.toString(),
          finalPnl: previousState.pnl.toString(),
        },
        'Event discovery completed'
      );

      log.methodExit(this.logger, 'discoverAllEvents', { count: allEvents.length });
      return allEvents;
    } catch (error) {
      log.methodError(this.logger, 'discoverAllEvents', error as Error, {
        positionId,
      });
      throw error;
    }
  }

  /**
   * Discover and add a single event to position ledger
   *
   * Adds a new event to the end of the event chain.
   * Validates event sequence and calculates financial data based on previous state.
   * Uses **historic pool price** at the event block for accurate calculations.
   *
   * Process:
   * 1. Fetch position data and validate NFT ID
   * 2. Fetch pool metadata
   * 3. Fetch last event (for previous state)
   * 4. Validate event timestamp is after last event
   * 5. Discover historic pool price at event block
   * 6. Calculate new state from previous + current event
   * 7. Save event
   * 8. Return complete history (descending by timestamp)
   *
   * @param positionId - Position database ID
   * @param input - Discovery input with raw event data
   * @returns Complete event history, sorted descending by timestamp (newest first)
   * @throws Error if event cannot be added or discovery fails
   */
  async discoverEvent(
    positionId: string,
    input: UniswapV3EventDiscoverInput
  ): Promise<UniswapV3LedgerEvent[]> {
    log.methodEntry(this.logger, 'discoverEvent', {
      positionId,
      eventType: input.eventType,
      blockNumber: input.blockNumber,
    });

    try {
      // 1. Fetch position data and validate NFT ID
      const positionData = await this.fetchPositionData(positionId);
      const { nftId, poolId } = positionData;

      if (nftId !== input.tokenId) {
        const error = new Error(
          `NFT ID mismatch: position has ${nftId}, event has ${input.tokenId}`
        );
        log.methodError(this.logger, 'discoverEvent', error, {
          positionId,
          positionNftId: nftId,
          eventNftId: input.tokenId,
        });
        throw error;
      }

      // 2. Fetch pool metadata
      const poolMetadata = await this.fetchPoolMetadata(poolId);

      // 3. Fetch last event (for previous state)
      const existingEvents = await this.findAllItems(positionId);
      const lastEvent = existingEvents[0]; // Newest first (descending order)

      // 4. Validate event timestamp is after last event
      if (lastEvent && input.timestamp <= lastEvent.timestamp) {
        const error = new Error(
          `Event timestamp (${input.timestamp.toISOString()}) must be after last event (${lastEvent.timestamp.toISOString()})`
        );
        log.methodError(this.logger, 'discoverEvent', error, {
          positionId,
          eventTimestamp: input.timestamp,
          lastEventTimestamp: lastEvent.timestamp,
        });
        throw error;
      }

      // Get previous state
      const previousState: PreviousEventState = lastEvent
        ? {
            uncollectedPrincipal0: lastEvent.config.uncollectedPrincipal0After,
            uncollectedPrincipal1: lastEvent.config.uncollectedPrincipal1After,
            liquidity: lastEvent.config.liquidityAfter,
            costBasis: lastEvent.costBasisAfter,
            pnl: lastEvent.pnlAfter,
          }
        : {
            uncollectedPrincipal0: 0n,
            uncollectedPrincipal1: 0n,
            liquidity: 0n,
            costBasis: 0n,
            pnl: 0n,
          };

      const previousEventId = lastEvent?.id ?? null;

      // 5. Discover historic pool price at event block
      this.logger.info(
        { positionId, blockNumber: input.blockNumber },
        'Discovering historic pool price'
      );
      const historicPrice = await this.getHistoricPoolPrice(poolId, input.blockNumber);

      // 6. Convert discovery input to raw event format
      const rawEvent = this.convertDiscoverInputToRawEvent(input, positionData.chainId);

      // 7. Build event from raw data
      const eventInput = await this.buildEventFromRawData({
        rawEvent,
        previousState,
        poolMetadata,
        sqrtPriceX96: historicPrice.sqrtPriceX96,
        previousEventId,
        positionId,
      });

      // 8. Save event and return complete history
      const allEvents = await this.addItem(positionId, eventInput);

      this.logger.info(
        {
          positionId,
          eventId: allEvents[0]!.id,
          eventType: input.eventType,
          costBasisAfter: eventInput.costBasisAfter.toString(),
          pnlAfter: eventInput.pnlAfter.toString(),
        },
        'Single event discovered and saved'
      );

      log.methodExit(this.logger, 'discoverEvent', { count: allEvents.length });
      return allEvents;
    } catch (error) {
      log.methodError(this.logger, 'discoverEvent', error as Error, {
        positionId,
        eventType: input.eventType,
      });
      throw error;
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Fetch position data from database
   *
   * @param positionId - Position ID
   * @returns Position data with extracted config fields
   * @throws Error if position not found or not uniswapv3
   */
  private async fetchPositionData(positionId: string): Promise<PositionData> {
    log.dbOperation(this.logger, 'findUnique', 'Position', { id: positionId });

    const position = await this.prisma.position.findUnique({
      where: { id: positionId },
      include: { pool: true },
    });

    if (!position) {
      throw new Error(`Position not found: ${positionId}`);
    }

    if (position.protocol !== 'uniswapv3') {
      throw new Error(
        `Invalid position protocol '${position.protocol}'. Expected 'uniswapv3'.`
      );
    }

    // Parse position config
    const config = position.config as unknown as { nftId: number; chainId: number };

    return {
      position: position as unknown as UniswapV3Position,
      nftId: BigInt(config.nftId),
      chainId: config.chainId,
      poolId: position.poolId,
    };
  }

  /**
   * Fetch pool metadata from database
   *
   * @param poolId - Pool ID
   * @returns Pool metadata with tokens and decimals
   * @throws Error if pool or tokens not found
   */
  private async fetchPoolMetadata(poolId: string): Promise<PoolMetadata> {
    log.dbOperation(this.logger, 'findUnique', 'Pool', { id: poolId });

    const pool = await this.prisma.pool.findUnique({
      where: { id: poolId },
      include: {
        token0: true,
        token1: true,
      },
    });

    if (!pool) {
      throw new Error(`Pool not found: ${poolId}`);
    }

    if (!pool.token0 || !pool.token1) {
      throw new Error(`Pool tokens not found for pool: ${poolId}`);
    }

    // Determine quote token (convention: USDC/WETH pairs have USDC as token1)
    // For now, assume token1 is quote (can be enhanced with heuristics)
    const token0IsQuote = false;

    return {
      pool: pool as unknown as UniswapV3Pool,
      token0: pool.token0 as unknown as Erc20Token,
      token1: pool.token1 as unknown as Erc20Token,
      token0IsQuote,
      token0Decimals: pool.token0.decimals,
      token1Decimals: pool.token1.decimals,
    };
  }

  /**
   * Get historic pool price at specific block
   *
   * Uses pool price service to discover/fetch historic price.
   * The discover() method is idempotent - returns cached price if already exists.
   *
   * @param poolId - Pool ID
   * @param blockNumber - Block number for historic price
   * @returns Historic pool price data
   * @throws Error if price discovery fails
   */
  private async getHistoricPoolPrice(
    poolId: string,
    blockNumber: bigint
  ): Promise<HistoricPoolPrice> {
    this.logger.debug(
      { poolId, blockNumber: blockNumber.toString() },
      'Discovering historic pool price'
    );

    const poolPrice = await this.poolPriceService.discover(poolId, {
      blockNumber: Number(blockNumber),
    });

    const sqrtPriceX96 = poolPrice.state.sqrtPriceX96;

    this.logger.debug(
      {
        poolId,
        blockNumber: blockNumber.toString(),
        sqrtPriceX96: sqrtPriceX96.toString(),
        timestamp: poolPrice.timestamp,
      },
      'Historic pool price discovered'
    );

    return {
      poolPrice,
      sqrtPriceX96,
      timestamp: poolPrice.timestamp,
    };
  }

  /**
   * Build event input from raw event data and calculated state
   *
   * Core financial calculation logic. Handles INCREASE/DECREASE/COLLECT events
   * and calculates cost basis, PnL, and fee separation.
   *
   * @param params - Build parameters
   * @returns Event creation input ready for database
   */
  private async buildEventFromRawData(
    params: BuildEventParams
  ): Promise<CreateUniswapV3LedgerEventInput> {
    const { rawEvent, previousState, poolMetadata, sqrtPriceX96, previousEventId, positionId } =
      params;

    const { token0, token1, token0IsQuote, token0Decimals, token1Decimals } = poolMetadata;

    // Calculate pool price from historic sqrtPriceX96
    const poolPrice = calculatePoolPriceInQuoteToken(
      sqrtPriceX96,
      token0IsQuote,
      token0Decimals,
      token1Decimals
    );

    // Parse amounts from raw event (strings to bigint)
    const amount0 = BigInt(rawEvent.amount0 ?? '0');
    const amount1 = BigInt(rawEvent.amount1 ?? '0');
    const tokenId = BigInt(rawEvent.tokenId);

    // Handle event type
    let deltaL = 0n;
    let liquidityAfter = previousState.liquidity;
    let deltaCostBasis = 0n;
    let costBasisAfter = previousState.costBasis;
    let deltaPnl = 0n;
    let pnlAfter = previousState.pnl;
    let feesCollected0 = 0n;
    let feesCollected1 = 0n;
    let uncollectedPrincipal0After = previousState.uncollectedPrincipal0;
    let uncollectedPrincipal1After = previousState.uncollectedPrincipal1;
    let rewards: Array<{ tokenId: string; tokenAmount: bigint; tokenValue: bigint }> = [];
    let state: UniswapV3LedgerEventState;

    if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
      // INCREASE_LIQUIDITY: Add liquidity and increase cost basis
      deltaL = BigInt(rawEvent.liquidity ?? '0');
      liquidityAfter = previousState.liquidity + deltaL;

      const tokenValue = calculateTokenValueInQuote(
        amount0,
        amount1,
        poolPrice,
        token0IsQuote,
        token0Decimals,
        token1Decimals
      );

      deltaCostBasis = tokenValue;
      costBasisAfter = previousState.costBasis + tokenValue;

      // No PnL realization on deposit
      deltaPnl = 0n;
      pnlAfter = previousState.pnl;

      state = {
        eventType: 'INCREASE_LIQUIDITY',
        tokenId,
        liquidity: deltaL,
        amount0,
        amount1,
      };
    } else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
      // DECREASE_LIQUIDITY: Remove liquidity, realize PnL, add to uncollected principal
      deltaL = BigInt(rawEvent.liquidity ?? '0');
      liquidityAfter = previousState.liquidity - deltaL;

      // Calculate proportional cost basis removal
      const proportionalCostBasis = calculateProportionalCostBasis(
        previousState.costBasis,
        deltaL,
        previousState.liquidity
      );

      deltaCostBasis = -proportionalCostBasis;
      costBasisAfter = previousState.costBasis - proportionalCostBasis;

      // Calculate token value at current (historic) price
      const tokenValue = calculateTokenValueInQuote(
        amount0,
        amount1,
        poolPrice,
        token0IsQuote,
        token0Decimals,
        token1Decimals
      );

      // Realize PnL = value received - cost basis removed
      deltaPnl = tokenValue - proportionalCostBasis;
      pnlAfter = previousState.pnl + deltaPnl;

      // Add withdrawn amounts to uncollected principal pool
      uncollectedPrincipal0After = previousState.uncollectedPrincipal0 + amount0;
      uncollectedPrincipal1After = previousState.uncollectedPrincipal1 + amount1;

      state = {
        eventType: 'DECREASE_LIQUIDITY',
        tokenId,
        liquidity: deltaL,
        amount0,
        amount1,
      };
    } else {
      // COLLECT: Separate fees from principal, no PnL change
      const { feeAmount0, feeAmount1, principalAmount0, principalAmount1 } = separateFeesFromPrincipal(
        amount0,
        amount1,
        previousState.uncollectedPrincipal0,
        previousState.uncollectedPrincipal1
      );

      feesCollected0 = feeAmount0;
      feesCollected1 = feeAmount1;

      uncollectedPrincipal0After = previousState.uncollectedPrincipal0 - principalAmount0;
      uncollectedPrincipal1After = previousState.uncollectedPrincipal1 - principalAmount1;

      // Calculate fee values
      const fee0Value = calculateTokenValueInQuote(
        feeAmount0,
        0n,
        poolPrice,
        token0IsQuote,
        token0Decimals,
        token1Decimals
      );
      const fee1Value = calculateTokenValueInQuote(
        0n,
        feeAmount1,
        poolPrice,
        token0IsQuote,
        token0Decimals,
        token1Decimals
      );

      // Build rewards array (only include non-zero fees)
      if (feeAmount0 > 0n) {
        rewards.push({
          tokenId: token0.id,
          tokenAmount: feeAmount0,
          tokenValue: fee0Value,
        });
      }
      if (feeAmount1 > 0n) {
        rewards.push({
          tokenId: token1.id,
          tokenAmount: feeAmount1,
          tokenValue: fee1Value,
        });
      }

      // No cost basis or PnL change on collect
      deltaCostBasis = 0n;
      costBasisAfter = previousState.costBasis;
      deltaPnl = 0n;
      pnlAfter = previousState.pnl;

      state = {
        eventType: 'COLLECT',
        tokenId,
        recipient: rawEvent.recipient ?? '0x0000000000000000000000000000000000000000',
        amount0,
        amount1,
      };
    }

    // Calculate total token value (for display)
    const tokenValue = calculateTokenValueInQuote(
      amount0,
      amount1,
      poolPrice,
      token0IsQuote,
      token0Decimals,
      token1Decimals
    );

    // Map blockchain event type to ledger event type
    let ledgerEventType: 'INCREASE_POSITION' | 'DECREASE_POSITION' | 'COLLECT';
    if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
      ledgerEventType = 'INCREASE_POSITION';
    } else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
      ledgerEventType = 'DECREASE_POSITION';
    } else {
      ledgerEventType = 'COLLECT';
    }

    // Build event input (without inputHash - will be generated by base service)
    const eventInput: Omit<CreateUniswapV3LedgerEventInput, 'inputHash'> = {
      positionId,
      protocol: 'uniswapv3',
      previousId: previousEventId,
      timestamp: rawEvent.blockTimestamp,
      eventType: ledgerEventType,
      poolPrice,
      token0Amount: amount0,
      token1Amount: amount1,
      tokenValue,
      rewards,
      deltaCostBasis,
      costBasisAfter,
      deltaPnl,
      pnlAfter,
      config: {
        chainId: rawEvent.chainId,
        nftId: BigInt(rawEvent.tokenId),
        blockNumber: rawEvent.blockNumber,
        txIndex: rawEvent.transactionIndex,
        logIndex: rawEvent.logIndex,
        txHash: rawEvent.transactionHash,
        deltaL,
        liquidityAfter,
        feesCollected0,
        feesCollected1,
        uncollectedPrincipal0After,
        uncollectedPrincipal1After,
        sqrtPriceX96,
      },
      state,
    };

    // Generate input hash using config coordinates
    const inputHash = this.generateInputHash(eventInput as CreateUniswapV3LedgerEventInput);

    return {
      ...eventInput,
      inputHash,
    };
  }

  /**
   * Convert discovery input to raw event format
   *
   * @param input - Discovery input
   * @param chainId - Chain ID from position
   * @returns Raw event format for internal processing
   */
  private convertDiscoverInputToRawEvent(
    input: UniswapV3EventDiscoverInput,
    chainId: number
  ): RawPositionEvent {
    return {
      eventType: input.eventType,
      tokenId: input.tokenId.toString(),
      transactionHash: input.transactionHash,
      blockNumber: input.blockNumber,
      transactionIndex: input.transactionIndex,
      logIndex: input.logIndex,
      blockTimestamp: input.timestamp,
      chainId,
      liquidity: input.liquidity?.toString(),
      amount0: input.amount0.toString(),
      amount1: input.amount1.toString(),
      recipient: input.recipient,
    };
  }

  /**
   * Sort events chronologically
   *
   * Sorts by blockNumber ASC → transactionIndex ASC → logIndex ASC.
   * This ensures correct processing order for sequential state building.
   *
   * @param events - Unsorted events
   * @returns Sorted events (oldest first)
   */
  private sortEventsChronologically(events: RawPositionEvent[]): RawPositionEvent[] {
    return [...events].sort((a, b) => {
      // Compare block numbers
      if (a.blockNumber < b.blockNumber) return -1;
      if (a.blockNumber > b.blockNumber) return 1;

      // Same block: compare transaction index
      if (a.transactionIndex < b.transactionIndex) return -1;
      if (a.transactionIndex > b.transactionIndex) return 1;

      // Same transaction: compare log index
      if (a.logIndex < b.logIndex) return -1;
      if (a.logIndex > b.logIndex) return 1;

      return 0;
    });
  }
}
