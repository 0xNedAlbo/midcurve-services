/**
 * Erc20TokenService
 *
 * Specialized service for ERC-20 token management.
 * Handles serialization/deserialization of ERC-20 token config.
 */

import { PrismaClient } from "@prisma/client";
import type { Token } from '@midcurve/shared';
import type { Erc20TokenConfig } from '@midcurve/shared';
import { isValidAddress, normalizeAddress } from '@midcurve/shared';
import type {
    CreateTokenInput,
    UpdateTokenInput,
    Erc20TokenDiscoverInput,
} from "../types/token/token-input.js";
import { TokenService } from "./token-service.js";
import {
    readTokenMetadata,
    TokenMetadataError,
} from "../../utils/evm/index.js";
import { EvmConfig } from "../../config/evm.js";
import { CoinGeckoClient } from "../../clients/coingecko/index.js";
import { log } from "../../logging/index.js";

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
 * Provides token management for ERC-20 tokens.
 * Implements serialization methods for ERC-20 config type.
 */
export class Erc20TokenService extends TokenService<"erc20"> {
    private readonly _evmConfig: EvmConfig;
    private readonly _coinGeckoClient: CoinGeckoClient;

    /**
     * Creates a new Erc20TokenService instance
     *
     * @param dependencies - Optional dependencies object
     * @param dependencies.prisma - Prisma client instance (creates default if not provided)
     * @param dependencies.evmConfig - EVM configuration instance (uses singleton if not provided)
     * @param dependencies.coinGeckoClient - CoinGecko client instance (uses singleton if not provided)
     */
    constructor(dependencies: Erc20TokenServiceDependencies = {}) {
        super(dependencies);
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this._coinGeckoClient =
            dependencies.coinGeckoClient ?? CoinGeckoClient.getInstance();
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

    // ============================================================================
    // ABSTRACT METHOD IMPLEMENTATIONS
    // ============================================================================

    /**
     * Parse config from database JSON to application type
     *
     * For ERC-20, config contains only primitive types (address, chainId),
     * so this is essentially a pass-through with type casting.
     *
     * @param configDB - Config object from database (JSON)
     * @returns Parsed ERC-20 config
     */
    parseConfig(configDB: unknown): Erc20TokenConfig {
        const db = configDB as {
            address: string;
            chainId: number;
        };

        return {
            address: db.address,
            chainId: db.chainId,
        };
    }

    /**
     * Serialize config from application type to database JSON
     *
     * For ERC-20, config contains only primitive types (address, chainId),
     * so this is essentially a pass-through.
     *
     * @param config - Application config
     * @returns Serialized config for database storage (JSON-serializable)
     */
    serializeConfig(config: Erc20TokenConfig): unknown {
        return {
            address: config.address,
            chainId: config.chainId,
        };
    }

    // ============================================================================
    // ABSTRACT METHOD IMPLEMENTATION - DISCOVERY
    // ============================================================================

    /**
     * Discover and create an ERC-20 token from on-chain contract data
     *
     * Checks the database first for an existing token. If not found, reads
     * token metadata (name, symbol, decimals) from the contract, fetches
     * enrichment data from CoinGecko, and creates a new token entry.
     *
     * CoinGecko enrichment is MANDATORY - the method fails if CoinGecko data
     * cannot be fetched.
     *
     * @param params - Discovery parameters { address, chainId }
     * @returns The discovered or existing token with full CoinGecko enrichment
     * @throws Error if address format is invalid
     * @throws Error if chain ID is not supported
     * @throws TokenMetadataError if contract doesn't implement ERC-20 metadata
     * @throws CoinGeckoApiError if CoinGecko API request fails
     */
    override async discover(params: Erc20TokenDiscoverInput): Promise<Token<"erc20">> {
        const { address, chainId } = params;
        log.methodEntry(this.logger, "discover", { address, chainId });

        try {
            // 1. Validate address format
            if (!isValidAddress(address)) {
                const error = new Error(`Invalid Ethereum address format: ${address}`);
                log.methodError(this.logger, "discover", error, { address, chainId });
                throw error;
            }

            // 2. Normalize to EIP-55
            const normalizedAddress = normalizeAddress(address);
            this.logger.debug(
                { original: address, normalized: normalizedAddress },
                "Address normalized for discovery"
            );

            // 3. Check database first (optimization)
            const existing = await this.findByAddressAndChain(normalizedAddress, chainId);

            if (existing) {
                // If already has CoinGecko data, return immediately
                if (existing.coingeckoId) {
                    this.logger.info(
                        {
                            id: existing.id,
                            address: normalizedAddress,
                            chainId,
                            symbol: existing.symbol,
                        },
                        "Token already exists with CoinGecko data, skipping on-chain discovery"
                    );
                    log.methodExit(this.logger, "discover", { id: existing.id, fromDatabase: true });
                    return existing;
                }

                // Token exists but not enriched - enrich and return
                this.logger.info(
                    { id: existing.id, symbol: existing.symbol },
                    "Token exists but needs CoinGecko enrichment"
                );
                const enriched = await this.enrichToken(existing.id);
                log.methodExit(this.logger, "discover", { id: enriched.id, enriched: true });
                return enriched;
            }

            // 4. Verify chain is supported
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(
                    `Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                        .getSupportedChainIds()
                        .join(", ")}`
                );
                log.methodError(this.logger, "discover", error, { chainId });
                throw error;
            }

            this.logger.debug({ chainId }, "Chain is supported, proceeding with on-chain discovery");

            // 5. Read on-chain metadata
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug(
                { address: normalizedAddress, chainId },
                "Reading token metadata from contract"
            );

            let metadata;
            try {
                metadata = await readTokenMetadata(client, normalizedAddress);
            } catch (error) {
                if (error instanceof TokenMetadataError) {
                    log.methodError(this.logger, "discover", error, {
                        address: normalizedAddress,
                        chainId,
                    });
                    throw error;
                }
                const wrappedError = new Error(
                    `Failed to read token metadata from contract at ${normalizedAddress} on chain ${chainId}: ${
                        error instanceof Error ? error.message : String(error)
                    }`
                );
                log.methodError(this.logger, "discover", wrappedError, {
                    address: normalizedAddress,
                    chainId,
                });
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
                "Token metadata discovered from contract"
            );

            // 6. Fetch CoinGecko enrichment data (MANDATORY - no try/catch)
            this.logger.debug(
                { address: normalizedAddress, chainId },
                "Fetching CoinGecko enrichment data"
            );

            const enrichmentData = await this.coinGeckoClient.getErc20EnrichmentData(
                chainId,
                normalizedAddress
            );

            this.logger.info(
                {
                    coingeckoId: enrichmentData.coingeckoId,
                    marketCap: enrichmentData.marketCap,
                },
                "CoinGecko enrichment data fetched"
            );

            // 7. Create token with all data
            const token = await this.create({
                tokenType: "erc20",
                name: metadata.name,
                symbol: metadata.symbol,
                decimals: metadata.decimals,
                logoUrl: enrichmentData.logoUrl,
                coingeckoId: enrichmentData.coingeckoId,
                marketCap: enrichmentData.marketCap,
                config: {
                    address: normalizedAddress,
                    chainId,
                },
            });

            this.logger.info(
                { id: token.id, address: normalizedAddress, chainId, symbol: token.symbol },
                "Token discovered and created successfully"
            );
            log.methodExit(this.logger, "discover", { id: token.id, fromBlockchain: true });
            return token;
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    (error.message.includes("Invalid Ethereum address") ||
                        error.message.includes("not configured") ||
                        error instanceof TokenMetadataError ||
                        error.message.includes("Failed to read token metadata"))
                )
            ) {
                log.methodError(this.logger, "discover", error as Error, { address, chainId });
            }
            throw error;
        }
    }

    // ============================================================================
    // CRUD OPERATIONS
    // ============================================================================

    /**
     * Find an ERC-20 token by its database ID
     *
     * @param id - Token database ID
     * @returns The token if found and is ERC-20 type, null otherwise
     */
    override async findById(id: string): Promise<Token<"erc20"> | null> {
        log.methodEntry(this.logger, "findById", { id });

        try {
            log.dbOperation(this.logger, "findUnique", "Token", { id });

            const result = await this.prisma.token.findUnique({
                where: { id },
            });

            if (!result) {
                this.logger.debug({ id }, "Token not found");
                log.methodExit(this.logger, "findById", { found: false });
                return null;
            }

            // Type filter: Only return if it's an ERC-20 token
            if (result.tokenType !== "erc20") {
                this.logger.debug(
                    { id, tokenType: result.tokenType },
                    "Token is not ERC-20 type"
                );
                log.methodExit(this.logger, "findById", {
                    found: false,
                    wrongType: true,
                });
                return null;
            }

            const token = this.mapToToken(result);

            this.logger.debug({ id, symbol: token.symbol }, "ERC-20 token found");
            log.methodExit(this.logger, "findById", { id });
            return token;
        } catch (error) {
            log.methodError(this.logger, "findById", error as Error, { id });
            throw error;
        }
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
    override async create(
        input: CreateTokenInput<"erc20">
    ): Promise<Token<"erc20">> {
        log.methodEntry(this.logger, "create", {
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
                log.methodError(this.logger, "create", error, {
                    address: input.config.address,
                });
                throw error;
            }

            // Normalize address to EIP-55 checksum format
            const normalizedAddress = normalizeAddress(input.config.address);
            this.logger.debug(
                {
                    original: input.config.address,
                    normalized: normalizedAddress,
                },
                "Address normalized"
            );

            // Check if token already exists with same address and chainId
            log.dbOperation(this.logger, "findFirst", "Token", {
                address: normalizedAddress,
                chainId: input.config.chainId,
            });

            const existing = await this.prisma.token.findFirst({
                where: {
                    tokenType: "erc20",
                    config: {
                        path: ["address"],
                        equals: normalizedAddress,
                    },
                    AND: {
                        config: {
                            path: ["chainId"],
                            equals: input.config.chainId,
                        },
                    },
                },
            });

            // If token exists, return it
            if (existing) {
                this.logger.info(
                    {
                        id: existing.id,
                        address: normalizedAddress,
                        chainId: input.config.chainId,
                        symbol: existing.symbol,
                    },
                    "Token already exists, returning existing token"
                );
                log.methodExit(this.logger, "create", {
                    id: existing.id,
                    duplicate: true,
                });
                return this.mapToToken(existing);
            }

            // Create new token with normalized address
            const normalizedInput: CreateTokenInput<"erc20"> = {
                ...input,
                config: {
                    ...input.config,
                    address: normalizedAddress,
                },
            };

            const token = await super.create(normalizedInput);

            this.logger.info(
                {
                    id: token.id,
                    address: normalizedAddress,
                    chainId: input.config.chainId,
                    symbol: token.symbol,
                },
                "ERC-20 token created successfully"
            );

            log.methodExit(this.logger, "create", { id: token.id });
            return token;
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    error.message.includes("Invalid Ethereum address")
                )
            ) {
                log.methodError(this.logger, "create", error as Error, {
                    address: input.config.address,
                    chainId: input.config.chainId,
                });
            }
            throw error;
        }
    }

    /**
     * Update an existing ERC-20 token
     *
     * Validates token exists and is ERC-20 type.
     * If updating address, validates and normalizes to EIP-55 checksum format.
     *
     * @param id - Token database ID
     * @param input - Partial token data to update
     * @returns The updated token
     * @throws Error if token not found or not ERC-20 type
     * @throws Error if address format is invalid (when updating address)
     */
    override async update(
        id: string,
        input: UpdateTokenInput<"erc20">
    ): Promise<Token<"erc20">> {
        log.methodEntry(this.logger, "update", {
            id,
            fields: Object.keys(input),
        });

        try {
            // Verify token exists and is ERC-20 type
            log.dbOperation(this.logger, "findUnique", "Token", { id });

            const existing = await this.prisma.token.findUnique({
                where: { id },
            });

            if (!existing) {
                const error = new Error(`Token with id ${id} not found`);
                log.methodError(this.logger, "update", error, { id });
                throw error;
            }

            if (existing.tokenType !== "erc20") {
                const error = new Error(
                    `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
                );
                log.methodError(this.logger, "update", error, {
                    id,
                    tokenType: existing.tokenType,
                });
                throw error;
            }

            // If updating address, validate and normalize it
            let normalizedInput: UpdateTokenInput<"erc20"> = input;
            if (input.config?.address) {
                if (!isValidAddress(input.config.address)) {
                    const error = new Error(
                        `Invalid Ethereum address format: ${input.config.address}`
                    );
                    log.methodError(this.logger, "update", error, {
                        id,
                        address: input.config.address,
                    });
                    throw error;
                }
                const normalizedAddress = normalizeAddress(input.config.address);
                this.logger.debug(
                    {
                        original: input.config.address,
                        normalized: normalizedAddress,
                    },
                    "Address normalized for update"
                );
                normalizedInput = {
                    ...input,
                    config: {
                        ...input.config,
                        address: normalizedAddress,
                    },
                };
            }

            // Delegate to base class for update
            const token = await super.update(id, normalizedInput);

            this.logger.info(
                { id, symbol: token.symbol },
                "ERC-20 token updated successfully"
            );
            log.methodExit(this.logger, "update", { id });
            return token;
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    (error.message.includes("not found") ||
                        error.message.includes("not an ERC-20 token") ||
                        error.message.includes("Invalid Ethereum address"))
                )
            ) {
                log.methodError(this.logger, "update", error as Error, { id });
            }
            throw error;
        }
    }

    /**
     * Delete an ERC-20 token
     *
     * Validates token is ERC-20 type before deletion.
     * This operation is idempotent for non-existent tokens (returns silently),
     * but throws an error if attempting to delete a non-ERC-20 token (type safety).
     *
     * @param id - Token database ID
     * @throws Error if token exists but is not ERC-20 type
     */
    override async delete(id: string): Promise<void> {
        log.methodEntry(this.logger, "delete", { id });

        try {
            // Verify token exists and is ERC-20 type
            log.dbOperation(this.logger, "findUnique", "Token", { id });

            const existing = await this.prisma.token.findUnique({
                where: { id },
            });

            if (!existing) {
                this.logger.debug({ id }, "Token not found, nothing to delete");
                log.methodExit(this.logger, "delete", { id, found: false });
                return; // Idempotent: silently return if token doesn't exist
            }

            if (existing.tokenType !== "erc20") {
                const error = new Error(
                    `Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`
                );
                log.methodError(this.logger, "delete", error, {
                    id,
                    tokenType: existing.tokenType,
                });
                throw error;
            }

            // Delegate to base class for deletion
            await super.delete(id);

            this.logger.info(
                { id, symbol: existing.symbol },
                "ERC-20 token deleted successfully"
            );
            log.methodExit(this.logger, "delete", { id });
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    error.message.includes("not an ERC-20 token")
                )
            ) {
                log.methodError(this.logger, "delete", error as Error, { id });
            }
            throw error;
        }
    }

    // ============================================================================
    // DISCOVERY HELPERS
    // ============================================================================

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
    ): Promise<Token<"erc20"> | null> {
        log.methodEntry(this.logger, "findByAddressAndChain", { address, chainId });

        try {
            // Validate and normalize address
            if (!isValidAddress(address)) {
                const error = new Error(`Invalid Ethereum address format: ${address}`);
                log.methodError(this.logger, "findByAddressAndChain", error, { address });
                throw error;
            }
            const normalizedAddress = normalizeAddress(address);

            // Query database with JSON path
            log.dbOperation(this.logger, "findFirst", "Token", {
                address: normalizedAddress,
                chainId,
            });

            const result = await this.prisma.token.findFirst({
                where: {
                    tokenType: "erc20",
                    config: {
                        path: ["address"],
                        equals: normalizedAddress,
                    },
                    AND: {
                        config: {
                            path: ["chainId"],
                            equals: chainId,
                        },
                    },
                },
            });

            if (!result) {
                this.logger.debug({ address: normalizedAddress, chainId }, "Token not found");
                log.methodExit(this.logger, "findByAddressAndChain", { found: false });
                return null;
            }

            this.logger.debug(
                { id: result.id, address: normalizedAddress, chainId, symbol: result.symbol },
                "Token found"
            );
            log.methodExit(this.logger, "findByAddressAndChain", { id: result.id });
            return this.mapToToken(result);
        } catch (error) {
            if (!(error instanceof Error && error.message.includes("Invalid Ethereum address"))) {
                log.methodError(this.logger, "findByAddressAndChain", error as Error, {
                    address,
                    chainId,
                });
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
     * @throws CoinGeckoApiError if CoinGecko API request fails
     */
    async enrichToken(tokenId: string): Promise<Token<"erc20">> {
        log.methodEntry(this.logger, "enrichToken", { tokenId });

        try {
            // Load and verify token
            log.dbOperation(this.logger, "findUnique", "Token", { id: tokenId });

            const existing = await this.prisma.token.findUnique({
                where: { id: tokenId },
            });

            if (!existing) {
                const error = new Error(`Token with id ${tokenId} not found`);
                log.methodError(this.logger, "enrichToken", error, { tokenId });
                throw error;
            }

            if (existing.tokenType !== "erc20") {
                const error = new Error(
                    `Token ${tokenId} is not an ERC-20 token (type: ${existing.tokenType})`
                );
                log.methodError(this.logger, "enrichToken", error, {
                    tokenId,
                    tokenType: existing.tokenType,
                });
                throw error;
            }

            // Skip if already enriched (idempotent)
            if (existing.coingeckoId) {
                this.logger.info(
                    { tokenId, coingeckoId: existing.coingeckoId, symbol: existing.symbol },
                    "Token already enriched, skipping CoinGecko API call"
                );
                log.methodExit(this.logger, "enrichToken", { tokenId, alreadyEnriched: true });
                return this.mapToToken(existing);
            }

            // Extract config
            const config = existing.config as { address: string; chainId: number };
            const { address, chainId } = config;

            this.logger.debug(
                { tokenId, address, chainId, symbol: existing.symbol },
                "Fetching enrichment data from CoinGecko"
            );

            // Fetch from CoinGecko (errors bubble up - enrichment is mandatory)
            const enrichmentData = await this.coinGeckoClient.getErc20EnrichmentData(
                chainId,
                address
            );

            // Update token in database
            log.dbOperation(this.logger, "update", "Token", {
                id: tokenId,
                fields: ["logoUrl", "coingeckoId", "marketCap"],
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
                "Token enriched successfully with CoinGecko data"
            );

            log.methodExit(this.logger, "enrichToken", {
                tokenId,
                coingeckoId: enrichmentData.coingeckoId,
            });
            return this.mapToToken(updated);
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    (error.message.includes("not found") ||
                        error.message.includes("not an ERC-20 token"))
                )
            ) {
                log.methodError(this.logger, "enrichToken", error as Error, { tokenId });
            }
            throw error;
        }
    }

    // ============================================================================
    // SEARCH OPERATIONS
    // ============================================================================

    /**
     * Search for ERC-20 tokens by symbol and/or name within a specific chain
     *
     * Returns up to 10 matching tokens, ordered alphabetically by symbol.
     * Users should provide more specific search terms if they need fewer results.
     *
     * @param params.chainId - Chain ID (REQUIRED)
     * @param params.symbol - Partial symbol match (optional, case-insensitive)
     * @param params.name - Partial name match (optional, case-insensitive)
     * @returns Array of matching tokens (max 10)
     * @throws Error if neither symbol nor name provided
     */
    async searchTokens(params: {
        chainId: number;
        symbol?: string;
        name?: string;
    }): Promise<Token<"erc20">[]> {
        const { chainId, symbol, name } = params;
        log.methodEntry(this.logger, "searchTokens", { chainId, symbol, name });

        try {
            // Validate at least one search term provided
            if (!symbol && !name) {
                const error = new Error(
                    "At least one search parameter (symbol or name) must be provided"
                );
                log.methodError(this.logger, "searchTokens", error, { chainId });
                throw error;
            }

            // Build where clause
            const where: any = {
                tokenType: "erc20",
                config: {
                    path: ["chainId"],
                    equals: chainId,
                },
            };

            // Add symbol filter if provided
            if (symbol) {
                where.symbol = {
                    contains: symbol,
                    mode: "insensitive",
                };
            }

            // Add name filter if provided
            if (name) {
                where.name = {
                    contains: name,
                    mode: "insensitive",
                };
            }

            this.logger.debug(
                { chainId, symbol, name },
                "Searching tokens with filters"
            );

            log.dbOperation(this.logger, "findMany", "Token", {
                chainId,
                symbol,
                name,
                limit: 10,
            });

            // Execute query
            const results = await this.prisma.token.findMany({
                where,
                orderBy: {
                    symbol: "asc",
                },
                take: 10,
            });

            // Map to Token<'erc20'>[]
            const tokens = results.map((result) => this.mapToToken(result));

            this.logger.info(
                { chainId, symbol, name, count: tokens.length },
                "Token search completed"
            );

            log.methodExit(this.logger, "searchTokens", {
                count: tokens.length,
            });

            return tokens;
        } catch (error) {
            // Only log if not already logged
            if (
                !(
                    error instanceof Error &&
                    error.message.includes("At least one search parameter")
                )
            ) {
                log.methodError(this.logger, "searchTokens", error as Error, {
                    chainId,
                    symbol,
                    name,
                });
            }
            throw error;
        }
    }
}
