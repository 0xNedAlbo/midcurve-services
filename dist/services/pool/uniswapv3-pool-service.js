import { toPoolState, toPoolStateDB, } from '../types/uniswapv3/pool-db.js';
import { PoolService } from './pool-service.js';
import { isValidAddress, normalizeAddress, } from '@midcurve/shared';
import { readPoolConfig, readPoolState, PoolConfigError, uniswapV3PoolAbi, } from '../../utils/uniswapv3/index.js';
import { EvmConfig } from '../../config/evm.js';
import { Erc20TokenService } from '../token/erc20-token-service.js';
import { log } from '../../logging/index.js';
export class UniswapV3PoolService extends PoolService {
    _evmConfig;
    _erc20TokenService;
    constructor(dependencies = {}) {
        super(dependencies);
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this._erc20TokenService =
            dependencies.erc20TokenService ??
                new Erc20TokenService({ prisma: this.prisma });
    }
    get evmConfig() {
        return this._evmConfig;
    }
    get erc20TokenService() {
        return this._erc20TokenService;
    }
    parseConfig(configDB) {
        const db = configDB;
        return {
            chainId: db.chainId,
            address: db.address,
            token0: db.token0,
            token1: db.token1,
            feeBps: db.feeBps,
            tickSpacing: db.tickSpacing,
        };
    }
    serializeConfig(config) {
        return {
            chainId: config.chainId,
            address: config.address,
            token0: config.token0,
            token1: config.token1,
            feeBps: config.feeBps,
            tickSpacing: config.tickSpacing,
        };
    }
    parseState(stateDB) {
        return toPoolState(stateDB);
    }
    serializeState(state) {
        return toPoolStateDB(state);
    }
    async discover(params) {
        const { poolAddress, chainId } = params;
        log.methodEntry(this.logger, 'discover', { poolAddress, chainId });
        try {
            if (!isValidAddress(poolAddress)) {
                const error = new Error(`Invalid pool address format: ${poolAddress}`);
                log.methodError(this.logger, 'discover', error, {
                    poolAddress,
                    chainId,
                });
                throw error;
            }
            const normalizedAddress = normalizeAddress(poolAddress);
            this.logger.debug({ original: poolAddress, normalized: normalizedAddress }, 'Pool address normalized for discovery');
            const existing = await this.findByAddressAndChain(normalizedAddress, chainId);
            if (existing) {
                this.logger.info({
                    id: existing.id,
                    address: normalizedAddress,
                    chainId,
                    token0: existing.token0.symbol,
                    token1: existing.token1.symbol,
                }, 'Pool already exists, refreshing state from on-chain');
                const refreshed = await this.refresh(existing.id);
                log.methodExit(this.logger, 'discover', {
                    id: refreshed.id,
                    fromDatabase: true,
                    refreshed: true,
                });
                return refreshed;
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(', ')}`);
                log.methodError(this.logger, 'discover', error, { chainId });
                throw error;
            }
            this.logger.debug({ chainId }, 'Chain is supported, proceeding with on-chain discovery');
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({ address: normalizedAddress, chainId }, 'Reading pool configuration from contract');
            let config;
            try {
                config = await readPoolConfig(client, normalizedAddress, chainId);
            }
            catch (error) {
                if (error instanceof PoolConfigError) {
                    log.methodError(this.logger, 'discover', error, {
                        address: normalizedAddress,
                        chainId,
                    });
                    throw error;
                }
                const wrappedError = new Error(`Failed to read pool configuration from contract at ${normalizedAddress} on chain ${chainId}: ${error instanceof Error ? error.message : String(error)}`);
                log.methodError(this.logger, 'discover', wrappedError, {
                    address: normalizedAddress,
                    chainId,
                });
                throw wrappedError;
            }
            this.logger.info({
                address: normalizedAddress,
                chainId,
                token0: config.token0,
                token1: config.token1,
                feeBps: config.feeBps,
                tickSpacing: config.tickSpacing,
            }, 'Pool configuration read successfully from contract');
            this.logger.debug({ token0: config.token0, token1: config.token1, chainId }, 'Discovering pool tokens');
            const [token0, token1] = await Promise.all([
                this.erc20TokenService.discover({
                    address: config.token0,
                    chainId,
                }),
                this.erc20TokenService.discover({
                    address: config.token1,
                    chainId,
                }),
            ]);
            this.logger.info({
                token0Id: token0.id,
                token0Symbol: token0.symbol,
                token1Id: token1.id,
                token1Symbol: token1.symbol,
            }, 'Pool tokens discovered successfully');
            const state = await readPoolState(client, normalizedAddress);
            this.logger.debug({
                address: normalizedAddress,
                chainId,
                token0Id: token0.id,
                token1Id: token1.id,
            }, 'Creating pool with discovered tokens');
            const pool = await this.create({
                protocol: 'uniswapv3',
                poolType: 'CL_TICKS',
                token0Id: token0.id,
                token1Id: token1.id,
                feeBps: config.feeBps,
                config,
                state,
            });
            this.logger.info({
                id: pool.id,
                address: normalizedAddress,
                chainId,
                token0: token0.symbol,
                token1: token1.symbol,
                feeBps: config.feeBps,
            }, 'Pool discovered and created successfully');
            log.methodExit(this.logger, 'discover', { id: pool.id });
            return pool;
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('Invalid')) &&
                !(error instanceof PoolConfigError)) {
                log.methodError(this.logger, 'discover', error, {
                    poolAddress,
                    chainId,
                });
            }
            throw error;
        }
    }
    async create(input) {
        log.methodEntry(this.logger, 'create', {
            address: input.config.address,
            chainId: input.config.chainId,
            token0Id: input.token0Id,
            token1Id: input.token1Id,
        });
        try {
            if (!isValidAddress(input.config.address)) {
                const error = new Error(`Invalid pool address format: ${input.config.address}`);
                log.methodError(this.logger, 'create', error, { input });
                throw error;
            }
            if (!isValidAddress(input.config.token0)) {
                const error = new Error(`Invalid token0 address format: ${input.config.token0}`);
                log.methodError(this.logger, 'create', error, { input });
                throw error;
            }
            if (!isValidAddress(input.config.token1)) {
                const error = new Error(`Invalid token1 address format: ${input.config.token1}`);
                log.methodError(this.logger, 'create', error, { input });
                throw error;
            }
            const normalizedInput = {
                ...input,
                config: {
                    ...input.config,
                    address: normalizeAddress(input.config.address),
                    token0: normalizeAddress(input.config.token0),
                    token1: normalizeAddress(input.config.token1),
                },
            };
            await super.create(normalizedInput);
            const created = await this.findByAddressAndChain(normalizedInput.config.address, normalizedInput.config.chainId);
            if (!created) {
                const error = new Error(`Pool not found after creation: ${normalizedInput.config.address}`);
                log.methodError(this.logger, 'create', error, { input });
                throw error;
            }
            log.methodExit(this.logger, 'create', { id: created.id });
            return created;
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('Invalid'))) {
                log.methodError(this.logger, 'create', error, { input });
            }
            throw error;
        }
    }
    async findById(id) {
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
                log.methodExit(this.logger, 'findById', { id, found: false });
                return null;
            }
            if (result.protocol !== 'uniswapv3') {
                this.logger.debug({ id, protocol: result.protocol }, 'Pool found but is not uniswapv3 protocol');
                log.methodExit(this.logger, 'findById', { id, found: false, reason: 'wrong_protocol' });
                return null;
            }
            const pool = this.mapDbResultToPool(result);
            log.methodExit(this.logger, 'findById', { id, found: true });
            return pool;
        }
        catch (error) {
            log.methodError(this.logger, 'findById', error, { id });
            throw error;
        }
    }
    async update(id, input) {
        log.methodEntry(this.logger, 'update', { id, input });
        try {
            if (input.config?.address) {
                if (!isValidAddress(input.config.address)) {
                    const error = new Error(`Invalid pool address format: ${input.config.address}`);
                    log.methodError(this.logger, 'update', error, { id, input });
                    throw error;
                }
                input.config.address = normalizeAddress(input.config.address);
            }
            if (input.config?.token0) {
                if (!isValidAddress(input.config.token0)) {
                    const error = new Error(`Invalid token0 address format: ${input.config.token0}`);
                    log.methodError(this.logger, 'update', error, { id, input });
                    throw error;
                }
                input.config.token0 = normalizeAddress(input.config.token0);
            }
            if (input.config?.token1) {
                if (!isValidAddress(input.config.token1)) {
                    const error = new Error(`Invalid token1 address format: ${input.config.token1}`);
                    log.methodError(this.logger, 'update', error, { id, input });
                    throw error;
                }
                input.config.token1 = normalizeAddress(input.config.token1);
            }
            await super.update(id, input);
            const updated = await this.findById(id);
            if (!updated) {
                const error = new Error(`Pool ${id} not found after update`);
                log.methodError(this.logger, 'update', error, { id });
                throw error;
            }
            log.methodExit(this.logger, 'update', { id });
            return updated;
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('Invalid'))) {
                log.methodError(this.logger, 'update', error, { id });
            }
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, 'delete', { id });
        try {
            log.dbOperation(this.logger, 'findUnique', 'Pool', { id });
            const existing = await this.prisma.pool.findUnique({
                where: { id },
                include: {
                    positions: {
                        take: 1,
                    },
                },
            });
            if (!existing) {
                this.logger.debug({ id }, 'Pool not found, delete operation is no-op');
                log.methodExit(this.logger, 'delete', { id, deleted: false });
                return;
            }
            if (existing.protocol !== 'uniswapv3') {
                const error = new Error(`Cannot delete pool ${id}: expected protocol 'uniswapv3', got '${existing.protocol}'`);
                log.methodError(this.logger, 'delete', error, { id, protocol: existing.protocol });
                throw error;
            }
            if (existing.positions.length > 0) {
                const error = new Error(`Cannot delete pool ${id}: pool has dependent positions. Delete positions first.`);
                log.methodError(this.logger, 'delete', error, { id });
                throw error;
            }
            await super.delete(id);
            log.methodExit(this.logger, 'delete', { id, deleted: true });
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('Cannot delete'))) {
                log.methodError(this.logger, 'delete', error, { id });
            }
            throw error;
        }
    }
    async refresh(id) {
        log.methodEntry(this.logger, 'refresh', { id });
        try {
            const existing = await this.findById(id);
            if (!existing) {
                const error = new Error(`Pool not found: ${id}`);
                log.methodError(this.logger, 'refresh', error, { id });
                throw error;
            }
            this.logger.debug({
                id,
                address: existing.config.address,
                chainId: existing.config.chainId,
            }, 'Refreshing pool state from on-chain data');
            if (!this.evmConfig.isChainSupported(existing.config.chainId)) {
                const error = new Error(`Chain ${existing.config.chainId} is not supported or not configured. Please configure RPC_URL_* environment variable.`);
                log.methodError(this.logger, 'refresh', error, { id, chainId: existing.config.chainId });
                throw error;
            }
            const client = this.evmConfig.getPublicClient(existing.config.chainId);
            this.logger.debug({ id, address: existing.config.address, chainId: existing.config.chainId }, 'Reading fresh pool state from contract');
            let freshState;
            try {
                freshState = await readPoolState(client, existing.config.address);
            }
            catch (error) {
                const wrappedError = new Error(`Failed to read pool state from contract at ${existing.config.address} on chain ${existing.config.chainId}: ${error instanceof Error ? error.message : String(error)}`);
                log.methodError(this.logger, 'refresh', wrappedError, {
                    id,
                    address: existing.config.address,
                    chainId: existing.config.chainId,
                });
                throw wrappedError;
            }
            this.logger.info({
                id,
                address: existing.config.address,
                chainId: existing.config.chainId,
                sqrtPriceX96: freshState.sqrtPriceX96.toString(),
                liquidity: freshState.liquidity.toString(),
                currentTick: freshState.currentTick,
            }, 'Fresh pool state read from contract');
            const updated = await this.update(id, {
                state: freshState,
            });
            this.logger.info({
                id,
                address: existing.config.address,
                chainId: existing.config.chainId,
            }, 'Pool state refreshed successfully');
            log.methodExit(this.logger, 'refresh', { id });
            return updated;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes('not found') ||
                    error.message.includes('not supported') ||
                    error.message.includes('Failed to read')))) {
                log.methodError(this.logger, 'refresh', error, { id });
            }
            throw error;
        }
    }
    mapDbResultToPool(result) {
        const config = this.parseConfig(result.config);
        const state = this.parseState(result.state);
        return {
            id: result.id,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt,
            protocol: 'uniswapv3',
            poolType: 'CL_TICKS',
            token0: this.mapDbTokenToErc20Token(result.token0),
            token1: this.mapDbTokenToErc20Token(result.token1),
            feeBps: config.feeBps,
            config,
            state,
        };
    }
    mapDbTokenToErc20Token(dbToken) {
        return {
            ...dbToken,
            tokenType: 'erc20',
            logoUrl: dbToken.logoUrl ?? undefined,
            coingeckoId: dbToken.coingeckoId ?? undefined,
            marketCap: dbToken.marketCap ?? undefined,
            config: {
                address: dbToken.config.address,
                chainId: dbToken.config.chainId,
            },
        };
    }
    async getPoolPrice(chainId, poolAddress) {
        log.methodEntry(this.logger, 'getPoolPrice', { chainId, poolAddress });
        try {
            if (!isValidAddress(poolAddress)) {
                const error = new Error(`Invalid pool address format: ${poolAddress}`);
                log.methodError(this.logger, 'getPoolPrice', error, {
                    poolAddress,
                    chainId,
                });
                throw error;
            }
            const normalizedAddress = normalizeAddress(poolAddress);
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(', ')}`);
                log.methodError(this.logger, 'getPoolPrice', error, { chainId });
                throw error;
            }
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({ poolAddress: normalizedAddress, chainId }, 'Reading slot0 from pool contract');
            const slot0Data = (await client.readContract({
                address: normalizedAddress,
                abi: uniswapV3PoolAbi,
                functionName: 'slot0',
            }));
            const sqrtPriceX96 = slot0Data[0];
            const currentTick = slot0Data[1];
            this.logger.info({
                poolAddress: normalizedAddress,
                chainId,
                sqrtPriceX96: sqrtPriceX96.toString(),
                currentTick,
            }, 'Pool price fetched successfully');
            log.methodExit(this.logger, 'getPoolPrice', {
                sqrtPriceX96: sqrtPriceX96.toString(),
                currentTick,
            });
            return {
                sqrtPriceX96: sqrtPriceX96.toString(),
                currentTick,
            };
        }
        catch (error) {
            if (!(error instanceof Error && error.message.includes('Invalid'))) {
                log.methodError(this.logger, 'getPoolPrice', error, {
                    poolAddress,
                    chainId,
                });
            }
            throw error;
        }
    }
    async findByAddressAndChain(address, chainId) {
        log.dbOperation(this.logger, 'findFirst', 'Pool', {
            address,
            chainId,
            protocol: 'uniswapv3',
        });
        const result = await this.prisma.pool.findFirst({
            where: {
                protocol: 'uniswapv3',
                config: {
                    path: ['address'],
                    equals: address,
                },
            },
            include: {
                token0: true,
                token1: true,
            },
        });
        if (!result) {
            return null;
        }
        const config = this.parseConfig(result.config);
        if (config.chainId !== chainId) {
            return null;
        }
        return this.mapDbResultToPool(result);
    }
}
//# sourceMappingURL=uniswapv3-pool-service.js.map