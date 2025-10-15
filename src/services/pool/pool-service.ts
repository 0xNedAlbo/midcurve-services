/**
 * PoolService
 *
 * Base service for managing liquidity pool storage and persistence with CRUD operations.
 * Uses dependency injection pattern for testability and flexibility.
 */

import { PrismaClient } from '@prisma/client';
import type { Pool } from '../../shared/types/pool.js';
import type { TokenConfig, AnyToken } from '../../shared/types/token-config.js';
import type {
  CreatePoolInput,
  UpdatePoolStateInput,
} from '../types/pool/pool-input.js';
import { createServiceLogger, log } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * Dependencies for PoolService
 * All dependencies are optional and will use defaults if not provided
 */
export interface PoolServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * Generic pool result from database (before token resolution)
 */
interface PoolDbResult {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  protocol: string;
  poolType: string;
  token0Id: string;
  token1Id: string;
  feeBps: number;
  config: unknown;
  state: unknown;
  token0: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    tokenType: string;
    name: string;
    symbol: string;
    decimals: number;
    logoUrl: string | null;
    coingeckoId: string | null;
    marketCap: number | null;
    config: unknown;
  };
  token1: {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    tokenType: string;
    name: string;
    symbol: string;
    decimals: number;
    logoUrl: string | null;
    coingeckoId: string | null;
    marketCap: number | null;
    config: unknown;
  };
}

/**
 * PoolService
 *
 * Provides CRUD operations for pool management.
 * Handles persistence and retrieval of pools from the database.
 */
export class PoolService {
  private readonly _prisma: PrismaClient;
  private readonly logger: ServiceLogger;

  /**
   * Creates a new PoolService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: PoolServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this.logger = createServiceLogger('PoolService');
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
  }

  /**
   * Map token database result to AnyToken type
   */
  private mapToToken(tokenResult: PoolDbResult['token0']): AnyToken {
    return {
      id: tokenResult.id,
      createdAt: tokenResult.createdAt,
      updatedAt: tokenResult.updatedAt,
      tokenType: tokenResult.tokenType as AnyToken['tokenType'],
      name: tokenResult.name,
      symbol: tokenResult.symbol,
      decimals: tokenResult.decimals,
      logoUrl: tokenResult.logoUrl ?? undefined,
      coingeckoId: tokenResult.coingeckoId ?? undefined,
      marketCap: tokenResult.marketCap ?? undefined,
      config: tokenResult.config as TokenConfig,
    };
  }

  /**
   * Map database result to Pool type
   */
  protected mapToPool<
    TConfig = Record<string, unknown>,
    TState = Record<string, unknown>,
    TToken extends TokenConfig = TokenConfig
  >(result: PoolDbResult): Pool<TConfig, TState, TToken> {
    return {
      id: result.id,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      protocol: result.protocol as Pool<TConfig, TState, TToken>['protocol'],
      poolType: result.poolType as Pool<TConfig, TState, TToken>['poolType'],
      token0: this.mapToToken(result.token0) as Pool<
        TConfig,
        TState,
        TToken
      >['token0'],
      token1: this.mapToToken(result.token1) as Pool<
        TConfig,
        TState,
        TToken
      >['token1'],
      feeBps: result.feeBps,
      config: result.config as TConfig,
      state: result.state as TState,
    };
  }

  /**
   * Create a new pool
   *
   * @param input - Pool data to create (omits id, createdAt, updatedAt)
   * @returns The created pool with generated id and timestamps
   * @throws Error if token0 or token1 do not exist
   */
  async create<
    TConfig = Record<string, unknown>,
    TState = Record<string, unknown>,
    TToken extends TokenConfig = TokenConfig
  >(
    input: CreatePoolInput<TConfig, TState, TToken>
  ): Promise<Pool<TConfig, TState, TToken>> {
    log.methodEntry(this.logger, 'create', {
      protocol: input.protocol,
      poolType: input.poolType,
      feeBps: input.feeBps,
    });

    try {
      // Verify both tokens exist
      log.dbOperation(this.logger, 'findUnique', 'Token', {
        id: input.token0.id,
      });
      const token0Exists = await this.prisma.token.findUnique({
        where: { id: input.token0.id },
      });

      if (!token0Exists) {
        const error = new Error(`Token with id ${input.token0.id} not found`);
        log.methodError(this.logger, 'create', error, {
          token0Id: input.token0.id,
        });
        throw error;
      }

      log.dbOperation(this.logger, 'findUnique', 'Token', {
        id: input.token1.id,
      });
      const token1Exists = await this.prisma.token.findUnique({
        where: { id: input.token1.id },
      });

      if (!token1Exists) {
        const error = new Error(`Token with id ${input.token1.id} not found`);
        log.methodError(this.logger, 'create', error, {
          token1Id: input.token1.id,
        });
        throw error;
      }

      // Create pool
      log.dbOperation(this.logger, 'create', 'Pool', {
        protocol: input.protocol,
        poolType: input.poolType,
      });

      const result = await this.prisma.pool.create({
        data: {
          protocol: input.protocol,
          poolType: input.poolType,
          token0Id: input.token0.id,
          token1Id: input.token1.id,
          feeBps: input.feeBps,
          config: input.config as object,
          state: input.state as object,
        },
        include: {
          token0: true,
          token1: true,
        },
      });

      const pool = this.mapToPool<TConfig, TState, TToken>(result);

      this.logger.info(
        {
          id: pool.id,
          protocol: pool.protocol,
          poolType: pool.poolType,
          token0Symbol: pool.token0.symbol,
          token1Symbol: pool.token1.symbol,
          feeBps: pool.feeBps,
        },
        'Pool created successfully'
      );

      log.methodExit(this.logger, 'create', { id: pool.id });
      return pool;
    } catch (error) {
      // Only log if not already logged
      if (
        !(
          error instanceof Error &&
          error.message.includes('Token with id') &&
          error.message.includes('not found')
        )
      ) {
        log.methodError(this.logger, 'create', error as Error, {
          protocol: input.protocol,
          poolType: input.poolType,
        });
      }
      throw error;
    }
  }

