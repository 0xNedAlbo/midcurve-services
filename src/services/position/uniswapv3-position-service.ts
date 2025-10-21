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
} from '@midcurve/shared';
import type { UniswapV3Pool } from '@midcurve/shared';
import type {
  UniswapV3PositionDiscoverInput,
  CreatePositionInput,
} from '../types/position/position-input.js';
import { PositionService } from './position-service.js';
import { log } from '../../logging/index.js';
import { EvmConfig } from '../../config/evm.js';
import {
  getPositionManagerAddress,
  getFactoryAddress,
  UNISWAP_V3_POSITION_MANAGER_ABI,
  UNISWAP_V3_FACTORY_ABI,
  type UniswapV3PositionData,
} from '../../config/uniswapv3.js';
import {
  isValidAddress,
  normalizeAddress,
  compareAddresses,
} from '@midcurve/shared';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { EtherscanClient } from '../../clients/etherscan/index.js';
import { UniswapV3PositionLedgerService } from '../position-ledger/uniswapv3-position-ledger-service.js';
import { UniswapV3QuoteTokenService } from '../quote-token/uniswapv3-quote-token-service.js';
import type { Address } from 'viem';
import {
  computeFeeGrowthInside,
  calculateIncrementalFees,
} from '@midcurve/shared';
import { calculatePositionValue } from '@midcurve/shared';
import { tickToPrice } from '@midcurve/shared';
import { uniswapV3PoolAbi } from '../../utils/uniswapv3/pool-abi.js';

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

  /**
   * EVM configuration for chain RPC access
   * If not provided, the singleton EvmConfig instance will be used
   */
  evmConfig?: EvmConfig;

  /**
   * UniswapV3 pool service for pool discovery
   * If not provided, a new UniswapV3PoolService instance will be created
   */
  poolService?: UniswapV3PoolService;

  /**
   * Etherscan client for fetching position events (needed for burned positions)
   * If not provided, the singleton EtherscanClient instance will be used
   */
  etherscanClient?: EtherscanClient;

  /**
   * Uniswap V3 position ledger service for fetching position history
   * If not provided, a new UniswapV3PositionLedgerService instance will be created
   */
  ledgerService?: import('../position-ledger/uniswapv3-position-ledger-service.js').UniswapV3PositionLedgerService;

  /**
   * Uniswap V3 quote token service for automatic quote token determination
   * If not provided, a new UniswapV3QuoteTokenService instance will be created
   */
  quoteTokenService?: UniswapV3QuoteTokenService;
}

/**
 * UniswapV3PositionService
 *
 * Provides position management for Uniswap V3 concentrated liquidity positions.
 * Implements serialization methods for Uniswap V3-specific config and state types.
 */
export class UniswapV3PositionService extends PositionService<'uniswapv3'> {
  private readonly _evmConfig: EvmConfig;
  private readonly _poolService: UniswapV3PoolService;
  private readonly _etherscanClient: EtherscanClient;
  private readonly _ledgerService: UniswapV3PositionLedgerService;
  private readonly _quoteTokenService: UniswapV3QuoteTokenService;

  /**
   * Creates a new UniswapV3PositionService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   * @param dependencies.evmConfig - EVM configuration instance (uses singleton if not provided)
   * @param dependencies.poolService - UniswapV3 pool service (creates default if not provided)
   * @param dependencies.etherscanClient - Etherscan client instance (uses singleton if not provided)
   * @param dependencies.ledgerService - UniswapV3 position ledger service (creates default if not provided)
   * @param dependencies.quoteTokenService - UniswapV3 quote token service (creates default if not provided)
   */
  constructor(dependencies: UniswapV3PositionServiceDependencies = {}) {
    super(dependencies);
    this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
    this._poolService =
      dependencies.poolService ??
      new UniswapV3PoolService({ prisma: this.prisma });
    this._etherscanClient =
      dependencies.etherscanClient ?? EtherscanClient.getInstance();
    this._ledgerService =
      dependencies.ledgerService ??
      new UniswapV3PositionLedgerService({
        prisma: this.prisma,
        positionService: this, // Pass self to break circular dependency
      });
    this._quoteTokenService =
      dependencies.quoteTokenService ??
      new UniswapV3QuoteTokenService({ prisma: this.prisma });
  }

  /**
   * Get the EVM configuration instance
   */
  protected get evmConfig(): EvmConfig {
    return this._evmConfig;
  }

  /**
   * Get the UniswapV3 pool service instance
   */
  protected get poolService(): UniswapV3PoolService {
    return this._poolService;
  }

  /**
   * Get the Etherscan client instance
   */
  protected get etherscanClient(): EtherscanClient {
    return this._etherscanClient;
  }

  /**
   * Get the position ledger service instance
   */
  protected get ledgerService(): UniswapV3PositionLedgerService {
    return this._ledgerService;
  }

  /**
   * Get the quote token service instance
   */
  protected get quoteTokenService(): UniswapV3QuoteTokenService {
    return this._quoteTokenService;
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
      tickUpper: number;
      tickLower: number;
    };

