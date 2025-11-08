import { isValidAddress, normalizeAddress } from '@midcurve/shared';
import { TokenService } from "./token-service.js";
import { readTokenMetadata, TokenMetadataError, } from "../../utils/evm/index.js";
import { EvmConfig } from "../../config/evm.js";
import { CoinGeckoClient } from "../../clients/coingecko/index.js";
import { log } from "../../logging/index.js";
export class Erc20TokenService extends TokenService {
    _evmConfig;
    _coinGeckoClient;
    constructor(dependencies = {}) {
        super(dependencies);
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this._coinGeckoClient =
            dependencies.coinGeckoClient ?? CoinGeckoClient.getInstance();
    }
    get evmConfig() {
        return this._evmConfig;
    }
    get coinGeckoClient() {
        return this._coinGeckoClient;
    }
    parseConfig(configDB) {
        const db = configDB;
        return {
            address: db.address,
            chainId: db.chainId,
        };
    }
    serializeConfig(config) {
        return {
            address: config.address,
            chainId: config.chainId,
        };
    }
    async discover(params) {
        const { address, chainId } = params;
        log.methodEntry(this.logger, "discover", { address, chainId });
        try {
            if (!isValidAddress(address)) {
                const error = new Error(`Invalid Ethereum address format: ${address}`);
                log.methodError(this.logger, "discover", error, { address, chainId });
                throw error;
            }
            const normalizedAddress = normalizeAddress(address);
            this.logger.debug({ original: address, normalized: normalizedAddress }, "Address normalized for discovery");
            const existing = await this.findByAddressAndChain(normalizedAddress, chainId);
            if (existing) {
                if (existing.coingeckoId) {
                    this.logger.info({
                        id: existing.id,
                        address: normalizedAddress,
                        chainId,
                        symbol: existing.symbol,
                    }, "Token already exists with CoinGecko data, skipping on-chain discovery");
                    log.methodExit(this.logger, "discover", { id: existing.id, fromDatabase: true });
                    return existing;
                }
                this.logger.info({ id: existing.id, symbol: existing.symbol }, "Token exists but needs CoinGecko enrichment");
                const enriched = await this.enrichToken(existing.id);
                log.methodExit(this.logger, "discover", { id: enriched.id, enriched: true });
                return enriched;
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(", ")}`);
                log.methodError(this.logger, "discover", error, { chainId });
                throw error;
            }
            this.logger.debug({ chainId }, "Chain is supported, proceeding with on-chain discovery");
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({ address: normalizedAddress, chainId }, "Reading token metadata from contract");
            let metadata;
            try {
                metadata = await readTokenMetadata(client, normalizedAddress);
            }
            catch (error) {
                if (error instanceof TokenMetadataError) {
                    log.methodError(this.logger, "discover", error, {
                        address: normalizedAddress,
                        chainId,
                    });
                    throw error;
                }
                const wrappedError = new Error(`Failed to read token metadata from contract at ${normalizedAddress} on chain ${chainId}: ${error instanceof Error ? error.message : String(error)}`);
                log.methodError(this.logger, "discover", wrappedError, {
                    address: normalizedAddress,
                    chainId,
                });
                throw wrappedError;
            }
            this.logger.info({
                address: normalizedAddress,
                chainId,
                name: metadata.name,
                symbol: metadata.symbol,
                decimals: metadata.decimals,
            }, "Token metadata discovered from contract");
            this.logger.debug({ address: normalizedAddress, chainId }, "Fetching CoinGecko enrichment data");
            const enrichmentData = await this.coinGeckoClient.getErc20EnrichmentData(chainId, normalizedAddress);
            this.logger.info({
                coingeckoId: enrichmentData.coingeckoId,
                marketCap: enrichmentData.marketCap,
            }, "CoinGecko enrichment data fetched");
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
            this.logger.info({ id: token.id, address: normalizedAddress, chainId, symbol: token.symbol }, "Token discovered and created successfully");
            log.methodExit(this.logger, "discover", { id: token.id, fromBlockchain: true });
            return token;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("Invalid Ethereum address") ||
                    error.message.includes("not configured") ||
                    error instanceof TokenMetadataError ||
                    error.message.includes("Failed to read token metadata")))) {
                log.methodError(this.logger, "discover", error, { address, chainId });
            }
            throw error;
        }
    }
    async findById(id) {
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
            if (result.tokenType !== "erc20") {
                this.logger.debug({ id, tokenType: result.tokenType }, "Token is not ERC-20 type");
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
        }
        catch (error) {
            log.methodError(this.logger, "findById", error, { id });
            throw error;
        }
    }
    async create(input) {
        log.methodEntry(this.logger, "create", {
            address: input.config.address,
            chainId: input.config.chainId,
            symbol: input.symbol,
        });
        try {
            if (!isValidAddress(input.config.address)) {
                const error = new Error(`Invalid Ethereum address format: ${input.config.address}`);
                log.methodError(this.logger, "create", error, {
                    address: input.config.address,
                });
                throw error;
            }
            const normalizedAddress = normalizeAddress(input.config.address);
            this.logger.debug({
                original: input.config.address,
                normalized: normalizedAddress,
            }, "Address normalized");
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
            if (existing) {
                this.logger.info({
                    id: existing.id,
                    address: normalizedAddress,
                    chainId: input.config.chainId,
                    symbol: existing.symbol,
                }, "Token already exists, returning existing token");
                log.methodExit(this.logger, "create", {
                    id: existing.id,
                    duplicate: true,
                });
                return this.mapToToken(existing);
            }
            const normalizedInput = {
                ...input,
                config: {
                    ...input.config,
                    address: normalizedAddress,
                },
            };
            const token = await super.create(normalizedInput);
            this.logger.info({
                id: token.id,
                address: normalizedAddress,
                chainId: input.config.chainId,
                symbol: token.symbol,
            }, "ERC-20 token created successfully");
            log.methodExit(this.logger, "create", { id: token.id });
            return token;
        }
        catch (error) {
            if (!(error instanceof Error &&
                error.message.includes("Invalid Ethereum address"))) {
                log.methodError(this.logger, "create", error, {
                    address: input.config.address,
                    chainId: input.config.chainId,
                });
            }
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, "update", {
            id,
            fields: Object.keys(input),
        });
        try {
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
                const error = new Error(`Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`);
                log.methodError(this.logger, "update", error, {
                    id,
                    tokenType: existing.tokenType,
                });
                throw error;
            }
            let normalizedInput = input;
            if (input.config?.address) {
                if (!isValidAddress(input.config.address)) {
                    const error = new Error(`Invalid Ethereum address format: ${input.config.address}`);
                    log.methodError(this.logger, "update", error, {
                        id,
                        address: input.config.address,
                    });
                    throw error;
                }
                const normalizedAddress = normalizeAddress(input.config.address);
                this.logger.debug({
                    original: input.config.address,
                    normalized: normalizedAddress,
                }, "Address normalized for update");
                normalizedInput = {
                    ...input,
                    config: {
                        ...input.config,
                        address: normalizedAddress,
                    },
                };
            }
            const token = await super.update(id, normalizedInput);
            this.logger.info({ id, symbol: token.symbol }, "ERC-20 token updated successfully");
            log.methodExit(this.logger, "update", { id });
            return token;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("not found") ||
                    error.message.includes("not an ERC-20 token") ||
                    error.message.includes("Invalid Ethereum address")))) {
                log.methodError(this.logger, "update", error, { id });
            }
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, "delete", { id });
        try {
            log.dbOperation(this.logger, "findUnique", "Token", { id });
            const existing = await this.prisma.token.findUnique({
                where: { id },
            });
            if (!existing) {
                this.logger.debug({ id }, "Token not found, nothing to delete");
                log.methodExit(this.logger, "delete", { id, found: false });
                return;
            }
            if (existing.tokenType !== "erc20") {
                const error = new Error(`Token ${id} is not an ERC-20 token (type: ${existing.tokenType})`);
                log.methodError(this.logger, "delete", error, {
                    id,
                    tokenType: existing.tokenType,
                });
                throw error;
            }
            await super.delete(id);
            this.logger.info({ id, symbol: existing.symbol }, "ERC-20 token deleted successfully");
            log.methodExit(this.logger, "delete", { id });
        }
        catch (error) {
            if (!(error instanceof Error &&
                error.message.includes("not an ERC-20 token"))) {
                log.methodError(this.logger, "delete", error, { id });
            }
            throw error;
        }
    }
    async findByAddressAndChain(address, chainId) {
        log.methodEntry(this.logger, "findByAddressAndChain", { address, chainId });
        try {
            if (!isValidAddress(address)) {
                const error = new Error(`Invalid Ethereum address format: ${address}`);
                log.methodError(this.logger, "findByAddressAndChain", error, { address });
                throw error;
            }
            const normalizedAddress = normalizeAddress(address);
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
            this.logger.debug({ id: result.id, address: normalizedAddress, chainId, symbol: result.symbol }, "Token found");
            log.methodExit(this.logger, "findByAddressAndChain", { id: result.id });
            return this.mapToToken(result);
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes("Invalid Ethereum address"))) {
                log.methodError(this.logger, "findByAddressAndChain", error, {
                    address,
                    chainId,
                });
            }
            throw error;
        }
    }
    async enrichToken(tokenId) {
        log.methodEntry(this.logger, "enrichToken", { tokenId });
        try {
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
                const error = new Error(`Token ${tokenId} is not an ERC-20 token (type: ${existing.tokenType})`);
                log.methodError(this.logger, "enrichToken", error, {
                    tokenId,
                    tokenType: existing.tokenType,
                });
                throw error;
            }
            if (existing.coingeckoId) {
                this.logger.info({ tokenId, coingeckoId: existing.coingeckoId, symbol: existing.symbol }, "Token already enriched, skipping CoinGecko API call");
                log.methodExit(this.logger, "enrichToken", { tokenId, alreadyEnriched: true });
                return this.mapToToken(existing);
            }
            const config = existing.config;
            const { address, chainId } = config;
            this.logger.debug({ tokenId, address, chainId, symbol: existing.symbol }, "Fetching enrichment data from CoinGecko");
            const enrichmentData = await this.coinGeckoClient.getErc20EnrichmentData(chainId, address);
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
            this.logger.info({
                tokenId,
                coingeckoId: enrichmentData.coingeckoId,
                symbol: updated.symbol,
                marketCap: enrichmentData.marketCap,
            }, "Token enriched successfully with CoinGecko data");
            log.methodExit(this.logger, "enrichToken", {
                tokenId,
                coingeckoId: enrichmentData.coingeckoId,
            });
            return this.mapToToken(updated);
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("not found") ||
                    error.message.includes("not an ERC-20 token")))) {
                log.methodError(this.logger, "enrichToken", error, { tokenId });
            }
            throw error;
        }
    }
    async searchTokens(input) {
        const { chainId, symbol, name, address } = input;
        log.methodEntry(this.logger, "searchTokens", { chainId, symbol, name, address });
        try {
            if (!symbol && !name && !address) {
                const error = new Error("At least one search parameter (symbol, name, or address) must be provided");
                log.methodError(this.logger, "searchTokens", error, { chainId });
                throw error;
            }
            let normalizedAddress;
            if (address) {
                if (!isValidAddress(address)) {
                    const error = new Error(`Invalid Ethereum address format: ${address}`);
                    log.methodError(this.logger, "searchTokens", error, { chainId, address });
                    throw error;
                }
                normalizedAddress = normalizeAddress(address);
                this.logger.debug({ original: address, normalized: normalizedAddress }, "Address normalized for search");
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(", ")}`);
                log.methodError(this.logger, "searchTokens", error, { chainId });
                throw error;
            }
            const platformId = this.getPlatformId(chainId);
            if (!platformId) {
                const error = new Error(`No CoinGecko platform mapping for chain ${chainId}`);
                log.methodError(this.logger, "searchTokens", error, { chainId });
                throw error;
            }
            this.logger.debug({ chainId, symbol, name, address: normalizedAddress }, "Searching database for tokens");
            const where = {
                tokenType: "erc20",
                config: {
                    path: ["chainId"],
                    equals: chainId,
                },
            };
            if (symbol && name) {
                where.OR = [
                    {
                        symbol: {
                            contains: symbol,
                            mode: "insensitive",
                        },
                    },
                    {
                        name: {
                            contains: name,
                            mode: "insensitive",
                        },
                    },
                ];
            }
            else if (symbol) {
                where.symbol = {
                    contains: symbol,
                    mode: "insensitive",
                };
            }
            else if (name) {
                where.name = {
                    contains: name,
                    mode: "insensitive",
                };
            }
            if (normalizedAddress) {
                where.AND = {
                    config: {
                        path: ["address"],
                        equals: normalizedAddress,
                    },
                };
            }
            log.dbOperation(this.logger, "findMany", "Token", {
                chainId,
                symbol,
                name,
                address: normalizedAddress,
                limit: 10,
            });
            const dbTokens = await this.prisma.token.findMany({
                where,
                orderBy: [
                    { marketCap: { sort: "desc", nulls: "last" } },
                    { symbol: "asc" },
                ],
                take: 10,
            });
            const dbCandidates = dbTokens.map((token) => {
                const config = token.config;
                return {
                    coingeckoId: token.coingeckoId || "",
                    symbol: token.symbol,
                    name: token.name,
                    address: config.address,
                    chainId: config.chainId,
                    logoUrl: token.logoUrl || undefined,
                    marketCap: token.marketCap || undefined,
                };
            });
            this.logger.info({ chainId, symbol, name, address: normalizedAddress, dbCount: dbCandidates.length }, "Database search completed");
            let coinGeckoToAdd = [];
            if (dbCandidates.length < 10) {
                this.logger.debug({ chainId, platformId, symbol, name, address: normalizedAddress }, "Searching CoinGecko for additional tokens");
                const coinGeckoResults = await this.coinGeckoClient.searchTokens({
                    platform: platformId,
                    symbol,
                    name,
                    address: normalizedAddress,
                });
                const dbAddresses = new Set(dbCandidates.map((c) => c.address.toLowerCase()));
                const uniqueCoinGeckoResults = coinGeckoResults.filter((cgToken) => !dbAddresses.has(cgToken.address.toLowerCase()));
                const remainingSlots = 10 - dbCandidates.length;
                const coinGeckoFiltered = uniqueCoinGeckoResults.slice(0, remainingSlots);
                coinGeckoToAdd = coinGeckoFiltered.map((result) => ({
                    coingeckoId: result.coingeckoId,
                    symbol: result.symbol,
                    name: result.name,
                    address: result.address,
                    chainId,
                }));
                this.logger.info({
                    chainId,
                    platformId,
                    coinGeckoTotal: coinGeckoResults.length,
                    coinGeckoUnique: uniqueCoinGeckoResults.length,
                    coinGeckoAdded: coinGeckoToAdd.length,
                }, "CoinGecko search completed");
            }
            else {
                this.logger.debug({ dbCount: dbCandidates.length }, "Skipping CoinGecko search (DB has 10+ results)");
            }
            const candidates = [
                ...dbCandidates,
                ...coinGeckoToAdd,
            ];
            this.logger.info({
                chainId,
                symbol,
                name,
                address: normalizedAddress,
                dbCount: dbCandidates.length,
                coinGeckoCount: coinGeckoToAdd.length,
                totalCount: candidates.length,
            }, "Token search completed (DB + CoinGecko)");
            log.methodExit(this.logger, "searchTokens", {
                count: candidates.length,
            });
            return candidates;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("At least one search parameter") ||
                    error.message.includes("not configured") ||
                    error.message.includes("No CoinGecko platform mapping") ||
                    error.message.includes("Invalid Ethereum address")))) {
                log.methodError(this.logger, "searchTokens", error, {
                    chainId,
                    symbol,
                    name,
                    address,
                });
            }
            throw error;
        }
    }
    getPlatformId(chainId) {
        const mapping = {
            1: "ethereum",
            42161: "arbitrum-one",
            8453: "base",
            56: "binance-smart-chain",
            137: "polygon-pos",
            10: "optimistic-ethereum",
        };
        return mapping[chainId] || null;
    }
}
//# sourceMappingURL=erc20-token-service.js.map