/**
 * Erc20TokenService
 *
 * Specialized service for ERC-20 token management.
 * Handles address validation, normalization, and duplicate prevention.
 */

import { PrismaClient } from '@prisma/client';
import type { Erc20Token } from '../../shared/types/token-config.js';
import type {
  CreateErc20TokenInput,
  UpdateErc20TokenInput,
} from '../types/token/token-input.js';
import {
  isValidAddress,
  normalizeAddress,
  readTokenMetadata,
  TokenMetadataError,
} from '../../utils/evm/index.js';
import { EvmConfig } from '../../config/evm.js';
import { TokenService } from './token-service.js';
import { CoinGeckoClient } from '../../clients/coingecko/index.js';
import { createServiceLogger, log } from '../../logging/index.js';
import type { ServiceLogger } from '../../logging/index.js';

/**
 * Dependencies for Erc20TokenService
 * All dependencies are optional and will use defaults if not provided
 */
export interface Erc20TokenServiceDependencies {
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
   * CoinGecko API client for token enrichment
   * If not provided, the singleton CoinGeckoClient instance will be used
   */
  coinGeckoClient?: CoinGeckoClient;
}

/**
 * Erc20TokenService
 *
 * Provides CRUD operations for ERC-20 token management.
 * Validates and normalizes addresses, prevents duplicate tokens.
 */
export class Erc20TokenService {
  private readonly tokenService: TokenService;
  private readonly _prisma: PrismaClient;
  private readonly _evmConfig: EvmConfig;
  private readonly _coinGeckoClient: CoinGeckoClient;
  private readonly logger: ServiceLogger;

  /**
   * Creates a new Erc20TokenService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   * @param dependencies.evmConfig - EVM configuration instance (uses singleton if not provided)
   * @param dependencies.coinGeckoClient - CoinGecko client instance (uses singleton if not provided)
   */
  constructor(dependencies: Erc20TokenServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
    this._coinGeckoClient =
      dependencies.coinGeckoClient ?? CoinGeckoClient.getInstance();
    this.tokenService = new TokenService({ prisma: this._prisma });
    this.logger = createServiceLogger('Erc20TokenService');
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
  }

  /**
   * Get the EVM configuration instance
   */
  protected get evmConfig(): EvmConfig {
    return this._evmConfig;
  }

  /**
   * Get the CoinGecko client instance
   */
  protected get coinGeckoClient(): CoinGeckoClient {
    return this._coinGeckoClient;
  }

  /**
   * Map Prisma token result to Erc20Token type
   * Includes type safeguard to ensure token is ERC-20
   *
   * @param result - Prisma token query result
   * @returns Mapped Erc20Token
   * @throws Error if token is not ERC-20 type
   */
  private mapToErc20Token(result: {
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
  }): Erc20Token {
    // Safeguard: Verify token type
    if (result.tokenType !== 'evm-erc20') {
      throw new Error(
        `Token ${result.id} is not an ERC-20 token (type: ${result.tokenType})`
      );
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      tokenType: result.tokenType as Erc20Token['tokenType'],
      name: result.name,
      symbol: result.symbol,
      decimals: result.decimals,
      logoUrl: result.logoUrl ?? undefined,
      coingeckoId: result.coingeckoId ?? undefined,
      marketCap: result.marketCap ?? undefined,
      config: result.config as unknown as Erc20Token['config'],
    };
  }