    return {
      chainId: db.chainId,
      nftId: db.nftId,
      poolAddress: db.poolAddress,
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
   * @param params - Discovery parameters { chainId, nftId, quoteTokenAddress? }
   * @returns The discovered or existing position
   * @throws Error if chainId is not supported
   * @throws Error if quoteTokenAddress format is invalid (when provided)
   * @throws Error if NFT doesn't exist or isn't a Uniswap V3 position
   * @throws Error if quoteTokenAddress doesn't match either pool token (when provided)
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
      quoteTokenAddress: quoteTokenAddress ?? 'auto-detect',
    });

    try {
      // 1. Check database first (optimization)
      const existing = await this.findByUserAndChainAndNftId(
        userId,
        chainId,
        nftId
      );

      if (existing) {
        this.logger.info(
          {
            id: existing.id,
            userId,
            chainId,
            nftId,
          },
          'Position already exists, skipping on-chain discovery'
        );
        log.methodExit(this.logger, 'discover', {
          id: existing.id,
          fromDatabase: true,
        });
        return existing;
      }

      // 2. Validate quoteTokenAddress IF PROVIDED
      let normalizedQuoteAddress: string | undefined;
      if (quoteTokenAddress) {
        if (!isValidAddress(quoteTokenAddress)) {
          const error = new Error(
            `Invalid quote token address format: ${quoteTokenAddress}`
          );
          log.methodError(this.logger, 'discover', error, {
            userId,
            chainId,
            nftId,
            quoteTokenAddress,
          });
          throw error;
        }

        normalizedQuoteAddress = normalizeAddress(quoteTokenAddress);
        this.logger.debug(
          { original: quoteTokenAddress, normalized: normalizedQuoteAddress },
          'Quote token address provided by caller'
        );
      } else {
        this.logger.debug('No quote token provided, will auto-detect using QuoteTokenService');
      }

      // 3. Verify chain is supported
      if (!this.evmConfig.isChainSupported(chainId)) {
        const error = new Error(
          `Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
            .getSupportedChainIds()
            .join(', ')}`
        );
        log.methodError(this.logger, 'discover', error, { chainId });
        throw error;
      }

      this.logger.debug(
        { chainId },
        'Chain is supported, proceeding with on-chain discovery'
      );

      // 4. For burned/closed positions, fetch latest event from Etherscan first
      // This gives us a block number when the position still existed
      this.logger.debug(
        { chainId, nftId },
        'Fetching position events from Etherscan to determine if position is burned'
      );

      let blockNumber: bigint | undefined;
      try {
        const events = await this.etherscanClient.fetchPositionEvents(
          chainId,
          nftId.toString()
        );

        if (events.length > 0) {
          // Get the latest event's block number (safe to use ! since we checked length)
          const latestEvent = events[events.length - 1]!;
          blockNumber = BigInt(latestEvent.blockNumber) - 1n; // Block before the last event

          this.logger.debug(
            {
              latestEventBlock: latestEvent.blockNumber,
              queryBlock: blockNumber.toString(),
              eventType: latestEvent.eventType,
            },
            'Found events - will query position state at historic block'
          );
        }
      } catch (error) {
        this.logger.warn(
          { error, chainId, nftId },
          'Failed to fetch events from Etherscan, will attempt current block query'
        );
      }

      // 5. Read position data from NonfungiblePositionManager
      const positionManagerAddress = getPositionManagerAddress(chainId);
      const client = this.evmConfig.getPublicClient(chainId);

      this.logger.debug(
        {
          positionManagerAddress,
          nftId,
          chainId,
          blockNumber: blockNumber?.toString() ?? 'latest',
        },
        'Reading position data from NonfungiblePositionManager'
      );

      const [positionData, ownerAddress] = await Promise.all([
        client.readContract({
          address: positionManagerAddress,
          abi: UNISWAP_V3_POSITION_MANAGER_ABI,
          functionName: 'positions',
          args: [BigInt(nftId)],
          blockNumber,
        }) as Promise<
          readonly [
            bigint,
            Address,
            Address,
            Address,
            number,
            number,
            number,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
          ]
        >,
        client.readContract({
          address: positionManagerAddress,
          abi: UNISWAP_V3_POSITION_MANAGER_ABI,
          functionName: 'ownerOf',
          args: [BigInt(nftId)],
          blockNumber,
        }) as Promise<Address>,
      ]);

      // Parse position data
      const position: UniswapV3PositionData = {
        nonce: positionData[0],
        operator: positionData[1],
        token0: positionData[2],
        token1: positionData[3],
        fee: positionData[4],
        tickLower: positionData[5],
        tickUpper: positionData[6],
        liquidity: positionData[7],
        feeGrowthInside0LastX128: positionData[8],
        feeGrowthInside1LastX128: positionData[9],
        tokensOwed0: positionData[10],
        tokensOwed1: positionData[11],
      };

      this.logger.debug(
        {
          token0: position.token0,
          token1: position.token1,
          fee: position.fee,
          tickLower: position.tickLower,
          tickUpper: position.tickUpper,
          liquidity: position.liquidity.toString(),
          owner: ownerAddress,
        },
        'Position data read from contract'
      );

      // 5. Compute pool address (UniswapV3 uses deterministic addressing)
      // For now, we'll discover the pool from token addresses and fee
      // Note: In production, you'd compute the pool address deterministically
      // using the factory address and CREATE2
      const poolAddress = await this.computePoolAddress(
        chainId,
        position.token0,
        position.token1,
        position.fee
      );

      this.logger.debug(
        { poolAddress, token0: position.token0, token1: position.token1, fee: position.fee },
        'Pool address computed/discovered'
      );

      // 6. Discover pool via UniswapV3PoolService
      const pool = await this.poolService.discover({
        poolAddress,
        chainId,
      });

      this.logger.debug(
        {
          poolId: pool.id,
          token0: pool.token0.symbol,
          token1: pool.token1.symbol,
        },
        'Pool discovered/fetched'
      );

      // 7. Determine quote token
      let isToken0Quote: boolean;

      if (normalizedQuoteAddress) {
        // EXPLICIT MODE: User provided quoteTokenAddress
        const token0Matches =
          compareAddresses(pool.token0.config.address, normalizedQuoteAddress) === 0;
        const token1Matches =
          compareAddresses(pool.token1.config.address, normalizedQuoteAddress) === 0;

        if (!token0Matches && !token1Matches) {
          const error = new Error(
            `Quote token address ${normalizedQuoteAddress} does not match either pool token. ` +
              `Pool token0: ${pool.token0.config.address}, token1: ${pool.token1.config.address}`
          );
          log.methodError(this.logger, 'discover', error, {
            userId,
            chainId,
            nftId,
            quoteTokenAddress: normalizedQuoteAddress,
            poolToken0: pool.token0.config.address,
            poolToken1: pool.token1.config.address,
          });
          throw error;
        }

        isToken0Quote = token0Matches;

        this.logger.debug(
          {
            isToken0Quote,
            quoteToken: isToken0Quote ? pool.token0.symbol : pool.token1.symbol,
          },
          'Quote token determined from caller input'
        );
      } else {
        // AUTO-DETECT MODE: Use QuoteTokenService
        this.logger.debug('Auto-detecting quote token using QuoteTokenService');

        const quoteResult = await this.quoteTokenService.determineQuoteToken({
          userId,
          chainId,
          token0Address: pool.token0.config.address,
          token1Address: pool.token1.config.address,
        });

        isToken0Quote = quoteResult.isToken0Quote;

        this.logger.debug(
          {
            isToken0Quote,
            quoteToken: isToken0Quote ? pool.token0.symbol : pool.token1.symbol,
            matchedBy: quoteResult.matchedBy,
          },
          'Quote token auto-detected'
        );
      }

      const baseToken = isToken0Quote ? pool.token1 : pool.token0;
      const quoteToken = isToken0Quote ? pool.token0 : pool.token1;

      this.logger.debug(
        {
          isToken0Quote,
          baseToken: baseToken.symbol,
          quoteToken: quoteToken.symbol,
        },
        'Token roles determined'
      );

      // 8. Create position config (without token0IsQuote, now at position level)
      const config: UniswapV3PositionConfig = {
        chainId,
        nftId,
        poolAddress,
        tickUpper: position.tickUpper,
        tickLower: position.tickLower,
      };

      // 9. Create position state from on-chain data
      const state: UniswapV3PositionState = {
        ownerAddress: normalizeAddress(ownerAddress),
        liquidity: position.liquidity,
        feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
        tokensOwed0: position.tokensOwed0,
        tokensOwed1: position.tokensOwed1,
      };

      this.logger.debug(
        {
          ownerAddress: state.ownerAddress,
          liquidity: state.liquidity.toString(),
          tokensOwed0: state.tokensOwed0.toString(),
          tokensOwed1: state.tokensOwed1.toString(),
        },
        'Position state initialized from on-chain data'
      );

      // 10. Create position via create() method
      const createdPosition = await this.create({
        protocol: 'uniswapv3',
        positionType: 'CL_TICKS',
        userId,
        poolId: pool.id,
        isToken0Quote,  // Boolean flag for token roles
        config,
        state,
      });

      this.logger.info(
        {
          id: createdPosition.id,
          userId,
          chainId,
          nftId,
          poolId: pool.id,
          baseToken: baseToken.symbol,
          quoteToken: quoteToken.symbol,
        },
        'Position discovered and created'
      );

      // 11. Calculate and update common fields
      try {
        this.logger.debug(
          { positionId: createdPosition.id },
          'Calculating position common fields'
        );

        // Get ledger summary (cost basis, realized PnL, fees)
        const ledgerSummary = await this.getLedgerSummary(createdPosition.id);

        // Calculate current position value
        const currentValue = this.calculateCurrentPositionValue(
          createdPosition,
          pool
        );

        // Calculate unrealized PnL
        const unrealizedPnl = currentValue - ledgerSummary.costBasis;

        // Calculate unclaimed fees
        const unClaimedFees = await this.calculateUnclaimedFees(
          createdPosition,
          pool
        );

        // Calculate price range
        const { priceRangeLower, priceRangeUpper } = this.calculatePriceRange(
          createdPosition,
          pool
        );

        // Update position with calculated fields
        await this.updatePositionCommonFields(createdPosition.id, {
          currentValue,
          currentCostBasis: ledgerSummary.costBasis,
          realizedPnl: ledgerSummary.realizedPnl,
          unrealizedPnl,
          collectedFees: ledgerSummary.collectedFees,
          unClaimedFees,
          lastFeesCollectedAt: ledgerSummary.lastFeesCollectedAt.getTime() === 0
            ? createdPosition.positionOpenedAt
            : ledgerSummary.lastFeesCollectedAt,
          priceRangeLower,
          priceRangeUpper,
        });

        this.logger.info(
          {
            positionId: createdPosition.id,
            currentValue: currentValue.toString(),
            costBasis: ledgerSummary.costBasis.toString(),
            unrealizedPnl: unrealizedPnl.toString(),
          },
          'Position common fields calculated and updated'
        );
      } catch (error) {
        // Clean up orphaned position before re-throwing
        this.logger.error(
          {
            error,
            positionId: createdPosition.id,
          },
          'Failed to calculate/update common fields, deleting orphaned position'
        );
        await this.delete(createdPosition.id);
        throw error;
      }

      log.methodExit(this.logger, 'discover', {
        id: createdPosition.id,
        fromDatabase: false,
      });

      // Re-fetch position with updated fields
      const finalPosition = await this.findById(createdPosition.id);
      return finalPosition ?? createdPosition;
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          (error.message.includes('Invalid') ||
            error.message.includes('Chain') ||
            error.message.includes('Quote token'))
        )
      ) {
        log.methodError(this.logger, 'discover', error as Error, {
          userId,
          chainId,
          nftId,
          quoteTokenAddress,
        });
      }
      throw error;
    }
  }

  /**
   * Query the pool address for a given token pair and fee from the factory contract
   *
   * Uses the UniswapV3 Factory's getPool() function to retrieve the pool address.
   * The factory returns the zero address if no pool exists for the given parameters.
   *
   * @param chainId - Chain ID
   * @param token0 - Address of token0
   * @param token1 - Address of token1
   * @param fee - Fee tier in basis points
   * @returns Pool address
   * @throws Error if pool doesn't exist (factory returns zero address)
   * @private
   */
  private async computePoolAddress(
    chainId: number,
    token0: Address,
    token1: Address,
    fee: number
  ): Promise<string> {
    const factoryAddress = getFactoryAddress(chainId);
    const client = this.evmConfig.getPublicClient(chainId);

    this.logger.debug(
      { factoryAddress, token0, token1, fee, chainId },
      'Querying factory for pool address'
    );

    const poolAddress = (await client.readContract({
      address: factoryAddress,
      abi: UNISWAP_V3_FACTORY_ABI,
      functionName: 'getPool',
      args: [token0, token1, fee],
    })) as Address;

    // Check if pool exists (factory returns zero address if pool doesn't exist)
    const zeroAddress = '0x0000000000000000000000000000000000000000';
    if (
      poolAddress.toLowerCase() === zeroAddress.toLowerCase() ||
      poolAddress === zeroAddress
    ) {
      throw new Error(
        `Pool does not exist for token0=${token0}, token1=${token1}, fee=${fee} on chain ${chainId}`
      );
    }

    this.logger.debug(
      { poolAddress, token0, token1, fee },
      'Pool address retrieved from factory'
    );

    return normalizeAddress(poolAddress);
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
   *
   * Note: Config fields (chainId, nftId, ticks, poolAddress) are immutable and not updated.
   * Note: PnL fields and fees are NOT recalculated in this implementation.
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

    try {
      // 1. Get existing position to verify it exists and get config
      const existingPosition = await this.findById(id);

      if (!existingPosition) {
        const error = new Error(`Position not found: ${id}`);
        log.methodError(this.logger, 'refresh', error, { id });
        throw error;
      }

      this.logger.debug(
        {
          id,
          chainId: existingPosition.config.chainId,
          nftId: existingPosition.config.nftId,
        },
        'Position found, proceeding with state refresh'
      );

      const { chainId, nftId } = existingPosition.config;

      // 2. Verify chain is supported
      if (!this.evmConfig.isChainSupported(chainId)) {
        const error = new Error(
          `Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
            .getSupportedChainIds()
            .join(', ')}`
        );
        log.methodError(this.logger, 'refresh', error, { id, chainId });
        throw error;
      }

      this.logger.debug(
        { id, chainId },
        'Chain is supported, proceeding with on-chain state read'
      );

      // 3. Read fresh state from NonfungiblePositionManager contract
      const positionManagerAddress = getPositionManagerAddress(chainId);
      const client = this.evmConfig.getPublicClient(chainId);

      this.logger.debug(
        { id, positionManagerAddress, nftId, chainId },
        'Reading fresh position state from NonfungiblePositionManager'
      );

      const [positionData, ownerAddress] = await Promise.all([
        client.readContract({
          address: positionManagerAddress,
          abi: UNISWAP_V3_POSITION_MANAGER_ABI,
          functionName: 'positions',
          args: [BigInt(nftId)],
        }) as Promise<
          readonly [
            bigint,
            Address,
            Address,
            Address,
            number,
            number,
            number,
            bigint,
            bigint,
            bigint,
            bigint,
            bigint,
          ]
        >,
        client.readContract({
          address: positionManagerAddress,
          abi: UNISWAP_V3_POSITION_MANAGER_ABI,
          functionName: 'ownerOf',
          args: [BigInt(nftId)],
        }) as Promise<Address>,
      ]);

      // Parse position data
      const position: UniswapV3PositionData = {
        nonce: positionData[0],
        operator: positionData[1],
        token0: positionData[2],
        token1: positionData[3],
        fee: positionData[4],
        tickLower: positionData[5],
        tickUpper: positionData[6],
        liquidity: positionData[7],
        feeGrowthInside0LastX128: positionData[8],
        feeGrowthInside1LastX128: positionData[9],
        tokensOwed0: positionData[10],
        tokensOwed1: positionData[11],
      };

      this.logger.debug(
        {
          id,
          liquidity: position.liquidity.toString(),
          tokensOwed0: position.tokensOwed0.toString(),
          tokensOwed1: position.tokensOwed1.toString(),
          owner: ownerAddress,
        },
        'Fresh position state read from contract'
      );

      // 4. Create updated state object
      const updatedState: UniswapV3PositionState = {
        ownerAddress: normalizeAddress(ownerAddress),
        liquidity: position.liquidity,
        feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
        feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
        tokensOwed0: position.tokensOwed0,
        tokensOwed1: position.tokensOwed1,
      };

      this.logger.debug(
        {
          id,
          ownerAddress: updatedState.ownerAddress,
          liquidity: updatedState.liquidity.toString(),
        },
        'Updated state object created from on-chain data'
      );

      // 5. Update database with new state
      const stateDB = this.serializeState(updatedState);

      log.dbOperation(this.logger, 'update', 'Position', {
        id,
        fields: ['state'],
      });

      const result = await this.prisma.position.update({
        where: { id },
        data: {
          state: stateDB as object,
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

      // 6. Map database result to Position type
      const refreshedPosition = this.mapToPosition(result as any) as UniswapV3Position;

      this.logger.info(
        {
          id,
          chainId,
          nftId,
          liquidity: updatedState.liquidity.toString(),
        },
        'Position state refreshed successfully'
      );

      // 7. Recalculate and update common fields
      this.logger.debug({ positionId: id }, 'Recalculating position common fields');

      // Use embedded pool object from position
      const pool = refreshedPosition.pool;

      // Get ledger summary (cost basis, realized PnL, fees)
      const ledgerSummary = await this.getLedgerSummary(id);

      // Calculate current position value with refreshed state
      const currentValue = this.calculateCurrentPositionValue(
        refreshedPosition,
        pool
      );

      // Calculate unrealized PnL
      const unrealizedPnl = currentValue - ledgerSummary.costBasis;

      // Calculate unclaimed fees with refreshed state
      const unClaimedFees = await this.calculateUnclaimedFees(
        refreshedPosition,
        pool
      );

      // Price range is immutable, but recalculate for completeness
      const { priceRangeLower, priceRangeUpper } = this.calculatePriceRange(
        refreshedPosition,
        pool
      );

      // Update position with recalculated fields
      await this.updatePositionCommonFields(id, {
        currentValue,
        currentCostBasis: ledgerSummary.costBasis,
        realizedPnl: ledgerSummary.realizedPnl,
        unrealizedPnl,
        collectedFees: ledgerSummary.collectedFees,
        unClaimedFees,
        lastFeesCollectedAt: ledgerSummary.lastFeesCollectedAt.getTime() === 0
          ? refreshedPosition.positionOpenedAt
          : ledgerSummary.lastFeesCollectedAt,
        priceRangeLower,
        priceRangeUpper,
      });

      this.logger.info(
        {
          positionId: id,
          currentValue: currentValue.toString(),
          unrealizedPnl: unrealizedPnl.toString(),
          unClaimedFees: unClaimedFees.toString(),
        },
        'Position common fields recalculated and updated'
      );

      log.methodExit(this.logger, 'refresh', { id });

      // Re-fetch position with updated fields
      const finalPosition = await this.findById(id);
      return finalPosition ?? refreshedPosition;
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          (error.message.includes('not found') ||
            error.message.includes('Chain'))
        )
      ) {
        log.methodError(this.logger, 'refresh', error as Error, { id });
      }
      throw error;
    }
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
  // HELPER METHODS - FINANCIAL CALCULATIONS
  // ============================================================================

  /**
   * Get ledger summary for a position
   *
   * Fetches the latest ledger event and extracts financial summary data.
   *
   * @param positionId - Position database ID
   * @returns Summary object with cost basis, PnL, and fee data
   */
  private async getLedgerSummary(positionId: string): Promise<{
    costBasis: bigint;
    realizedPnl: bigint;
    collectedFees: bigint;
    lastFeesCollectedAt: Date;
  }> {
    try {
      // Fetch all ledger events (sorted descending by timestamp)
      const events = await this.ledgerService.findAllItems(positionId);

      if (events.length === 0) {
        // No events yet - position just created
        return {
          costBasis: 0n,
          realizedPnl: 0n,
          collectedFees: 0n,
          lastFeesCollectedAt: new Date(), // Will be set to positionOpenedAt by caller
        };
      }

      // Latest event is first (descending order) - safe to use ! since we checked length
      const latestEvent = events[0]!;

      // Sum all COLLECT event rewards for collected fees
      let collectedFees = 0n;
      let lastFeesCollectedAt: Date | null = null;

      for (const event of events) {
        if (event.eventType === 'COLLECT' && event.rewards.length > 0) {
          // Sum up all reward values (already in quote token)
          for (const reward of event.rewards) {
            collectedFees += reward.tokenValue;
          }
          // Track most recent collection timestamp
          if (!lastFeesCollectedAt || event.timestamp > lastFeesCollectedAt) {
            lastFeesCollectedAt = event.timestamp;
          }
        }
      }

      return {
        costBasis: latestEvent.costBasisAfter,
        realizedPnl: latestEvent.pnlAfter,
        collectedFees,
        lastFeesCollectedAt: lastFeesCollectedAt ?? new Date(),
      };
    } catch (error) {
      this.logger.warn(
        { error, positionId },
        'Failed to get ledger summary, using defaults'
      );
      return {
        costBasis: 0n,
        realizedPnl: 0n,
        collectedFees: 0n,
        lastFeesCollectedAt: new Date(),
      };
    }
  }

  /**
   * Calculate unclaimed fees for a position
   *
   * Reads tick data from pool contract and calculates fee growth inside the position range.
   *
   * @param position - Position object with config and state
   * @param pool - Pool object with current state
   * @returns Unclaimed fees in quote token value
   */
  private async calculateUnclaimedFees(
    position: UniswapV3Position,
    pool: UniswapV3Pool
  ): Promise<bigint> {
    try {
      const { chainId, poolAddress, tickLower, tickUpper } = position.config;
      const { liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128 } = position.state;

      // If no liquidity, no fees
      if (liquidity === 0n) {
        return 0n;
      }

      const client = this.evmConfig.getPublicClient(chainId);

      // Read pool global fee growth and tick data
      const [feeGrowthGlobal0X128, feeGrowthGlobal1X128, tickDataLower, tickDataUpper] =
        await Promise.all([
          client.readContract({
            address: poolAddress as Address,
            abi: uniswapV3PoolAbi,
            functionName: 'feeGrowthGlobal0X128',
          }) as Promise<bigint>,
          client.readContract({
            address: poolAddress as Address,
            abi: uniswapV3PoolAbi,
            functionName: 'feeGrowthGlobal1X128',
          }) as Promise<bigint>,
          client.readContract({
            address: poolAddress as Address,
            abi: uniswapV3PoolAbi,
            functionName: 'ticks',
            args: [tickLower],
          }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]>,
          client.readContract({
            address: poolAddress as Address,
            abi: uniswapV3PoolAbi,
            functionName: 'ticks',
            args: [tickUpper],
          }) as Promise<readonly [bigint, bigint, bigint, bigint, bigint, bigint, number, boolean]>,
        ]);

      // Extract feeGrowthOutside from tick data
      const feeGrowthOutsideLower0X128 = tickDataLower[2];
      const feeGrowthOutsideLower1X128 = tickDataLower[3];
      const feeGrowthOutsideUpper0X128 = tickDataUpper[2];
      const feeGrowthOutsideUpper1X128 = tickDataUpper[3];

      // Calculate fee growth inside using pool's current tick
      const feeGrowthInside = computeFeeGrowthInside(
        pool.state.currentTick,
        tickLower,
        tickUpper,
        feeGrowthGlobal0X128,
        feeGrowthGlobal1X128,
        feeGrowthOutsideLower0X128,
        feeGrowthOutsideLower1X128,
        feeGrowthOutsideUpper0X128,
        feeGrowthOutsideUpper1X128
      );

      // Calculate incremental fees (fees earned since last checkpoint)
      const incremental0 = calculateIncrementalFees(
        feeGrowthInside.inside0,
        feeGrowthInside0LastX128,
        liquidity
      );
      const incremental1 = calculateIncrementalFees(
        feeGrowthInside.inside1,
        feeGrowthInside1LastX128,
        liquidity
      );

      // Convert to quote token value
      const token0Decimals = pool.token0.decimals;
      const token1Decimals = pool.token1.decimals;
      const sqrtPriceX96 = pool.state.sqrtPriceX96;

      // Calculate value based on token roles
      let unclaimedFeesValue: bigint;
      if (position.isToken0Quote) {
        // token0 = quote, token1 = base
        // Value = fee0 + (fee1 * price)
        // price = token0 per token1 = Q192 / (sqrtPriceX96^2)
        const fee1InToken0 = (incremental1 * (2n ** 192n)) / (sqrtPriceX96 * sqrtPriceX96);
        // Adjust for decimals: fee1InToken0 is in token0 units, need to scale by decimal difference
        const decimalDiff = token1Decimals - token0Decimals;
        const fee1Adjusted = decimalDiff >= 0
          ? fee1InToken0 / (10n ** BigInt(Math.abs(decimalDiff)))
          : fee1InToken0 * (10n ** BigInt(Math.abs(decimalDiff)));
        unclaimedFeesValue = incremental0 + fee1Adjusted;
      } else {
        // token0 = base, token1 = quote
        // Value = (fee0 * price) + fee1
        // price = token1 per token0 = (sqrtPriceX96^2) / Q192
        const fee0InToken1 = (incremental0 * sqrtPriceX96 * sqrtPriceX96) / (2n ** 192n);
        // Adjust for decimals
        const decimalDiff = token0Decimals - token1Decimals;
        const fee0Adjusted = decimalDiff >= 0
          ? fee0InToken1 / (10n ** BigInt(Math.abs(decimalDiff)))
          : fee0InToken1 * (10n ** BigInt(Math.abs(decimalDiff)));
        unclaimedFeesValue = fee0Adjusted + incremental1;
      }

      return unclaimedFeesValue;
    } catch (error) {
      this.logger.warn(
        { error, positionId: position.id },
        'Failed to calculate unclaimed fees, using 0'
      );
      return 0n;
    }
  }

  /**
   * Calculate current position value
   *
   * Uses liquidity utility to calculate token amounts and convert to quote value.
   *
   * @param position - Position object with config and state
   * @param pool - Pool object with current state
   * @returns Current position value in quote token units
   */
  private calculateCurrentPositionValue(
    position: UniswapV3Position,
    pool: UniswapV3Pool
  ): bigint {
    const { tickLower, tickUpper } = position.config;
    const { liquidity } = position.state;
    const { sqrtPriceX96 } = pool.state;

    if (liquidity === 0n) {
      return 0n;
    }

    // Determine token roles
    const baseToken = position.isToken0Quote ? pool.token1 : pool.token0;
    const quoteToken = position.isToken0Quote ? pool.token0 : pool.token1;
    const baseIsToken0 = !position.isToken0Quote;

    // Calculate current pool price (quote per base)
    let currentPrice: bigint;
    const quoteDecimals = BigInt(quoteToken.decimals);
    const baseDecimals = BigInt(baseToken.decimals);

    if (position.isToken0Quote) {
      // token0 = quote, token1 = base
      // price = token0 per token1 = Q192 / (sqrtPriceX96^2)
      currentPrice = (2n ** 192n) / (sqrtPriceX96 * sqrtPriceX96);
      // Scale to quote decimals
      currentPrice = (currentPrice * (10n ** quoteDecimals)) / (10n ** baseDecimals);
    } else {
      // token0 = base, token1 = quote
      // price = token1 per token0 = (sqrtPriceX96^2) / Q192
      currentPrice = (sqrtPriceX96 * sqrtPriceX96) / (2n ** 192n);
      // Scale to quote decimals
      currentPrice = (currentPrice * (10n ** quoteDecimals)) / (10n ** baseDecimals);
    }

    // Calculate position value using utility function
    const positionValue = calculatePositionValue(
      liquidity,
      sqrtPriceX96,
      tickLower,
      tickUpper,
      currentPrice,
      baseIsToken0,
      baseToken.decimals
    );

    return positionValue;
  }

  /**
   * Calculate price range bounds
   *
   * Converts tick bounds to prices in quote token.
   *
   * @param position - Position object with config
   * @param pool - Pool object with token data
   * @returns Price range lower and upper bounds in quote token
   */
  private calculatePriceRange(
    position: UniswapV3Position,
    pool: UniswapV3Pool
  ): { priceRangeLower: bigint; priceRangeUpper: bigint } {
    const { tickLower, tickUpper } = position.config;

    // Determine token addresses and decimals based on token roles
    const baseToken = position.isToken0Quote ? pool.token1 : pool.token0;
    const quoteToken = position.isToken0Quote ? pool.token0 : pool.token1;
    const baseTokenAddress = baseToken.config.address;
    const quoteTokenAddress = quoteToken.config.address;
    const baseTokenDecimals = baseToken.decimals;

    // Convert ticks to prices (quote per base)
    const priceRangeLower = tickToPrice(
      tickLower,
      baseTokenAddress,
      quoteTokenAddress,
      baseTokenDecimals
    );

    const priceRangeUpper = tickToPrice(
      tickUpper,
      baseTokenAddress,
      quoteTokenAddress,
      baseTokenDecimals
    );

    return { priceRangeLower, priceRangeUpper };
  }

  /**
   * Update position common fields in database
   *
   * Updates all financial and metadata fields for a position.
   *
   * @param positionId - Position database ID
   * @param fields - Fields to update
   */
  private async updatePositionCommonFields(
    positionId: string,
    fields: {
      currentValue: bigint;
      currentCostBasis: bigint;
      realizedPnl: bigint;
      unrealizedPnl: bigint;
      collectedFees: bigint;
      unClaimedFees: bigint;
      lastFeesCollectedAt: Date;
      priceRangeLower: bigint;
      priceRangeUpper: bigint;
    }
  ): Promise<void> {
    log.dbOperation(this.logger, 'update', 'Position', {
      id: positionId,
      fields: ['currentValue', 'currentCostBasis', 'realizedPnl', 'unrealizedPnl', 'collectedFees', 'unClaimedFees', 'lastFeesCollectedAt', 'priceRangeLower', 'priceRangeUpper'],
    });

    await this.prisma.position.update({
      where: { id: positionId },
      data: {
        currentValue: fields.currentValue.toString(),
        currentCostBasis: fields.currentCostBasis.toString(),
        realizedPnl: fields.realizedPnl.toString(),
        unrealizedPnl: fields.unrealizedPnl.toString(),
        collectedFees: fields.collectedFees.toString(),
        unClaimedFees: fields.unClaimedFees.toString(),
        lastFeesCollectedAt: fields.lastFeesCollectedAt,
        priceRangeLower: fields.priceRangeLower.toString(),
        priceRangeUpper: fields.priceRangeUpper.toString(),
      },
    });

    this.logger.debug(
      {
        positionId,
        currentValue: fields.currentValue.toString(),
        currentCostBasis: fields.currentCostBasis.toString(),
        unrealizedPnl: fields.unrealizedPnl.toString(),
      },
      'Position common fields updated'
    );
  }

  // ============================================================================
  // HELPER METHODS - POSITION LOOKUP
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

  // ============================================================================
  // PUBLIC QUERY METHODS
  // ============================================================================

  /**
   * Find many positions with filtering and pagination
   *
   * Uniswap V3 implementation of abstract findMany() method.
   *
   * Query positions for a specific user with optional filters:
   * - Chain ID filter (from config JSON field) - Uniswap V3 specific
   * - Status filter (active/closed/all) - Common filter
   * - Pagination (limit, offset) - Common filter
   *
   * @param userId - User ID who owns the positions
   * @param options - Query options
   * @param options.chainId - Optional chain ID filter (Uniswap V3 specific: 1, 42161, 8453, etc.)
   * @param options.status - Status filter: 'active', 'closed', or 'all' (default: 'all')
   * @param options.limit - Number of results to return (default: 20, max: 100)
   * @param options.offset - Number of results to skip (default: 0)
   * @returns Object containing positions array and total count
   */
  override async findMany(
    userId: string,
    options: {
      chainId?: number;
      status?: 'active' | 'closed' | 'all';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ positions: UniswapV3Position[]; total: number }> {
    const { chainId, status = 'all', limit = 20, offset = 0 } = options;

    log.methodEntry(this.logger, 'findMany', {
      userId,
      chainId,
      status,
      limit,
      offset,
    });

    try {
      // Build where clause
      const where: any = {
        protocol: 'uniswapv3',
        userId,
      };

      // Add status filter (maps to isActive field)
      if (status === 'active') {
        where.isActive = true;
      } else if (status === 'closed') {
        where.isActive = false;
      }
      // For 'all', don't add isActive filter

      // Add chainId filter (JSON field query)
      if (chainId !== undefined) {
        where.config = {
          path: ['chainId'],
          equals: chainId,
        };
      }

      log.dbOperation(this.logger, 'findMany', 'Position', {
        where,
        limit,
        offset,
      });

      // Execute queries in parallel
      const [results, total] = await Promise.all([
        this.prisma.position.findMany({
          where,
          include: {
            pool: {
              include: {
                token0: true,
                token1: true,
              },
            },
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: limit,
          skip: offset,
        }),
        this.prisma.position.count({ where }),
      ]);

      // Map results to UniswapV3Position type
      const positions = results.map((result) =>
        this.mapToPosition(result as any)
      ) as UniswapV3Position[];

      this.logger.info(
        {
          userId,
          chainId,
          status,
          count: positions.length,
          total,
          limit,
          offset,
        },
        'Positions retrieved'
      );

      log.methodExit(this.logger, 'findMany', {
        count: positions.length,
        total,
      });

      return { positions, total };
    } catch (error) {
      log.methodError(this.logger, 'findMany', error as Error, {
        userId,
        chainId,
        status,
        limit,
        offset,
      });
      throw error;
    }
  }
}
