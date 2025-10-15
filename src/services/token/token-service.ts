/**
 * TokenService
 *
 * Manages token storage and persistence with CRUD operations.
 * Uses dependency injection pattern for testability and flexibility.
 */

import { PrismaClient } from '@prisma/client';
import type { AnyToken } from '../../shared/types/token-config.js';
import type { CreateAnyTokenInput } from '../types/token/token-input.js';
import { createServiceLogger, log } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * Dependencies for TokenService
 * All dependencies are optional and will use defaults if not provided
 */
export interface TokenServiceDependencies {
  /**
   * Prisma client for database operations
   * If not provided, a new PrismaClient instance will be created
   */
  prisma?: PrismaClient;
}

/**
 * TokenService
 *
 * Provides CRUD operations for token management.
 * Handles persistence and retrieval of tokens from the database.
 */
export class TokenService {
  private readonly _prisma: PrismaClient;
  private readonly logger: ServiceLogger;

  /**
   * Creates a new TokenService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: TokenServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this.logger = createServiceLogger('TokenService');
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
  }

  /**
   * Create a new token
   *
   * @param input - Token data to create (omits id, createdAt, updatedAt)
   * @returns The created token with generated id and timestamps
   */
  async create(input: CreateAnyTokenInput): Promise<AnyToken> {
    log.methodEntry(this.logger, 'create', {
      tokenType: input.tokenType,
      symbol: input.symbol,
      name: input.name,
    });

    try {
      log.dbOperation(this.logger, 'create', 'Token', {
        tokenType: input.tokenType,
        symbol: input.symbol,
      });

      const result = await this.prisma.token.create({
        data: {
          tokenType: input.tokenType,
          name: input.name,
          symbol: input.symbol,
          decimals: input.decimals,
          logoUrl: input.logoUrl,
          coingeckoId: input.coingeckoId,
          marketCap: input.marketCap,
          config: input.config as object,
        },
      });

      const token: AnyToken = {
        id: result.id,
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
        tokenType: result.tokenType as AnyToken['tokenType'],
        name: result.name,
        symbol: result.symbol,
        decimals: result.decimals,
        logoUrl: result.logoUrl ?? undefined,
        coingeckoId: result.coingeckoId ?? undefined,
        marketCap: result.marketCap ?? undefined,
        config: result.config as unknown as AnyToken['config'],
      };

      this.logger.info(
        {
          id: token.id,
          tokenType: token.tokenType,
          symbol: token.symbol,
          name: token.name,
        },
        'Token created successfully'
      );

      log.methodExit(this.logger, 'create', { id: token.id });
      return token;
    } catch (error) {
      log.methodError(this.logger, 'create', error as Error, {
        tokenType: input.tokenType,
        symbol: input.symbol,
      });
      throw error;
    }
  }
}
