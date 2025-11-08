import { PoolDiscoveryService } from './pool-discovery-service.js';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { UniswapV3SubgraphClient } from '../../clients/subgraph/uniswapv3/uniswapv3-subgraph-client.js';
import { UniswapV3SubgraphApiError, UniswapV3SubgraphUnavailableError, PoolNotFoundInSubgraphError, } from '../../clients/subgraph/uniswapv3/types.js';
import { EvmConfig } from '../../config/evm.js';
import { isValidAddress, normalizeAddress, compareAddresses, } from '@midcurve/shared';
import { getFactoryAddress, UNISWAP_V3_FACTORY_ABI, } from '../../config/uniswapv3.js';
import { FEE_TIERS } from '@midcurve/shared';
import { log } from '../../logging/index.js';
const SUPPORTED_FEE_TIERS = [...FEE_TIERS];
export class UniswapV3PoolDiscoveryService extends PoolDiscoveryService {
    _poolService;
    _subgraphClient;
    _evmConfig;
    constructor(dependencies = {}) {
        super(dependencies);
        this._poolService =
            dependencies.poolService ??
                new UniswapV3PoolService({ prisma: this.prisma });
        this._subgraphClient =
            dependencies.subgraphClient ?? UniswapV3SubgraphClient.getInstance();
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
    }
    get poolService() {
        return this._poolService;
    }
    get subgraphClient() {
        return this._subgraphClient;
    }
    get evmConfig() {
        return this._evmConfig;
    }
    async findPoolsForTokenPair(input) {
        const { chainId, tokenA, tokenB } = input;
        log.methodEntry(this.logger, 'findPoolsForTokenPair', {
            chainId,
            tokenA,
            tokenB,
        });
        try {
            if (!isValidAddress(tokenA)) {
                throw new Error(`Invalid tokenA address: ${tokenA}`);
            }
            if (!isValidAddress(tokenB)) {
                throw new Error(`Invalid tokenB address: ${tokenB}`);
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                throw new Error(`Chain ${chainId} is not supported`);
            }
            const normalizedTokenA = normalizeAddress(tokenA);
            const normalizedTokenB = normalizeAddress(tokenB);
            const [token0, token1] = compareAddresses(normalizedTokenA, normalizedTokenB) < 0
                ? [normalizedTokenA, normalizedTokenB]
                : [normalizedTokenB, normalizedTokenA];
            this.logger.debug({ token0, token1, chainId }, 'Token addresses normalized and sorted');
            const poolAddresses = await Promise.all(SUPPORTED_FEE_TIERS.map((fee) => this.queryPoolAddress(chainId, token0, token1, fee)));
            this.logger.debug({ poolAddresses, feeCount: SUPPORTED_FEE_TIERS.length }, 'Pool addresses queried from factory');
            const results = [];
            for (let i = 0; i < SUPPORTED_FEE_TIERS.length; i++) {
                const fee = SUPPORTED_FEE_TIERS[i];
                const poolAddress = poolAddresses[i];
                if (poolAddress &&
                    poolAddress !== '0x0000000000000000000000000000000000000000') {
                    const pool = await this.poolService.discover({
                        poolAddress,
                        chainId,
                    });
                    const poolName = this.createPoolName(pool);
                    results.push({
                        poolName,
                        fee,
                        protocol: 'uniswapv3',
                        tvlUSD: '0',
                        volumeUSD: '0',
                        feesUSD: '0',
                        pool,
                    });
                    this.logger.debug({ poolAddress, fee, poolName }, 'Pool discovered and added to results');
                }
            }
            await this.enrichWithSubgraphMetrics(results, chainId);
            results.sort((a, b) => {
                const tvlA = parseFloat(a.tvlUSD);
                const tvlB = parseFloat(b.tvlUSD);
                return tvlB - tvlA;
            });
            this.logger.info({ poolCount: results.length, chainId, token0, token1 }, 'Pool discovery completed');
            log.methodExit(this.logger, 'findPoolsForTokenPair', {
                poolCount: results.length,
            });
            return results;
        }
        catch (error) {
            log.methodError(this.logger, 'findPoolsForTokenPair', error, { chainId, tokenA, tokenB });
            throw error;
        }
    }
    createPoolName(pool) {
        const token0Symbol = pool.token0.symbol;
        const token1Symbol = pool.token1.symbol;
        const tickSpacing = pool.config.tickSpacing;
        return `CL${tickSpacing}-${token0Symbol}/${token1Symbol}`;
    }
    async queryPoolAddress(chainId, token0, token1, fee) {
        const client = this.evmConfig.getPublicClient(chainId);
        const factoryAddress = getFactoryAddress(chainId);
        this.logger.debug({ factoryAddress, token0, token1, fee, chainId }, 'Querying factory for pool address');
        const poolAddress = (await client.readContract({
            address: factoryAddress,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: 'getPool',
            args: [token0, token1, fee],
        }));
        this.logger.debug({ poolAddress, fee }, 'Factory returned pool address');
        return poolAddress &&
            poolAddress !== '0x0000000000000000000000000000000000000000'
            ? normalizeAddress(poolAddress)
            : null;
    }
    async enrichWithSubgraphMetrics(results, chainId) {
        if (results.length === 0) {
            return;
        }
        this.logger.debug({ poolCount: results.length, chainId }, 'Enriching pools with subgraph metrics');
        try {
            const metricsPromises = results.map(async (result) => {
                const poolAddress = result.pool.config.address;
                try {
                    const feeData = await this.subgraphClient.getPoolFeeData(chainId, poolAddress);
                    result.tvlUSD = feeData.tvlUSD;
                    result.volumeUSD = feeData.volumeUSD;
                    result.feesUSD = feeData.feesUSD;
                    result.volumeToken0 = feeData.token0.dailyVolume;
                    result.volumeToken1 = feeData.token1.dailyVolume;
                    result.token0Price = feeData.token0.price;
                    result.token1Price = feeData.token1.price;
                    this.logger.debug({
                        poolAddress,
                        tvlUSD: feeData.tvlUSD,
                        volumeToken0: feeData.token0.dailyVolume,
                        volumeToken1: feeData.token1.dailyVolume,
                    }, 'Pool enriched with subgraph metrics and token-specific data');
                }
                catch (error) {
                    if (error instanceof UniswapV3SubgraphApiError) {
                        this.logger.error({ error, poolAddress }, 'Subgraph returned API error');
                        throw error;
                    }
                    else if (error instanceof UniswapV3SubgraphUnavailableError ||
                        error instanceof PoolNotFoundInSubgraphError) {
                        this.logger.warn({ error: error.message, poolAddress }, 'Subgraph unavailable or pool not found, using default metrics');
                    }
                    else {
                        throw error;
                    }
                }
            });
            await Promise.all(metricsPromises);
            this.logger.info({ poolCount: results.length, chainId }, 'Subgraph enrichment completed');
        }
        catch (error) {
            this.logger.error({ error, chainId }, 'Subgraph enrichment failed');
            throw error;
        }
    }
}
//# sourceMappingURL=uniswapv3-pool-discovery-service.js.map