  /**
   * Create a new ERC-20 token or return existing one
   *
   * Validates and normalizes the token address to EIP-55 checksum format.
   * Checks if a token with the same address and chainId already exists.
   * If it exists, returns the existing token. Otherwise, creates a new one.
   *
   * @param input - ERC-20 token data to create (omits id, createdAt, updatedAt)
   * @returns The created or existing token with all fields populated
   * @throws Error if the address format is invalid
   */
  async create(input: CreateErc20TokenInput): Promise<Erc20Token> {
    log.methodEntry(this.logger, 'create', {
      address: input.config.address,
      chainId: input.config.chainId,
      symbol: input.symbol,
    });

    try {
      // Validate address format
      if (!isValidAddress(input.config.address)) {
        const error = new Error(
          `Invalid Ethereum address format: ${input.config.address}`
        );
        log.methodError(this.logger, 'create', error, {
          address: input.config.address,
        });
        throw error;
      }

      // Normalize address to EIP-55 checksum format
      const normalizedAddress = normalizeAddress(input.config.address);
      this.logger.debug(
        { original: input.config.address, normalized: normalizedAddress },
        'Address normalized'
      );

      // Check if token already exists with same address and chainId
      log.dbOperation(this.logger, 'findFirst', 'Token', {
        address: normalizedAddress,
        chainId: input.config.chainId,
      });

      const existing = await this.prisma.token.findFirst({
        where: {
          tokenType: 'evm-erc20',
          config: {
            path: ['address'],
            equals: normalizedAddress,
          },
          AND: {
            config: {
              path: ['chainId'],
              equals: input.config.chainId,
            },
          },
        },
      });

      // If token exists, return it with type safeguard
      if (existing) {
        this.logger.warn(
          {
            id: existing.id,
            address: normalizedAddress,
            chainId: input.config.chainId,
            symbol: existing.symbol,
          },
          'Token already exists, returning existing token'
        );
        log.methodExit(this.logger, 'create', { id: existing.id, duplicate: true });
        return this.mapToErc20Token(existing);
      }

      // Create new token with normalized address
      const normalizedInput: CreateErc20TokenInput = {
        ...input,
        config: {
          ...input.config,
          address: normalizedAddress,
        },
      };

      const token = (await this.tokenService.create(
        normalizedInput
      )) as Erc20Token;

      this.logger.info(
        {
          id: token.id,
          address: normalizedAddress,
          chainId: input.config.chainId,
          symbol: token.symbol,
        },
        'ERC-20 token created successfully'
      );

      log.methodExit(this.logger, 'create', { id: token.id });
      return token;
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && error.message.includes('Invalid Ethereum address'))) {
        log.methodError(this.logger, 'create', error as Error, {
          address: input.config.address,
          chainId: input.config.chainId,
        });
      }
      throw error;
    }
  }

  /**
   * Find an ERC-20 token by address and chain ID
   *
   * @param address - Token contract address (will be normalized)
   * @param chainId - Chain ID
   * @returns The token if found, null otherwise
   * @throws Error if the address format is invalid
   */
  async findByAddressAndChain(
    address: string,
    chainId: number
  ): Promise<Erc20Token | null> {
    log.methodEntry(this.logger, 'findByAddressAndChain', { address, chainId });

    try {
      // Validate and normalize address
      if (!isValidAddress(address)) {
        const error = new Error(`Invalid Ethereum address format: ${address}`);
        log.methodError(this.logger, 'findByAddressAndChain', error, { address });
        throw error;
      }
      const normalizedAddress = normalizeAddress(address);

      // Query database
      log.dbOperation(this.logger, 'findFirst', 'Token', {
        address: normalizedAddress,
        chainId,
      });

      const result = await this.prisma.token.findFirst({
        where: {
          tokenType: 'evm-erc20',
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
      });

      if (!result) {
        this.logger.debug({ address: normalizedAddress, chainId }, 'Token not found');
        log.methodExit(this.logger, 'findByAddressAndChain', { found: false });
        return null;
      }

      this.logger.debug(
        { id: result.id, address: normalizedAddress, chainId, symbol: result.symbol },
        'Token found'
      );
      log.methodExit(this.logger, 'findByAddressAndChain', { id: result.id });
      return this.mapToErc20Token(result);
    } catch (error) {
      if (!(error instanceof Error && error.message.includes('Invalid Ethereum address'))) {
        log.methodError(this.logger, 'findByAddressAndChain', error as Error, {
          address,
          chainId,
        });
      }
      throw error;
    }
  }

  /**
   * Find an ERC-20 token by its database ID
   *
   * @param id - Token database ID
   * @returns The token if found and is ERC-20 type, null otherwise
   */
  async findById(id: string): Promise<Erc20Token | null> {
    log.methodEntry(this.logger, 'findById', { id });

    try {
      log.dbOperation(this.logger, 'findUnique', 'Token', { id });

      const result = await this.prisma.token.findUnique({
        where: { id },
      });

      if (!result) {
        this.logger.debug({ id }, 'Token not found');
        log.methodExit(this.logger, 'findById', { found: false });
        return null;
      }

      // Safeguard: Only return if it's an ERC-20 token
      if (result.tokenType !== 'evm-erc20') {
        this.logger.debug({ id, tokenType: result.tokenType }, 'Token is not ERC-20 type');
        log.methodExit(this.logger, 'findById', { found: false, wrongType: true });
        return null;
      }

      this.logger.debug({ id, symbol: result.symbol }, 'ERC-20 token found');
      log.methodExit(this.logger, 'findById', { id });
      return this.mapToErc20Token(result);
    } catch (error) {
      log.methodError(this.logger, 'findById', error as Error, { id });
      throw error;
    }
  }

  /**
   * Update an existing ERC-20 token
   *
   * @param id - Token database ID
   * @param input - Partial token data to update
   * @returns The updated token
   * @throws Error if token not found or not ERC-20 type
   * @throws Error if address format is invalid (when updating address)
   */
  async update(
    id: string,
    input: UpdateErc20TokenInput
  ): Promise<Erc20Token> {
    log.methodEntry(this.logger, 'update', {
      id,
      fields: Object.keys(input),
    });

    try {
      // Safeguard: Verify token exists and is ERC-20
      log.dbOperation(this.logger, 'findUnique', 'Token', { id });

      const existing = await this.prisma.token.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Token with id ${id} not found`);
        log.methodError(this.logger, 'update', error, { id });
        throw error;
      }

      if (existing.tokenType !== 'evm-erc20') {
        const error = new Error(
          `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
        );
        log.methodError(this.logger, 'update', error, { id, tokenType: existing.tokenType });
        throw error;
      }

      // If updating address, validate and normalize it
      let updateData: UpdateErc20TokenInput = input;
      if (input.config?.address) {
        if (!isValidAddress(input.config.address)) {
          const error = new Error(
            `Invalid Ethereum address format: ${input.config.address}`
          );
          log.methodError(this.logger, 'update', error, { id, address: input.config.address });
          throw error;
        }
        const normalizedAddress = normalizeAddress(input.config.address);
        this.logger.debug(
          { original: input.config.address, normalized: normalizedAddress },
          'Address normalized for update'
        );
        updateData = {
          ...input,
          config: {
            ...input.config,
            address: normalizedAddress,
          },
        };
      }

      // Update token
      log.dbOperation(this.logger, 'update', 'Token', { id, fields: Object.keys(updateData) });

      const result = await this.prisma.token.update({
        where: { id },
        data: {
          name: updateData.name,
          symbol: updateData.symbol,
          decimals: updateData.decimals,
          logoUrl: updateData.logoUrl,
          coingeckoId: updateData.coingeckoId,
          marketCap: updateData.marketCap,
          config: updateData.config as object | undefined,
        },
      });

      this.logger.info({ id, symbol: result.symbol }, 'ERC-20 token updated successfully');
      log.methodExit(this.logger, 'update', { id });
      return this.mapToErc20Token(result);
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && (
        error.message.includes('not found') ||
        error.message.includes('not an ERC-20 token') ||
        error.message.includes('Invalid Ethereum address')
      ))) {
        log.methodError(this.logger, 'update', error as Error, { id });
      }
      throw error;
    }
  }

  /**
   * Delete an ERC-20 token
   *
   * @param id - Token database ID
   * @throws Error if token not found or not ERC-20 type
   */
  async delete(id: string): Promise<void> {
    log.methodEntry(this.logger, 'delete', { id });

    try {
      // Safeguard: Verify token exists and is ERC-20
      log.dbOperation(this.logger, 'findUnique', 'Token', { id });

      const existing = await this.prisma.token.findUnique({
        where: { id },
      });

      if (!existing) {
        const error = new Error(`Token with id ${id} not found`);
        log.methodError(this.logger, 'delete', error, { id });
        throw error;
      }

      if (existing.tokenType !== 'evm-erc20') {
        const error = new Error(
          `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
        );
        log.methodError(this.logger, 'delete', error, { id, tokenType: existing.tokenType });
        throw error;
      }

      // Delete token
      log.dbOperation(this.logger, 'delete', 'Token', { id });

      await this.prisma.token.delete({
        where: { id },
      });

      this.logger.info({ id, symbol: existing.symbol }, 'ERC-20 token deleted successfully');
      log.methodExit(this.logger, 'delete', { id });
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && (
        error.message.includes('not found') ||
        error.message.includes('not an ERC-20 token')
      ))) {
        log.methodError(this.logger, 'delete', error as Error, { id });
      }
      throw error;
    }
  }

  /**
   * Discover and create an ERC-20 token from on-chain contract data
   *
   * Checks the database first for an existing token. If not found, reads
   * token metadata (name, symbol, decimals) from the contract and creates
   * a new token entry in the database.
   *
   * This is useful for auto-discovering tokens that users interact with
   * without requiring manual entry of token details.
   *
   * @param address - Token contract address (any case, will be normalized)
   * @param chainId - Chain ID where the token exists
   * @returns The discovered or existing token with all fields populated
   * @throws Error if address format is invalid
   * @throws Error if chain ID is not supported
   * @throws TokenMetadataError if contract doesn't implement ERC-20 metadata
   *
   * @example
   * ```typescript
   * const service = new Erc20TokenService();
   *
   * // Discover USDC on Ethereum
   * const usdc = await service.discoverToken(
   *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
   *   1
   * );
   * // { name: 'USD Coin', symbol: 'USDC', decimals: 6, ... }
   * ```
   */
  async discoverToken(
    address: string,
    chainId: number
  ): Promise<Erc20Token> {
    log.methodEntry(this.logger, 'discoverToken', { address, chainId });

    try {
      // Validate address format
      if (!isValidAddress(address)) {
        const error = new Error(`Invalid Ethereum address format: ${address}`);
        log.methodError(this.logger, 'discoverToken', error, { address, chainId });
        throw error;
      }

      // Normalize address to EIP-55 checksum format
      const normalizedAddress = normalizeAddress(address);
      this.logger.debug(
        { original: address, normalized: normalizedAddress },
        'Address normalized for discovery'
      );

      // Check if token already exists in database
      const existing = await this.findByAddressAndChain(
        normalizedAddress,
        chainId
      );

      if (existing) {
        // Token already exists, return it immediately (no RPC call needed)
        this.logger.info(
          { id: existing.id, address: normalizedAddress, chainId, symbol: existing.symbol },
          'Token already exists in database, skipping on-chain discovery'
        );
        log.methodExit(this.logger, 'discoverToken', { id: existing.id, fromDatabase: true });
        return existing;
      }

      // Verify chain is supported before attempting RPC call
      if (!this.evmConfig.isChainSupported(chainId)) {
        const error = new Error(
          `Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
            .getSupportedChainIds()
            .join(', ')}`
        );
        log.methodError(this.logger, 'discoverToken', error, { chainId });
        throw error;
      }

      this.logger.debug({ chainId }, 'Chain is supported, proceeding with RPC call');

      // Get public client for the chain
      const client = this.evmConfig.getPublicClient(chainId);

      // Read token metadata from contract
      this.logger.debug(
        { address: normalizedAddress, chainId },
        'Reading token metadata from on-chain contract'
      );

      let metadata;
      try {
        metadata = await readTokenMetadata(client, normalizedAddress);
      } catch (error) {
        // Re-throw TokenMetadataError with additional context
        if (error instanceof TokenMetadataError) {
          log.methodError(this.logger, 'discoverToken', error, { address: normalizedAddress, chainId });
          throw error;
        }
        const wrappedError = new Error(
          `Failed to read token metadata from contract at ${normalizedAddress} on chain ${chainId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
        log.methodError(this.logger, 'discoverToken', wrappedError, { address: normalizedAddress, chainId });
        throw wrappedError;
      }

      this.logger.info(
        {
          address: normalizedAddress,
          chainId,
          name: metadata.name,
          symbol: metadata.symbol,
          decimals: metadata.decimals,
        },
        'Token metadata discovered from contract'
      );

      // Create token in database with discovered metadata
      const token = await this.create({
        tokenType: 'evm-erc20',
        name: metadata.name,
        symbol: metadata.symbol,
        decimals: metadata.decimals,
        config: {
          address: normalizedAddress,
          chainId,
        },
      });

      this.logger.info(
        { id: token.id, address: normalizedAddress, chainId, symbol: token.symbol },
        'Token discovered and created successfully'
      );
      log.methodExit(this.logger, 'discoverToken', { id: token.id, fromBlockchain: true });
      return token;
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && (
        error.message.includes('Invalid Ethereum address') ||
        error.message.includes('not configured') ||
        error instanceof TokenMetadataError ||
        error.message.includes('Failed to read token metadata')
      ))) {
        log.methodError(this.logger, 'discoverToken', error as Error, { address, chainId });
      }
      throw error;
    }
  }

  /**
   * Enrich an ERC-20 token with metadata from CoinGecko
   *
   * Updates the token with logoUrl, coingeckoId, and marketCap from CoinGecko.
   * The token must already exist in the database before enrichment.
   *
   * If the token already has a coingeckoId, it's assumed to be properly enriched
   * and will be returned immediately without making any API calls.
   *
   * @param tokenId - Token database ID
   * @returns The enriched token with updated fields
   * @throws Error if token not found in database
   * @throws Error if token is not ERC-20 type
   * @throws TokenNotFoundInCoinGeckoError if token not found in CoinGecko
   * @throws CoinGeckoApiError if CoinGecko API request fails
   *
   * @example
   * ```typescript
   * const service = new Erc20TokenService();
   *
   * // First, create or discover a token
   * const usdc = await service.discoverToken(
   *   '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
   *   1
   * );
   *
   * // Then enrich it with CoinGecko data
   * const enriched = await service.enrichToken(usdc.id);
   * // { ..., logoUrl: '...', coingeckoId: 'usd-coin', marketCap: 28000000000 }
   *
   * // Calling again returns immediately (already enriched)
   * const same = await service.enrichToken(usdc.id);
   * ```
   */
  async enrichToken(tokenId: string): Promise<Erc20Token> {
    log.methodEntry(this.logger, 'enrichToken', { tokenId });

    try {
      // Load token from database
      log.dbOperation(this.logger, 'findUnique', 'Token', { id: tokenId });

      const existing = await this.prisma.token.findUnique({
        where: { id: tokenId },
      });

      if (!existing) {
        const error = new Error(`Token with id ${tokenId} not found`);
        log.methodError(this.logger, 'enrichToken', error, { tokenId });
        throw error;
      }

      // Verify token is ERC-20 type
      if (existing.tokenType !== 'evm-erc20') {
        const error = new Error(
          `Token ${tokenId} is not an ERC-20 token (type: ${existing.tokenType})`
        );
        log.methodError(this.logger, 'enrichToken', error, {
          tokenId,
          tokenType: existing.tokenType,
        });
        throw error;
      }

      // If token already has coingeckoId, assume it's properly enriched
      if (existing.coingeckoId) {
        this.logger.info(
          { tokenId, coingeckoId: existing.coingeckoId, symbol: existing.symbol },
          'Token already enriched, skipping CoinGecko API call'
        );
        log.methodExit(this.logger, 'enrichToken', { tokenId, alreadyEnriched: true });
        return this.mapToErc20Token(existing);
      }

      // Extract address and chainId from token config
      const config = existing.config as { address: string; chainId: number };
      const { address, chainId } = config;

      this.logger.debug(
        { tokenId, address, chainId, symbol: existing.symbol },
        'Fetching enrichment data from CoinGecko'
      );

      // Fetch enrichment data from CoinGecko (already logged by CoinGeckoClient)
      const enrichmentData = await this.coinGeckoClient.getErc20EnrichmentData(
        chainId,
        address
      );

      // Update token in database
      log.dbOperation(this.logger, 'update', 'Token', {
        id: tokenId,
        fields: ['logoUrl', 'coingeckoId', 'marketCap'],
      });

      const updated = await this.prisma.token.update({
        where: { id: tokenId },
        data: {
          logoUrl: enrichmentData.logoUrl,
          coingeckoId: enrichmentData.coingeckoId,
          marketCap: enrichmentData.marketCap,
        },
      });

      this.logger.info(
        {
          tokenId,
          coingeckoId: enrichmentData.coingeckoId,
          symbol: updated.symbol,
          marketCap: enrichmentData.marketCap,
        },
        'Token enriched successfully with CoinGecko data'
      );

      log.methodExit(this.logger, 'enrichToken', { tokenId, coingeckoId: enrichmentData.coingeckoId });
      return this.mapToErc20Token(updated);
    } catch (error) {
      // Only log if not already logged
      if (!(error instanceof Error && (
        error.message.includes('not found') ||
        error.message.includes('not an ERC-20 token')
      ))) {
        log.methodError(this.logger, 'enrichToken', error as Error, { tokenId });
      }
      throw error;
    }
  }
}