  /**
   * Find a pool by its database ID
   *
   * @param id - Pool database ID
   * @returns The pool if found, null otherwise
   */
  async findById<
    TConfig = Record<string, unknown>,
    TState = Record<string, unknown>,
    TToken extends TokenConfig = TokenConfig
  >(id: string): Promise<Pool<TConfig, TState, TToken> | null> {
    log.methodEntry(this.logger, 'findById', { id });

    try {
      log.dbOperation(this.logger, 'findUnique', 'Pool', { id });

      const result = await this.prisma.pool.findUnique({
        where: { id },
        include: {
          token0: true,
          token1: true,
        },
      });

      if (!result) {
        this.logger.debug({ id }, 'Pool not found');
        log.methodExit(this.logger, 'findById', { found: false });
        return null;
      }

      this.logger.debug(
        {
          id,
          protocol: result.protocol,
          token0Symbol: result.token0.symbol,
          token1Symbol: result.token1.symbol,
        },
        'Pool found'
      );
      log.methodExit(this.logger, 'findById', { id });
      return this.mapToPool<TConfig, TState, TToken>(result);
    } catch (error) {
      log.methodError(this.logger, 'findById', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update a pool's state
   *
   * Note: Pool config is immutable and cannot be updated.
   * Only the state field (which contains mutable data like current price,
   * liquidity, tick) can be updated.
   *
   * @param id - Pool database ID
   * @param input - New state data
   * @returns The updated pool
   * @throws Error if pool not found
   */
  async updateState<
    TConfig = Record<string, unknown>,
    TState = Record<string, unknown>,
    TToken extends TokenConfig = TokenConfig
  >(
    id: string,
    input: UpdatePoolStateInput<TState>
  ): Promise<Pool<TConfig, TState, TToken>> {
    log.methodEntry(this.logger, 'updateState', { id });

    try {
      // Verify pool exists
      log.dbOperation(this.logger, 'findUnique', 'Pool', { id });

      const existing = await this.prisma.pool.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Pool with id ${id} not found`);
        log.methodError(this.logger, 'updateState', error, { id });
        throw error;
      }

      // Update state
      log.dbOperation(this.logger, 'update', 'Pool', {
        id,
        fields: ['state'],
      });

      const result = await this.prisma.pool.update({
        where: { id },
        data: {
          state: input.state as object,
        },
        include: {
          token0: true,
          token1: true,
        },
      });

      this.logger.info(
        {
          id,
          protocol: result.protocol,
          token0Symbol: result.token0.symbol,
          token1Symbol: result.token1.symbol,
        },
        'Pool state updated successfully'
      );
      log.methodExit(this.logger, 'updateState', { id });
      return this.mapToPool<TConfig, TState, TToken>(result);
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && error.message.includes('not found'))) {
        log.methodError(this.logger, 'updateState', error as Error, { id });
      }
      throw error;
    }
  }

  /**
   * Delete a pool
   *
   * @param id - Pool database ID
   * @throws Error if pool not found
   */
  async delete(id: string): Promise<void> {
    log.methodEntry(this.logger, 'delete', { id });

    try {
      // Verify pool exists
      log.dbOperation(this.logger, 'findUnique', 'Pool', { id });

      const existing = await this.prisma.pool.findUnique({
        where: { id },
        include: {
          token0: true,
          token1: true,
        },
      });

      if (!existing) {
        const error = new Error(`Pool with id ${id} not found`);
        log.methodError(this.logger, 'delete', error, { id });
        throw error;
      }

      // Delete pool
      log.dbOperation(this.logger, 'delete', 'Pool', { id });

      await this.prisma.pool.delete({
        where: { id },
      });

      this.logger.info(
        {
          id,
          protocol: existing.protocol,
          token0Symbol: existing.token0.symbol,
          token1Symbol: existing.token1.symbol,
        },
        'Pool deleted successfully'
      );
      log.methodExit(this.logger, 'delete', { id });
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && error.message.includes('not found'))) {
        log.methodError(this.logger, 'delete', error as Error, { id });
      }
      throw error;
    }
  }
}
