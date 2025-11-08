import crypto from 'crypto';
import { createServiceLogger, log } from '../../../logging/index.js';
import { CacheService } from '../../../services/cache/index.js';
import { normalizeAddress } from '@midcurve/shared';
import { getUniswapV3SubgraphEndpoint, isUniswapV3SubgraphSupported, getSupportedUniswapV3SubgraphChains, } from '../../../config/uniswapv3-subgraph.js';
import { POOL_METRICS_QUERY, POOL_FEE_DATA_QUERY, } from './queries.js';
export class UniswapV3SubgraphClient {
    static instance = null;
    cacheService;
    fetchFn;
    cacheTtl = 300;
    logger;
    constructor(dependencies = {}) {
        this.logger = createServiceLogger('UniswapV3SubgraphClient');
        this.cacheService = dependencies.cacheService ?? CacheService.getInstance();
        this.fetchFn = dependencies.fetch ?? fetch;
        this.logger.debug('UniswapV3SubgraphClient initialized');
    }
    static getInstance() {
        if (!UniswapV3SubgraphClient.instance) {
            UniswapV3SubgraphClient.instance = new UniswapV3SubgraphClient();
        }
        return UniswapV3SubgraphClient.instance;
    }
    static resetInstance() {
        UniswapV3SubgraphClient.instance = null;
    }
    async query(chainId, query, variables) {
        log.methodEntry(this.logger, 'query', { chainId, variables });
        if (!isUniswapV3SubgraphSupported(chainId)) {
            const error = new Error(`Uniswap V3 subgraph not available for chain ${chainId}. ` +
                `Supported chains: ${getSupportedUniswapV3SubgraphChains().join(', ')}`);
            error.name = 'UniswapV3SubgraphApiError';
            log.methodError(this.logger, 'query', error, { chainId });
            throw error;
        }
        const cacheKey = this.buildCacheKey(chainId, query, variables);
        const cached = await this.cacheService.get(cacheKey);
        if (cached) {
            log.cacheHit(this.logger, 'query', cacheKey);
            log.methodExit(this.logger, 'query', { fromCache: true });
            return cached;
        }
        log.cacheMiss(this.logger, 'query', cacheKey);
        const endpoint = getUniswapV3SubgraphEndpoint(chainId);
        try {
            const response = await this.executeQueryWithRetry(endpoint, query, variables);
            if (response.data && !response.errors) {
                await this.cacheService.set(cacheKey, response, this.cacheTtl);
                this.logger.debug({ cacheKey }, 'Cached subgraph response');
            }
            log.methodExit(this.logger, 'query', { fromCache: false });
            return response;
        }
        catch (error) {
            log.methodError(this.logger, 'query', error, { chainId });
            throw error;
        }
    }
    async getPoolMetrics(chainId, poolAddress) {
        log.methodEntry(this.logger, 'getPoolMetrics', { chainId, poolAddress });
        try {
            const poolId = normalizeAddress(poolAddress).toLowerCase();
            log.externalApiCall(this.logger, 'UniswapV3Subgraph', 'POOL_METRICS_QUERY', { chainId, poolId });
            const response = await this.query(chainId, POOL_METRICS_QUERY, { poolId });
            if (response.errors && response.errors.length > 0) {
                const error = new Error(`Subgraph query failed: ${response.errors.map((e) => e.message).join(', ')}`);
                error.name = 'UniswapV3SubgraphApiError';
                error.graphqlErrors = response.errors;
                log.methodError(this.logger, 'getPoolMetrics', error, { chainId, poolAddress });
                throw error;
            }
            if (!response.data?.pools || response.data.pools.length === 0) {
                this.logger.warn({ chainId, poolAddress }, 'Pool not found in subgraph, returning default metrics');
                const defaultMetrics = {
                    tvlUSD: '0',
                    volumeUSD: '0',
                    feesUSD: '0',
                };
                log.methodExit(this.logger, 'getPoolMetrics', { found: false });
                return defaultMetrics;
            }
            const pool = response.data.pools[0];
            if (!pool.poolDayData || pool.poolDayData.length === 0) {
                this.logger.warn({ chainId, poolAddress }, 'No pool day data available, returning default metrics');
                const defaultMetrics = {
                    tvlUSD: '0',
                    volumeUSD: '0',
                    feesUSD: '0',
                };
                log.methodExit(this.logger, 'getPoolMetrics', { found: true, hasData: false });
                return defaultMetrics;
            }
            const dayData = pool.poolDayData[0];
            const metrics = {
                tvlUSD: dayData.tvlUSD || '0',
                volumeUSD: dayData.volumeUSD || '0',
                feesUSD: dayData.feesUSD || '0',
            };
            this.logger.debug({ chainId, poolAddress, metrics }, 'Pool metrics retrieved from subgraph');
            log.methodExit(this.logger, 'getPoolMetrics', { found: true, hasData: true });
            return metrics;
        }
        catch (error) {
            throw error;
        }
    }
    async getPoolFeeData(chainId, poolAddress) {
        log.methodEntry(this.logger, 'getPoolFeeData', { chainId, poolAddress });
        try {
            const normalizedAddress = normalizeAddress(poolAddress);
            const poolId = normalizedAddress.toLowerCase();
            log.externalApiCall(this.logger, 'UniswapV3Subgraph', 'POOL_FEE_DATA_QUERY', { chainId, poolId });
            const response = await this.query(chainId, POOL_FEE_DATA_QUERY, { poolId });
            if (response.errors && response.errors.length > 0) {
                const error = new Error(`Subgraph query failed: ${response.errors.map((e) => e.message).join(', ')}`);
                error.name = 'UniswapV3SubgraphApiError';
                error.graphqlErrors = response.errors;
                log.methodError(this.logger, 'getPoolFeeData', error, { chainId, poolAddress });
                throw error;
            }
            if (!response.data?.pools || response.data.pools.length === 0) {
                const error = new Error(`Pool ${poolAddress} not found in subgraph for chain ${chainId}`);
                error.name = 'PoolNotFoundInSubgraphError';
                error.chainId = chainId;
                error.poolAddress = poolAddress;
                log.methodError(this.logger, 'getPoolFeeData', error, { chainId, poolAddress });
                throw error;
            }
            const pool = response.data.pools[0];
            if (!pool.poolDayData || pool.poolDayData.length === 0) {
                const error = new Error(`No recent pool data available for ${poolAddress} on chain ${chainId}`);
                error.name = 'UniswapV3SubgraphApiError';
                log.methodError(this.logger, 'getPoolFeeData', error, { chainId, poolAddress });
                throw error;
            }
            const dayData = pool.poolDayData[0];
            const token0Decimals = parseInt(pool.token0.decimals);
            const token1Decimals = parseInt(pool.token1.decimals);
            const feeData = {
                poolAddress: normalizedAddress,
                chainId,
                feeTier: pool.feeTier,
                poolLiquidity: pool.liquidity,
                sqrtPriceX96: pool.sqrtPrice,
                tvlUSD: dayData.tvlUSD || '0',
                volumeUSD: dayData.volumeUSD || '0',
                feesUSD: dayData.feesUSD || '0',
                token0: {
                    address: normalizeAddress(pool.token0.id),
                    symbol: pool.token0.symbol,
                    decimals: token0Decimals,
                    dailyVolume: this.decimalToBigIntString(dayData.volumeToken0, token0Decimals),
                    price: this.decimalToBigIntString(dayData.token1Price, token1Decimals),
                },
                token1: {
                    address: normalizeAddress(pool.token1.id),
                    symbol: pool.token1.symbol,
                    decimals: token1Decimals,
                    dailyVolume: this.decimalToBigIntString(dayData.volumeToken1, token1Decimals),
                    price: this.decimalToBigIntString(dayData.token0Price, token0Decimals),
                },
                calculatedAt: new Date(),
            };
            this.logger.debug({ chainId, poolAddress, token0: pool.token0.symbol, token1: pool.token1.symbol }, 'Pool fee data retrieved from subgraph');
            log.methodExit(this.logger, 'getPoolFeeData', { found: true });
            return feeData;
        }
        catch (error) {
            throw error;
        }
    }
    async clearCache() {
        return await this.cacheService.clear('subgraph:uniswapv3:');
    }
    isChainSupported(chainId) {
        return isUniswapV3SubgraphSupported(chainId);
    }
    getSupportedChainIds() {
        return getSupportedUniswapV3SubgraphChains();
    }
    buildCacheKey(chainId, query, variables) {
        const hash = crypto
            .createHash('md5')
            .update(query + JSON.stringify(variables ?? {}))
            .digest('hex');
        return `subgraph:uniswapv3:${chainId}:${hash}`;
    }
    async executeQueryWithRetry(endpoint, query, variables) {
        const maxRetries = 3;
        const baseDelayMs = 500;
        for (let attempt = 0; attempt < maxRetries; attempt++) {
            try {
                const response = await this.fetchFn(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ query, variables }),
                });
                if (!response.ok) {
                    const error = new Error(`Subgraph HTTP error: ${response.status} ${response.statusText}`);
                    error.name = 'UniswapV3SubgraphApiError';
                    error.statusCode = response.status;
                    throw error;
                }
                const data = (await response.json());
                return data;
            }
            catch (error) {
                const isLastAttempt = attempt === maxRetries - 1;
                if (error instanceof Error && error.name === 'UniswapV3SubgraphApiError') {
                    throw error;
                }
                if (!isLastAttempt) {
                    const delay = baseDelayMs * 2 ** attempt;
                    this.logger.warn({ attempt: attempt + 1, maxRetries, delay, error }, 'Subgraph query failed, retrying');
                    await new Promise((resolve) => setTimeout(resolve, delay));
                }
                else {
                    const unavailableError = new Error(`Subgraph unavailable after ${maxRetries} attempts: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    unavailableError.name = 'UniswapV3SubgraphUnavailableError';
                    unavailableError.cause = error;
                    throw unavailableError;
                }
            }
        }
        throw new Error('Unexpected end of retry loop');
    }
    decimalToBigIntString(decimalStr, decimals) {
        if (!decimalStr || decimalStr === '0') {
            return '0';
        }
        try {
            const [integerPart = '0', fractionalPart = ''] = decimalStr.split('.');
            const paddedFractional = fractionalPart.padEnd(decimals, '0').slice(0, decimals);
            const combined = integerPart + paddedFractional;
            const result = combined.replace(/^0+/, '') || '0';
            return result;
        }
        catch (error) {
            this.logger.warn({ decimalStr, decimals, error }, 'Failed to convert decimal to bigint, returning 0');
            return '0';
        }
    }
}
//# sourceMappingURL=uniswapv3-subgraph-client.js.map