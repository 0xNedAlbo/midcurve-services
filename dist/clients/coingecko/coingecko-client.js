import { createServiceLogger, log } from '../../logging/index.js';
import { CacheService } from '../../services/cache/index.js';
import { RequestScheduler } from '../../utils/request-scheduler/index.js';
import { getAddress, isAddress } from 'viem';
export class TokenNotFoundInCoinGeckoError extends Error {
    constructor(chainId, address) {
        super(`Token not found in CoinGecko for chain ${chainId} and address ${address}`);
        this.name = 'TokenNotFoundInCoinGeckoError';
    }
}
export class CoinGeckoApiError extends Error {
    statusCode;
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.name = 'CoinGeckoApiError';
    }
}
export class CoinGeckoClient {
    static instance = null;
    baseUrl = 'https://api.coingecko.com/api/v3';
    cacheService;
    requestScheduler;
    cacheTimeout = 3600;
    logger;
    chainIdToPlatformId = {
        1: 'ethereum',
        42161: 'arbitrum-one',
        8453: 'base',
        56: 'binance-smart-chain',
        137: 'polygon-pos',
        10: 'optimistic-ethereum',
    };
    constructor(dependencies = {}) {
        this.logger = createServiceLogger('CoinGeckoClient');
        this.cacheService = dependencies.cacheService ?? CacheService.getInstance();
        this.requestScheduler =
            dependencies.requestScheduler ??
                new RequestScheduler({
                    minSpacingMs: 2200,
                    name: 'CoinGeckoScheduler',
                });
    }
    static getInstance() {
        if (!CoinGeckoClient.instance) {
            CoinGeckoClient.instance = new CoinGeckoClient();
        }
        return CoinGeckoClient.instance;
    }
    static resetInstance() {
        CoinGeckoClient.instance = null;
    }
    async scheduledFetch(url) {
        return this.requestScheduler.schedule(async () => {
            const maxRetries = 6;
            const baseDelayMs = 800;
            const maxDelayMs = 8000;
            for (let attempt = 0; attempt <= maxRetries; attempt++) {
                try {
                    const response = await fetch(url);
                    if (response.ok) {
                        return response;
                    }
                    const isRetryable = response.status === 429 || (response.status >= 500 && response.status < 600);
                    if (!isRetryable || attempt >= maxRetries) {
                        return response;
                    }
                    const retryAfterHeader = response.headers.get('Retry-After');
                    let delay;
                    if (retryAfterHeader) {
                        const retryAfterSeconds = Number(retryAfterHeader);
                        if (!isNaN(retryAfterSeconds)) {
                            delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterSeconds * 1000));
                        }
                        else {
                            const retryAfterDate = new Date(retryAfterHeader);
                            delay = Math.min(maxDelayMs, Math.max(baseDelayMs, retryAfterDate.getTime() - Date.now()));
                        }
                    }
                    else {
                        delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
                    }
                    delay += Math.floor(Math.random() * 200);
                    this.logger.warn({
                        attempt: attempt + 1,
                        maxRetries,
                        status: response.status,
                        delay,
                        hasRetryAfter: !!retryAfterHeader,
                    }, 'Retryable error, backing off');
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                catch (error) {
                    if (attempt >= maxRetries) {
                        throw error;
                    }
                    const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
                    const jitter = Math.floor(Math.random() * 200);
                    this.logger.warn({ attempt: attempt + 1, delay: delay + jitter, error }, 'Network error, retrying with backoff');
                    await new Promise((resolve) => setTimeout(resolve, delay + jitter));
                }
            }
            throw new Error('Unexpected end of retry loop');
        });
    }
    async getAllTokens() {
        log.methodEntry(this.logger, 'getAllTokens');
        const cacheKey = 'coingecko:tokens:all';
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'getAllTokens', cacheKey);
            log.methodExit(this.logger, 'getAllTokens', {
                count: cached.length,
                fromCache: true,
            });
            return cached;
        }
        log.cacheMiss(this.logger, 'getAllTokens', cacheKey);
        try {
            log.externalApiCall(this.logger, 'CoinGecko', '/coins/list', { include_platform: true });
            const response = await this.scheduledFetch(`${this.baseUrl}/coins/list?include_platform=true`);
            if (!response.ok) {
                const error = new CoinGeckoApiError(`CoinGecko API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'getAllTokens', error, {
                    statusCode: response.status,
                });
                throw error;
            }
            const allTokens = (await response.json());
            this.logger.debug({ totalTokens: allTokens.length }, 'Received tokens from CoinGecko API');
            const supportedPlatformIds = Object.values(this.chainIdToPlatformId);
            const filteredTokens = allTokens.filter((token) => {
                return supportedPlatformIds.some((platformId) => token.platforms[platformId] &&
                    token.platforms[platformId].trim() !== '');
            });
            this.logger.info({
                totalTokens: allTokens.length,
                filteredTokens: filteredTokens.length,
            }, 'Filtered tokens for supported chains');
            await this.cacheService.set(cacheKey, filteredTokens, this.cacheTimeout);
            log.methodExit(this.logger, 'getAllTokens', {
                count: filteredTokens.length,
                fromCache: false,
            });
            return filteredTokens;
        }
        catch (error) {
            if (error instanceof CoinGeckoApiError) {
                throw error;
            }
            const wrappedError = new CoinGeckoApiError(`Failed to fetch tokens from CoinGecko: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'getAllTokens', wrappedError);
            throw wrappedError;
        }
    }
    async findCoinByAddress(chainId, address) {
        log.methodEntry(this.logger, 'findCoinByAddress', {
            chainId,
            address,
        });
        const tokens = await this.getAllTokens();
        const platformId = this.chainIdToPlatformId[chainId];
        if (!platformId) {
            this.logger.debug({ chainId }, 'Chain not supported');
            log.methodExit(this.logger, 'findCoinByAddress', {
                found: false,
            });
            return null;
        }
        const normalizedAddress = address.toLowerCase();
        const token = tokens.find((token) => token.platforms[platformId] &&
            token.platforms[platformId].toLowerCase() === normalizedAddress);
        if (token) {
            this.logger.debug({ chainId, address, coinId: token.id }, 'Token found in CoinGecko');
        }
        else {
            this.logger.debug({ chainId, address }, 'Token not found in CoinGecko');
        }
        log.methodExit(this.logger, 'findCoinByAddress', {
            coinId: token?.id || null,
        });
        return token ? token.id : null;
    }
    async getCoinDetails(coinId) {
        log.methodEntry(this.logger, 'getCoinDetails', { coinId });
        const cacheKey = `coingecko:coin:${coinId}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'getCoinDetails', cacheKey);
            log.methodExit(this.logger, 'getCoinDetails', {
                coinId: cached.id,
                fromCache: true,
            });
            return cached;
        }
        log.cacheMiss(this.logger, 'getCoinDetails', cacheKey);
        try {
            log.externalApiCall(this.logger, 'CoinGecko', `/coins/${coinId}`, {
                market_data: true,
            });
            const response = await this.scheduledFetch(`${this.baseUrl}/coins/${coinId}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
            if (!response.ok) {
                const error = new CoinGeckoApiError(`CoinGecko API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'getCoinDetails', error, {
                    coinId,
                    statusCode: response.status,
                });
                throw error;
            }
            const coin = (await response.json());
            this.logger.debug({ coinId, symbol: coin.symbol, name: coin.name }, 'Retrieved coin details');
            await this.cacheService.set(cacheKey, coin, this.cacheTimeout);
            log.methodExit(this.logger, 'getCoinDetails', {
                coinId: coin.id,
                fromCache: false,
            });
            return coin;
        }
        catch (error) {
            if (error instanceof CoinGeckoApiError) {
                throw error;
            }
            const wrappedError = new CoinGeckoApiError(`Failed to fetch coin details for ${coinId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'getCoinDetails', wrappedError, {
                coinId,
            });
            throw wrappedError;
        }
    }
    async getCoinsMarketData(coinIds) {
        log.methodEntry(this.logger, 'getCoinsMarketData', { coinIds, count: coinIds.length });
        if (coinIds.length === 0) {
            log.methodExit(this.logger, 'getCoinsMarketData', { count: 0 });
            return [];
        }
        const sortedIds = [...coinIds].sort();
        const cacheKey = `coingecko:markets:${sortedIds.join(',')}`;
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'getCoinsMarketData', cacheKey);
            log.methodExit(this.logger, 'getCoinsMarketData', {
                count: cached.length,
                fromCache: true,
            });
            return cached;
        }
        log.cacheMiss(this.logger, 'getCoinsMarketData', cacheKey);
        try {
            const idsParam = coinIds.join(',');
            log.externalApiCall(this.logger, 'CoinGecko', '/coins/markets', {
                ids: idsParam,
                vs_currency: 'usd',
            });
            const response = await this.scheduledFetch(`${this.baseUrl}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(idsParam)}&per_page=250`);
            if (!response.ok) {
                const error = new CoinGeckoApiError(`CoinGecko API error: ${response.status} ${response.statusText}`, response.status);
                log.methodError(this.logger, 'getCoinsMarketData', error, {
                    coinIds,
                    statusCode: response.status,
                });
                throw error;
            }
            const marketData = (await response.json());
            this.logger.debug({ requestedCount: coinIds.length, receivedCount: marketData.length }, 'Retrieved market data from CoinGecko API');
            await this.cacheService.set(cacheKey, marketData, this.cacheTimeout);
            log.methodExit(this.logger, 'getCoinsMarketData', {
                count: marketData.length,
                fromCache: false,
            });
            return marketData;
        }
        catch (error) {
            if (error instanceof CoinGeckoApiError) {
                throw error;
            }
            const wrappedError = new CoinGeckoApiError(`Failed to fetch market data for coins: ${error instanceof Error ? error.message : 'Unknown error'}`);
            log.methodError(this.logger, 'getCoinsMarketData', wrappedError, { coinIds });
            throw wrappedError;
        }
    }
    async getErc20EnrichmentData(chainId, address) {
        log.methodEntry(this.logger, 'getErc20EnrichmentData', {
            chainId,
            address,
        });
        try {
            const coinId = await this.findCoinByAddress(chainId, address);
            if (!coinId) {
                const error = new TokenNotFoundInCoinGeckoError(chainId, address);
                log.methodError(this.logger, 'getErc20EnrichmentData', error, { chainId, address });
                throw error;
            }
            this.logger.info({ chainId, address, coinId }, 'Found token in CoinGecko, fetching enrichment data');
            const coinDetails = await this.getCoinDetails(coinId);
            const marketCapUsd = coinDetails.market_data?.market_cap?.usd;
            if (!marketCapUsd || marketCapUsd <= 0) {
                const error = new CoinGeckoApiError(`Market cap data not available for ${coinId}`);
                log.methodError(this.logger, 'getErc20EnrichmentData', error, { coinId, chainId, address });
                throw error;
            }
            const enrichmentData = {
                coingeckoId: coinId,
                logoUrl: coinDetails.image.small,
                marketCap: marketCapUsd,
                symbol: coinDetails.symbol.toUpperCase(),
                name: coinDetails.name,
            };
            this.logger.info({
                chainId,
                address,
                coingeckoId: enrichmentData.coingeckoId,
                symbol: enrichmentData.symbol,
                marketCap: enrichmentData.marketCap,
            }, 'Successfully enriched token data');
            log.methodExit(this.logger, 'getErc20EnrichmentData', {
                coingeckoId: enrichmentData.coingeckoId,
            });
            return enrichmentData;
        }
        catch (error) {
            throw error;
        }
    }
    async clearCache() {
        return await this.cacheService.clear('coingecko:');
    }
    async hasCachedData() {
        const cached = await this.cacheService.get('coingecko:tokens:all');
        return cached !== null;
    }
    getSupportedChainIds() {
        return Object.keys(this.chainIdToPlatformId).map(Number);
    }
    isChainSupported(chainId) {
        return chainId in this.chainIdToPlatformId;
    }
    async searchTokens(params) {
        const { platform, symbol, name, address } = params;
        log.methodEntry(this.logger, 'searchTokens', { platform, symbol, name, address });
        try {
            if (!symbol && !name && !address) {
                const error = new Error('At least one search parameter (symbol, name, or address) must be provided');
                log.methodError(this.logger, 'searchTokens', error, { platform });
                throw error;
            }
            const allTokens = await this.getAllTokens();
            const normalizedSymbol = symbol?.toLowerCase();
            const normalizedName = name?.toLowerCase();
            const normalizedAddress = address?.toLowerCase();
            const matchingTokens = allTokens
                .filter((token) => {
                const tokenAddress = token.platforms[platform];
                if (!tokenAddress || tokenAddress.trim() === '') {
                    return false;
                }
                if (normalizedAddress) {
                    const tokenAddressLower = tokenAddress.toLowerCase();
                    if (tokenAddressLower !== normalizedAddress) {
                        return false;
                    }
                }
                if (normalizedSymbol) {
                    const tokenSymbol = token.symbol.toLowerCase();
                    if (!tokenSymbol.includes(normalizedSymbol)) {
                        return false;
                    }
                }
                if (normalizedName) {
                    const tokenName = token.name.toLowerCase();
                    if (!tokenName.includes(normalizedName)) {
                        return false;
                    }
                }
                return true;
            })
                .slice(0, 10)
                .sort((a, b) => a.symbol.localeCompare(b.symbol))
                .map((token) => {
                const rawAddress = token.platforms[platform];
                let checksummedAddress = rawAddress;
                if (isAddress(rawAddress)) {
                    try {
                        checksummedAddress = getAddress(rawAddress);
                    }
                    catch (error) {
                        this.logger.warn({ address: rawAddress, error }, 'Failed to checksum address from CoinGecko');
                    }
                }
                return {
                    coingeckoId: token.id,
                    symbol: token.symbol.toUpperCase(),
                    name: token.name,
                    address: checksummedAddress,
                };
            });
            this.logger.info({ platform, symbol, name, address, count: matchingTokens.length }, 'Token search completed');
            log.methodExit(this.logger, 'searchTokens', {
                count: matchingTokens.length,
            });
            return matchingTokens;
        }
        catch (error) {
            if (!(error instanceof Error &&
                error.message.includes('At least one search parameter'))) {
                log.methodError(this.logger, 'searchTokens', error, {
                    platform,
                    symbol,
                    name,
                    address,
                });
            }
            throw error;
        }
    }
}
//# sourceMappingURL=coingecko-client.js.map