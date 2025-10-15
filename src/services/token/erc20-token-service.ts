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
import { isValidAddress, normalizeAddress } from '../../utils/evm.js';
import { TokenService } from './token-service.js';

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

  /**
   * Creates a new Erc20TokenService instance
   *
   * @param dependencies - Optional dependencies object
   * @param dependencies.prisma - Prisma client instance (creates default if not provided)
   */
  constructor(dependencies: Erc20TokenServiceDependencies = {}) {
    this._prisma = dependencies.prisma ?? new PrismaClient();
    this.tokenService = new TokenService({ prisma: this._prisma });
  }

  /**
   * Get the Prisma client instance
   */
  protected get prisma(): PrismaClient {
    return this._prisma;
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
    // Validate address format
    if (!isValidAddress(input.config.address)) {
      throw new Error(
        `Invalid Ethereum address format: ${input.config.address}`
      );
    }

    // Normalize address to EIP-55 checksum format
    const normalizedAddress = normalizeAddress(input.config.address);

    // Check if token already exists with same address and chainId
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

    return (await this.tokenService.create(
      normalizedInput
    )) as Erc20Token;
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
    // Validate and normalize address
    if (!isValidAddress(address)) {
      throw new Error(`Invalid Ethereum address format: ${address}`);
    }
    const normalizedAddress = normalizeAddress(address);

    // Query database
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
      return null;
    }

    return this.mapToErc20Token(result);
  }

  /**
   * Find an ERC-20 token by its database ID
   *
   * @param id - Token database ID
   * @returns The token if found and is ERC-20 type, null otherwise
   */
  async findById(id: string): Promise<Erc20Token | null> {
    const result = await this.prisma.token.findUnique({
      where: { id },
    });

    if (!result) {
      return null;
    }

    // Safeguard: Only return if it's an ERC-20 token
    if (result.tokenType !== 'evm-erc20') {
      return null;
    }

    return this.mapToErc20Token(result);
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
    // Safeguard: Verify token exists and is ERC-20
    const existing = await this.prisma.token.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Token with id ${id} not found`);
    }

    if (existing.tokenType !== 'evm-erc20') {
      throw new Error(
        `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
      );
    }

    // If updating address, validate and normalize it
    let updateData: UpdateErc20TokenInput = input;
    if (input.config?.address) {
      if (!isValidAddress(input.config.address)) {
        throw new Error(
          `Invalid Ethereum address format: ${input.config.address}`
        );
      }
      const normalizedAddress = normalizeAddress(input.config.address);
      updateData = {
        ...input,
        config: {
          ...input.config,
          address: normalizedAddress,
        },
      };
    }

    // Update token
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

    return this.mapToErc20Token(result);
  }

  /**
   * Delete an ERC-20 token
   *
   * @param id - Token database ID
   * @throws Error if token not found or not ERC-20 type
   */
  async delete(id: string): Promise<void> {
    // Safeguard: Verify token exists and is ERC-20
    const existing = await this.prisma.token.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new Error(`Token with id ${id} not found`);
    }

    if (existing.tokenType !== 'evm-erc20') {
      throw new Error(
        `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
      );
    }

    // Delete token
    await this.prisma.token.delete({
      where: { id },
    });
  }
}
