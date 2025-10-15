/**
 * UniswapV3PoolService
 *
 * Specialized service for Uniswap V3 pool management.
 * Handles address validation, normalization, bigint conversion, and duplicate prevention.
 */

import { PrismaClient } from '@prisma/client';
import type { Pool } from '../../shared/types/pool.js';
import type { UniswapV3Pool } from '../../shared/types/uniswapv3/pool.js';
import type {
  UniswapV3PoolConfig,
  UniswapV3PoolState,
} from '../../shared/types/uniswapv3/pool.js';
import type { Erc20Token, Erc20TokenConfig, TokenConfig } from '../../shared/types/token-config.js';
import type { CreatePoolInput, UpdatePoolStateInput } from '../types/pool/pool-input.js';
import {
  toPoolState,
  toPoolStateDB,
  type UniswapV3PoolStateDB,
} from '../types/uniswapv3/pool-db.js';
import {
  isValidAddress,
  normalizeAddress,
} from '../../utils/evm/index.js';
import { PoolService } from './pool-service.js';
import { createServiceLogger, log } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * Dependencies for UniswapV3PoolService
 * All dependencies are optional and will use defaults if not provided
 */
export interface UniswapV3PoolServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * UniswapV3PoolService
 *
 * Provides CRUD operations for Uniswap V3 pool management.
 * Validates and normalizes addresses, handles bigint conversion, prevents duplicate pools.
 */
export class UniswapV3PoolService {
  private readonly poolService: PoolService;
  private readonly _prisma: PrismaClient;
  private readonly logger: ServiceLogger;

  /**
   * Creates a new UniswapV3PoolService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: UniswapV3PoolServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this.poolService = new PoolService({ prisma: this._prisma });
    this.logger = createServiceLogger('UniswapV3PoolService');
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
  }

  /**
   * Map Pool to UniswapV3Pool with bigint conversion
   *
   * Accepts Pool type (from PoolService) and converts state from DB format to application format
   */
  private mapToUniswapV3Pool(pool: Pool<unknown, unknown, TokenConfig> & {
    token0: Erc20Token;
    token1: Erc20Token;
  }): UniswapV3Pool {
    // Safeguard: Verify pool protocol
    if (pool.protocol !== 'uniswapv3') {
      throw new Error(
        `Pool ${pool.id} is not a Uniswap V3 pool (protocol: ${pool.protocol})`
      );
    }

    // Convert state from DB format (string) to application format (bigint)
    const stateDB = pool.state as UniswapV3PoolStateDB;
    const state = toPoolState(stateDB);

    return {
      id: pool.id,
      createdAt: pool.createdAt,
      updatedAt: pool.updatedAt,
      protocol: pool.protocol as UniswapV3Pool['protocol'],
      poolType: pool.poolType as UniswapV3Pool['poolType'],
      token0: pool.token0,
      token1: pool.token1,
      feeBps: pool.feeBps,
      config: pool.config as UniswapV3PoolConfig,
      state,
    };
  }

