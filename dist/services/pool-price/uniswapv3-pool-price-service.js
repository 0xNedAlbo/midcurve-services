import { PoolPriceService } from "./pool-price-service.js";
import { parseUniswapV3PoolPriceConfig, serializeUniswapV3PoolPriceConfig, parseUniswapV3PoolPriceState, serializeUniswapV3PoolPriceState, } from "../types/pool-price/uniswapv3/pool-price-db.js";
import { log } from "../../logging/index.js";
import { uniswapV3PoolAbi } from "../../utils/uniswapv3/pool-abi.js";
import { pricePerToken0InToken1, pricePerToken1InToken0, } from "@midcurve/shared";
export class UniswapV3PoolPriceService extends PoolPriceService {
    constructor(dependencies = {}) {
        super(dependencies);
    }
    parseConfig(configDB) {
        return parseUniswapV3PoolPriceConfig(configDB);
    }
    serializeConfig(config) {
        return serializeUniswapV3PoolPriceConfig(config);
    }
    parseState(stateDB) {
        return parseUniswapV3PoolPriceState(stateDB);
    }
    serializeState(state) {
        return serializeUniswapV3PoolPriceState(state);
    }
    async discover(poolId, params) {
        log.methodEntry(this.logger, "discover", { poolId, params });
        try {
            const pool = await this.prisma.pool.findUnique({
                where: { id: poolId },
                include: {
                    token0: true,
                    token1: true,
                },
            });
            if (!pool) {
                const error = new Error(`Pool not found: ${poolId}`);
                log.methodError(this.logger, "discover", error, { poolId });
                throw error;
            }
            if (pool.protocol !== "uniswapv3") {
                const error = new Error(`Invalid pool protocol '${pool.protocol}'. Expected 'uniswapv3'.`);
                log.methodError(this.logger, "discover", error, {
                    poolId,
                    protocol: pool.protocol,
                });
                throw error;
            }
            const poolConfig = pool.config;
            const { chainId, address: poolAddress } = poolConfig;
            const existingPrice = await this.prisma.poolPrice.findFirst({
                where: {
                    poolId,
                    protocol: "uniswapv3",
                    config: {
                        path: ["blockNumber"],
                        equals: params.blockNumber,
                    },
                },
            });
            if (existingPrice) {
                this.logger.info({ poolId, blockNumber: params.blockNumber }, "Pool price already exists, returning cached");
                return {
                    id: existingPrice.id,
                    createdAt: existingPrice.createdAt,
                    updatedAt: existingPrice.updatedAt,
                    protocol: "uniswapv3",
                    poolId: existingPrice.poolId,
                    timestamp: existingPrice.timestamp,
                    token1PricePerToken0: BigInt(existingPrice.token1PricePerToken0),
                    token0PricePerToken1: BigInt(existingPrice.token0PricePerToken1),
                    config: this.parseConfig(existingPrice.config),
                    state: this.parseState(existingPrice.state),
                };
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not supported. Please configure RPC_URL_${this.evmConfig
                    .getChainConfig(chainId)
                    ?.name.toUpperCase()}`);
                log.methodError(this.logger, "discover", error, { chainId });
                throw error;
            }
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({ blockNumber: params.blockNumber }, "Fetching block info");
            const block = await client.getBlock({
                blockNumber: BigInt(params.blockNumber),
            });
            const blockTimestamp = Number(block.timestamp);
            const timestamp = new Date(blockTimestamp * 1000);
            this.logger.debug({ poolAddress, blockNumber: params.blockNumber }, "Reading pool slot0 at block");
            let slot0Data;
            let usedCurrentBlock = false;
            try {
                slot0Data = (await client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "slot0",
                    blockNumber: BigInt(params.blockNumber),
                }));
            }
            catch (historicalError) {
                this.logger.warn({
                    poolAddress,
                    blockNumber: params.blockNumber,
                    error: historicalError.message,
                }, "Failed to read pool state at historical block, falling back to current block");
                slot0Data = (await client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "slot0",
                }));
                usedCurrentBlock = true;
            }
            const sqrtPriceX96 = slot0Data[0];
            const tick = slot0Data[1];
            if (usedCurrentBlock) {
                this.logger.info({
                    poolAddress,
                    requestedBlock: params.blockNumber,
                    sqrtPriceX96: sqrtPriceX96.toString(),
                }, "Used current block price as fallback for recent transaction");
            }
            const token1PricePerToken0 = pricePerToken0InToken1(sqrtPriceX96, pool.token0.decimals);
            const token0PricePerToken1 = pricePerToken1InToken0(sqrtPriceX96, pool.token1.decimals);
            this.logger.debug({
                sqrtPriceX96: sqrtPriceX96.toString(),
                tick,
                token1PricePerToken0: token1PricePerToken0.toString(),
                token0PricePerToken1: token0PricePerToken1.toString(),
            }, "Calculated prices from pool state");
            const poolPrice = await this.create({
                protocol: "uniswapv3",
                poolId,
                timestamp,
                token1PricePerToken0,
                token0PricePerToken1,
                config: {
                    blockNumber: params.blockNumber,
                    blockTimestamp,
                },
                state: {
                    sqrtPriceX96,
                    tick,
                },
            });
            this.logger.info({
                id: poolPrice.id,
                poolId,
                blockNumber: params.blockNumber,
                timestamp,
            }, "Pool price discovered and saved");
            log.methodExit(this.logger, "discover", { id: poolPrice.id });
            return poolPrice;
        }
        catch (error) {
            log.methodError(this.logger, "discover", error, {
                poolId,
                params,
            });
            throw error;
        }
    }
    async create(input) {
        if (input.protocol !== "uniswapv3") {
            const error = new Error(`Invalid protocol '${input.protocol}' for UniswapV3PoolPriceService. Expected 'uniswapv3'.`);
            log.methodError(this.logger, "create", error, {
                protocol: input.protocol,
            });
            throw error;
        }
        return super.create(input);
    }
    async findById(id) {
        const poolPrice = await super.findById(id);
        if (!poolPrice) {
            return null;
        }
        if (poolPrice.protocol !== "uniswapv3") {
            this.logger.warn({ id, protocol: poolPrice.protocol }, "Pool price found but is not uniswapv3 protocol");
            return null;
        }
        return poolPrice;
    }
    async findByPoolId(poolId) {
        const poolPrices = await super.findByPoolId(poolId);
        return poolPrices.filter((pp) => pp.protocol === "uniswapv3");
    }
    async findByPoolIdAndTimeRange(poolId, startTime, endTime) {
        const poolPrices = await super.findByPoolIdAndTimeRange(poolId, startTime, endTime);
        return poolPrices.filter((pp) => pp.protocol === "uniswapv3");
    }
    async delete(id) {
        const poolPrice = await super.findById(id);
        if (!poolPrice) {
            return;
        }
        if (poolPrice.protocol !== "uniswapv3") {
            const error = new Error(`Cannot delete pool price with protocol '${poolPrice.protocol}' using UniswapV3PoolPriceService`);
            log.methodError(this.logger, "delete", error, {
                id,
                protocol: poolPrice.protocol,
            });
            throw error;
        }
        await super.delete(id);
    }
}
//# sourceMappingURL=uniswapv3-pool-price-service.js.map