  /**
   * Create a new Uniswap V3 pool or return existing one
   *
   * Validates and normalizes pool and token addresses to EIP-55 checksum format.
   * Checks if a pool with the same address and chainId already exists.
   * If it exists, returns the existing pool. Otherwise, creates a new one.
   *
   * @param input - Uniswap V3 pool data to create (omits id, createdAt, updatedAt)
   * @returns The created or existing pool with all fields populated
   * @throws Error if any address format is invalid
   * @throws Error if tokens are not ERC-20 type
   * @throws Error if token0 >= token1 (violates Uniswap V3 convention)
   */
  async create(
    input: CreatePoolInput<UniswapV3PoolConfig, UniswapV3PoolState, Erc20TokenConfig>
  ): Promise<UniswapV3Pool> {
    log.methodEntry(this.logger, 'create', {
      address: input.config.address,
      chainId: input.config.chainId,
      feeBps: input.feeBps,
    });

    try {
      // Validate pool address format
      if (!isValidAddress(input.config.address)) {
        const error = new Error(
          `Invalid pool address format: ${input.config.address}`
        );
        log.methodError(this.logger, 'create', error, {
          address: input.config.address,
        });
        throw error;
      }

      // Validate token addresses
      if (!isValidAddress(input.config.token0)) {
        const error = new Error(
          `Invalid token0 address format: ${input.config.token0}`
        );
        log.methodError(this.logger, 'create', error, {
          token0: input.config.token0,
        });
        throw error;
      }

      if (!isValidAddress(input.config.token1)) {
        const error = new Error(
          `Invalid token1 address format: ${input.config.token1}`
        );
        log.methodError(this.logger, 'create', error, {
          token1: input.config.token1,
        });
        throw error;
      }

      // Normalize addresses to EIP-55 checksum format
      const normalizedPoolAddress = normalizeAddress(input.config.address);
      const normalizedToken0Address = normalizeAddress(input.config.token0);
      const normalizedToken1Address = normalizeAddress(input.config.token1);

      this.logger.debug(
        {
          originalPool: input.config.address,
          normalizedPool: normalizedPoolAddress,
          originalToken0: input.config.token0,
          normalizedToken0: normalizedToken0Address,
          originalToken1: input.config.token1,
          normalizedToken1: normalizedToken1Address,
        },
        'Addresses normalized'
      );

      // Verify token ordering (token0 < token1)
      if (normalizedToken0Address >= normalizedToken1Address) {
        const error = new Error(
          `Invalid token ordering: token0 (${normalizedToken0Address}) must be < token1 (${normalizedToken1Address})`
        );
        log.methodError(this.logger, 'create', error, {
          token0: normalizedToken0Address,
          token1: normalizedToken1Address,
        });
        throw error;
      }

      // Check if pool already exists with same address and chainId
      log.dbOperation(this.logger, 'findFirst', 'Pool', {
        address: normalizedPoolAddress,
        chainId: input.config.chainId,
      });

      const existing = await this.prisma.pool.findFirst({
        where: {
          protocol: 'uniswapv3',
          config: {
            path: ['address'],
            equals: normalizedPoolAddress,
          },
          AND: {
            config: {
              path: ['chainId'],
              equals: input.config.chainId,
            },
          },
        },
        include: {
          token0: true,
          token1: true,
        },
      });

      // If pool exists, return it
      if (existing) {
        this.logger.warn(
          {
            id: existing.id,
            address: normalizedPoolAddress,
            chainId: input.config.chainId,
            feeBps: existing.feeBps,
          },
          'Pool already exists, returning existing pool'
        );
        log.methodExit(this.logger, 'create', { id: existing.id, duplicate: true });
        return this.mapToUniswapV3Pool(existing as unknown as Pool<unknown, unknown, TokenConfig> & {
          token0: Erc20Token;
          token1: Erc20Token;
        });
      }

      // Verify tokens are ERC-20 type (PoolService only checks existence)
      log.dbOperation(this.logger, 'findUnique', 'Token', {
        id: input.token0.id,
      });
      const token0Exists = await this.prisma.token.findUnique({
        where: { id: input.token0.id },
      });

      if (token0Exists && token0Exists.tokenType !== 'evm-erc20') {
        const error = new Error(
          `Token ${input.token0.id} is not an ERC-20 token (type: ${token0Exists.tokenType})`
        );
        log.methodError(this.logger, 'create', error, {
          token0Id: input.token0.id,
          tokenType: token0Exists.tokenType,
        });
        throw error;
      }

      log.dbOperation(this.logger, 'findUnique', 'Token', {
        id: input.token1.id,
      });
      const token1Exists = await this.prisma.token.findUnique({
        where: { id: input.token1.id },
      });

      if (token1Exists && token1Exists.tokenType !== 'evm-erc20') {
        const error = new Error(
          `Token ${input.token1.id} is not an ERC-20 token (type: ${token1Exists.tokenType})`
        );
        log.methodError(this.logger, 'create', error, {
          token1Id: input.token1.id,
          tokenType: token1Exists.tokenType,
        });
        throw error;
      }

      // Convert state from bigint to string for database storage
      const stateDB = toPoolStateDB(input.state);

      // Create new pool with normalized addresses and converted state
      // Delegate to PoolService which handles token existence validation and pool creation
      const normalizedInput: CreatePoolInput<
        UniswapV3PoolConfig,
        UniswapV3PoolStateDB,
        Erc20TokenConfig
      > = {
        ...input,
        config: {
          ...input.config,
          address: normalizedPoolAddress,
          token0: normalizedToken0Address,
          token1: normalizedToken1Address,
        },
        state: stateDB,
      };

      const result = await this.poolService.create(normalizedInput);

      // Convert state back from string to bigint
      const pool = this.mapToUniswapV3Pool(result as typeof result & {
        token0: Erc20Token;
        token1: Erc20Token;
      });

      this.logger.info(
        {
          id: pool.id,
          address: normalizedPoolAddress,
          chainId: input.config.chainId,
          token0Symbol: pool.token0.symbol,
          token1Symbol: pool.token1.symbol,
          feeBps: pool.feeBps,
        },
        'Uniswap V3 pool created successfully'
      );

      log.methodExit(this.logger, 'create', { id: pool.id });
      return pool;
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          (error.message.includes('Invalid') ||
            error.message.includes('not found') ||
            error.message.includes('not an ERC-20 token'))
        )
      ) {
        log.methodError(this.logger, 'create', error as Error, {
          address: input.config.address,
          chainId: input.config.chainId,
        });
      }
      throw error;
    }
  }

  /**
   * Find a Uniswap V3 pool by address and chain ID
   *
   * @param address - Pool contract address (will be normalized)
   * @param chainId - Chain ID
   * @returns The pool if found, null otherwise
   * @throws Error if the address format is invalid
   */
  async findByAddressAndChain(
    address: string,
    chainId: number
  ): Promise<UniswapV3Pool | null> {
    log.methodEntry(this.logger, 'findByAddressAndChain', {
      address,
      chainId,
    });

    try {
      // Validate and normalize address
      if (!isValidAddress(address)) {
        const error = new Error(`Invalid pool address format: ${address}`);
        log.methodError(this.logger, 'findByAddressAndChain', error, {
          address,
        });
        throw error;
      }
      const normalizedAddress = normalizeAddress(address);

      // Query database
      log.dbOperation(this.logger, 'findFirst', 'Pool', {
        address: normalizedAddress,
        chainId,
      });

      const result = await this.prisma.pool.findFirst({
        where: {
          protocol: 'uniswapv3',
          config: {
            path: ['address'],
            equals: normalizedAddress,
          },
          AND: {
            config: {
              path: ['chainId'],
              equals: chainId,
            },
          },
        },
        include: {
          token0: true,
          token1: true,
        },
      });

      if (!result) {
        this.logger.debug(
          { address: normalizedAddress, chainId },
          'Pool not found'
        );
        log.methodExit(this.logger, 'findByAddressAndChain', { found: false });
        return null;
      }

      this.logger.debug(
        {
          id: result.id,
          address: normalizedAddress,
          chainId,
          token0Symbol: result.token0.symbol,
          token1Symbol: result.token1.symbol,
        },
        'Pool found'
      );
      log.methodExit(this.logger, 'findByAddressAndChain', { id: result.id });
      return this.mapToUniswapV3Pool(result as unknown as Pool<unknown, unknown, TokenConfig> & {
        token0: Erc20Token;
        token1: Erc20Token;
      });
    } catch (error) {
      if (
        !(error instanceof Error && error.message.includes('Invalid pool address'))
      ) {
        log.methodError(this.logger, 'findByAddressAndChain', error as Error, {
          address,
          chainId,
        });
      }
      throw error;
    }
  }

  /**
   * Find a Uniswap V3 pool by its database ID
   *
   * @param id - Pool database ID
   * @returns The pool if found and is Uniswap V3 type, null otherwise
   */
  async findById(id: string): Promise<UniswapV3Pool | null> {
    log.methodEntry(this.logger, 'findById', { id });

    try {
      // Delegate to PoolService for database lookup
      const result = await this.poolService.findById(id);

      if (!result) {
        this.logger.debug({ id }, 'Pool not found');
        log.methodExit(this.logger, 'findById', { found: false });
        return null;
      }

      // Safeguard: Only return if it's a Uniswap V3 pool
      if (result.protocol !== 'uniswapv3') {
        this.logger.debug(
          { id, protocol: result.protocol },
          'Pool is not Uniswap V3 type'
        );
        log.methodExit(this.logger, 'findById', { found: false, wrongProtocol: true });
        return null;
      }

      this.logger.debug(
        {
          id,
          token0Symbol: result.token0.symbol,
          token1Symbol: result.token1.symbol,
        },
        'Uniswap V3 pool found'
      );
      log.methodExit(this.logger, 'findById', { id });

      // Convert state from string to bigint
      return this.mapToUniswapV3Pool(result as typeof result & {
        token0: Erc20Token;
        token1: Erc20Token;
      });
    } catch (error) {
      log.methodError(this.logger, 'findById', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update a Uniswap V3 pool's state
   *
   * Note: Pool config is immutable and cannot be updated.
   * Only the state field (which contains mutable data like current price,
   * liquidity, tick, fee growth) can be updated.
   *
   * @param id - Pool database ID
   * @param input - New state data (with bigint values)
   * @returns The updated pool
   * @throws Error if pool not found or not Uniswap V3 type
   */
  async updateState(
    id: string,
    input: UpdatePoolStateInput<UniswapV3PoolState>
  ): Promise<UniswapV3Pool> {
    log.methodEntry(this.logger, 'updateState', { id });

    try {
      // Verify pool exists and is Uniswap V3 (need to check before delegating)
      const existing = await this.poolService.findById(id);

      if (!existing) {
        const error = new Error(`Pool with id ${id} not found`);
        log.methodError(this.logger, 'updateState', error, { id });
        throw error;
      }

      if (existing.protocol !== 'uniswapv3') {
        const error = new Error(
          `Pool ${id} is not a Uniswap V3 pool (protocol: ${existing.protocol})`
        );
        log.methodError(this.logger, 'updateState', error, {
          id,
          protocol: existing.protocol,
        });
        throw error;
      }

      // Convert state from bigint to string for database storage
      const stateDB = toPoolStateDB(input.state);

      // Delegate to PoolService for database update
      const result = await this.poolService.updateState(id, { state: stateDB });

      this.logger.info(
        {
          id,
          token0Symbol: result.token0.symbol,
          token1Symbol: result.token1.symbol,
        },
        'Uniswap V3 pool state updated successfully'
      );
      log.methodExit(this.logger, 'updateState', { id });

      // Convert state back from string to bigint
      const state = toPoolState(result.state as UniswapV3PoolStateDB);

      return {
        ...result,
        token0: result.token0 as Erc20Token,
        token1: result.token1 as Erc20Token,
        protocol: result.protocol as UniswapV3Pool['protocol'],
        poolType: result.poolType as UniswapV3Pool['poolType'],
        config: result.config as unknown as UniswapV3PoolConfig,
        state,
      };
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          (error.message.includes('not found') ||
            error.message.includes('not a Uniswap V3 pool'))
        )
      ) {
        log.methodError(this.logger, 'updateState', error as Error, { id });
      }
      throw error;
    }
  }

  /**
   * Delete a Uniswap V3 pool
   *
   * @param id - Pool database ID
   * @throws Error if pool not found or not Uniswap V3 type
   */
  async delete(id: string): Promise<void> {
    log.methodEntry(this.logger, 'delete', { id });

    try {
      // Verify pool exists and is Uniswap V3 (need to check before delegating)
      const existing = await this.poolService.findById(id);

      if (!existing) {
        const error = new Error(`Pool with id ${id} not found`);
        log.methodError(this.logger, 'delete', error, { id });
        throw error;
      }

      if (existing.protocol !== 'uniswapv3') {
        const error = new Error(
          `Pool ${id} is not a Uniswap V3 pool (protocol: ${existing.protocol})`
        );
        log.methodError(this.logger, 'delete', error, {
          id,
          protocol: existing.protocol,
        });
        throw error;
      }

      // Delegate to PoolService for deletion
      await this.poolService.delete(id);

      this.logger.info(
        {
          id,
          token0Symbol: existing.token0.symbol,
          token1Symbol: existing.token1.symbol,
        },
        'Uniswap V3 pool deleted successfully'
      );
      log.methodExit(this.logger, 'delete', { id });
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          (error.message.includes('not found') ||
            error.message.includes('not a Uniswap V3 pool'))
        )
      ) {
        log.methodError(this.logger, 'delete', error as Error, { id });
      }
      throw error;
    }
  }
}
