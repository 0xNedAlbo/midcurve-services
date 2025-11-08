import { calculateUnclaimedFees } from "./helpers/uniswapv3/position-calculations.js";
import { PositionService } from "./position-service.js";
import { log } from "../../logging/index.js";
import { EvmConfig } from "../../config/evm.js";
import { getPositionManagerAddress, getFactoryAddress, UNISWAP_V3_POSITION_MANAGER_ABI, UNISWAP_V3_FACTORY_ABI, } from "../../config/uniswapv3.js";
import { isValidAddress, normalizeAddress, compareAddresses, } from "@midcurve/shared";
import { UniswapV3PoolService } from "../pool/uniswapv3-pool-service.js";
import { EtherscanClient } from "../../clients/etherscan/index.js";
import { UniswapV3PositionLedgerService } from "../position-ledger/uniswapv3-position-ledger-service.js";
import { UniswapV3QuoteTokenService } from "../quote-token/uniswapv3-quote-token-service.js";
import { EvmBlockService } from "../block/evm-block-service.js";
import { PositionAprService } from "../position-apr/position-apr-service.js";
import { UniswapV3PoolPriceService } from "../pool-price/uniswapv3-pool-price-service.js";
import { computeFeeGrowthInside, } from "@midcurve/shared";
import { calculatePositionValue } from "@midcurve/shared";
import { tickToPrice } from "@midcurve/shared";
import { uniswapV3PoolAbi } from "../../utils/uniswapv3/pool-abi.js";
import { calculatePoolPriceInQuoteToken, calculateTokenValueInQuote, } from "../../utils/uniswapv3/ledger-calculations.js";
import { syncLedgerEvents } from "../position-ledger/helpers/uniswapv3/ledger-sync.js";
import { UniswapV3PositionSyncState } from "../position-ledger/position-sync-state.js";
export class UniswapV3PositionService extends PositionService {
    _evmConfig;
    _poolService;
    _etherscanClient;
    _ledgerService;
    _quoteTokenService;
    _evmBlockService;
    _aprService;
    _poolPriceService;
    constructor(dependencies = {}) {
        super(dependencies);
        this._evmConfig = dependencies.evmConfig ?? EvmConfig.getInstance();
        this._poolService =
            dependencies.poolService ??
                new UniswapV3PoolService({ prisma: this.prisma });
        this._etherscanClient =
            dependencies.etherscanClient ?? EtherscanClient.getInstance();
        this._ledgerService =
            dependencies.ledgerService ??
                new UniswapV3PositionLedgerService({
                    prisma: this.prisma,
                    positionService: this,
                });
        this._quoteTokenService =
            dependencies.quoteTokenService ??
                new UniswapV3QuoteTokenService({ prisma: this.prisma });
        this._evmBlockService =
            dependencies.evmBlockService ??
                new EvmBlockService({ evmConfig: this._evmConfig });
        this._aprService =
            dependencies.aprService ??
                new PositionAprService({ prisma: this.prisma });
        this._poolPriceService =
            dependencies.poolPriceService ??
                new UniswapV3PoolPriceService({ prisma: this.prisma });
    }
    get evmConfig() {
        return this._evmConfig;
    }
    get poolService() {
        return this._poolService;
    }
    get etherscanClient() {
        return this._etherscanClient;
    }
    get ledgerService() {
        return this._ledgerService;
    }
    get quoteTokenService() {
        return this._quoteTokenService;
    }
    get evmBlockService() {
        return this._evmBlockService;
    }
    get aprService() {
        return this._aprService;
    }
    get poolPriceService() {
        return this._poolPriceService;
    }
    parseConfig(configDB) {
        const db = configDB;
        const chainId = typeof db.chainId === 'number' ? db.chainId : Number(db.chainId);
        const nftId = typeof db.nftId === 'number' ? db.nftId : Number(db.nftId);
        const tickUpper = typeof db.tickUpper === 'number' ? db.tickUpper : Number(db.tickUpper);
        const tickLower = typeof db.tickLower === 'number' ? db.tickLower : Number(db.tickLower);
        return {
            chainId,
            nftId,
            poolAddress: db.poolAddress,
            tickUpper,
            tickLower,
        };
    }
    serializeConfig(config) {
        return {
            chainId: config.chainId,
            nftId: config.nftId,
            poolAddress: config.poolAddress,
            tickUpper: config.tickUpper,
            tickLower: config.tickLower,
        };
    }
    parseState(stateDB) {
        const db = stateDB;
        return {
            ownerAddress: db.ownerAddress,
            liquidity: BigInt(db.liquidity),
            feeGrowthInside0LastX128: BigInt(db.feeGrowthInside0LastX128),
            feeGrowthInside1LastX128: BigInt(db.feeGrowthInside1LastX128),
            tokensOwed0: BigInt(db.tokensOwed0),
            tokensOwed1: BigInt(db.tokensOwed1),
            unclaimedFees0: BigInt(db.unclaimedFees0 ?? '0'),
            unclaimedFees1: BigInt(db.unclaimedFees1 ?? '0'),
        };
    }
    serializeState(state) {
        return {
            ownerAddress: state.ownerAddress,
            liquidity: state.liquidity.toString(),
            feeGrowthInside0LastX128: state.feeGrowthInside0LastX128.toString(),
            feeGrowthInside1LastX128: state.feeGrowthInside1LastX128.toString(),
            tokensOwed0: state.tokensOwed0.toString(),
            tokensOwed1: state.tokensOwed1.toString(),
            unclaimedFees0: state.unclaimedFees0?.toString() ?? '0',
            unclaimedFees1: state.unclaimedFees1?.toString() ?? '0',
        };
    }
    createPositionHash(config) {
        return `uniswapv3/${config.chainId}/${config.nftId}`;
    }
    async discover(userId, params) {
        const { chainId, nftId, quoteTokenAddress } = params;
        log.methodEntry(this.logger, "discover", {
            userId,
            chainId,
            nftId,
            quoteTokenAddress: quoteTokenAddress ?? "auto-detect",
        });
        try {
            const positionHash = this.createPositionHash({
                chainId,
                nftId,
                poolAddress: "0x0000000000000000000000000000000000000000",
                tickLower: 0,
                tickUpper: 0,
            });
            const existing = await this.findByPositionHash(userId, positionHash);
            if (existing) {
                this.logger.info({
                    id: existing.id,
                    userId,
                    chainId,
                    nftId,
                    positionHash,
                }, "Position already exists (found via positionHash), refreshing state from on-chain");
                const refreshed = await this.refresh(existing.id);
                log.methodExit(this.logger, "discover", {
                    id: refreshed.id,
                    fromDatabase: true,
                    refreshed: true,
                });
                return refreshed;
            }
            let normalizedQuoteAddress;
            if (quoteTokenAddress) {
                if (!isValidAddress(quoteTokenAddress)) {
                    const error = new Error(`Invalid quote token address format: ${quoteTokenAddress}`);
                    log.methodError(this.logger, "discover", error, {
                        userId,
                        chainId,
                        nftId,
                        quoteTokenAddress,
                    });
                    throw error;
                }
                normalizedQuoteAddress = normalizeAddress(quoteTokenAddress);
                this.logger.debug({
                    original: quoteTokenAddress,
                    normalized: normalizedQuoteAddress,
                }, "Quote token address provided by caller");
            }
            else {
                this.logger.debug("No quote token provided, will auto-detect using QuoteTokenService");
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(", ")}`);
                log.methodError(this.logger, "discover", error, { chainId });
                throw error;
            }
            this.logger.debug({ chainId }, "Chain is supported, proceeding with on-chain discovery");
            this.logger.debug({ chainId, nftId }, "Fetching position events from Etherscan to determine if position is burned");
            let blockNumber;
            try {
                const events = await this.etherscanClient.fetchPositionEvents(chainId, nftId.toString());
                if (events.length > 0) {
                    const latestEvent = events[events.length - 1];
                    blockNumber = BigInt(latestEvent.blockNumber) - 1n;
                    this.logger.debug({
                        latestEventBlock: latestEvent.blockNumber,
                        queryBlock: blockNumber.toString(),
                        eventType: latestEvent.eventType,
                    }, "Found events - will query position state at historic block");
                }
            }
            catch (error) {
                this.logger.warn({ error, chainId, nftId }, "Failed to fetch events from Etherscan, will attempt current block query");
            }
            const positionManagerAddress = getPositionManagerAddress(chainId);
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({
                positionManagerAddress,
                nftId,
                chainId,
                blockNumber: blockNumber?.toString() ?? "latest",
            }, "Reading position data from NonfungiblePositionManager");
            const [positionData, ownerAddress] = await Promise.all([
                client.readContract({
                    address: positionManagerAddress,
                    abi: UNISWAP_V3_POSITION_MANAGER_ABI,
                    functionName: "positions",
                    args: [BigInt(nftId)],
                    blockNumber,
                }),
                client.readContract({
                    address: positionManagerAddress,
                    abi: UNISWAP_V3_POSITION_MANAGER_ABI,
                    functionName: "ownerOf",
                    args: [BigInt(nftId)],
                    blockNumber,
                }),
            ]);
            const position = {
                nonce: positionData[0],
                operator: positionData[1],
                token0: positionData[2],
                token1: positionData[3],
                fee: positionData[4],
                tickLower: positionData[5],
                tickUpper: positionData[6],
                liquidity: positionData[7],
                feeGrowthInside0LastX128: positionData[8],
                feeGrowthInside1LastX128: positionData[9],
                tokensOwed0: positionData[10],
                tokensOwed1: positionData[11],
            };
            this.logger.debug({
                token0: position.token0,
                token1: position.token1,
                fee: position.fee,
                tickLower: position.tickLower,
                tickUpper: position.tickUpper,
                liquidity: position.liquidity.toString(),
                owner: ownerAddress,
            }, "Position data read from contract");
            const poolAddress = await this.computePoolAddress(chainId, position.token0, position.token1, position.fee);
            this.logger.debug({
                poolAddress,
                token0: position.token0,
                token1: position.token1,
                fee: position.fee,
            }, "Pool address computed/discovered");
            const pool = await this.poolService.discover({
                poolAddress,
                chainId,
            });
            this.logger.debug({
                poolId: pool.id,
                token0: pool.token0.symbol,
                token1: pool.token1.symbol,
            }, "Pool discovered/fetched");
            let isToken0Quote;
            if (normalizedQuoteAddress) {
                const token0Matches = compareAddresses(pool.token0.config.address, normalizedQuoteAddress) === 0;
                const token1Matches = compareAddresses(pool.token1.config.address, normalizedQuoteAddress) === 0;
                if (!token0Matches && !token1Matches) {
                    const error = new Error(`Quote token address ${normalizedQuoteAddress} does not match either pool token. ` +
                        `Pool token0: ${pool.token0.config.address}, token1: ${pool.token1.config.address}`);
                    log.methodError(this.logger, "discover", error, {
                        userId,
                        chainId,
                        nftId,
                        quoteTokenAddress: normalizedQuoteAddress,
                        poolToken0: pool.token0.config.address,
                        poolToken1: pool.token1.config.address,
                    });
                    throw error;
                }
                isToken0Quote = token0Matches;
                this.logger.debug({
                    isToken0Quote,
                    quoteToken: isToken0Quote
                        ? pool.token0.symbol
                        : pool.token1.symbol,
                }, "Quote token determined from caller input");
            }
            else {
                this.logger.debug("Auto-detecting quote token using QuoteTokenService");
                const quoteResult = await this.quoteTokenService.determineQuoteToken({
                    userId,
                    chainId,
                    token0Address: pool.token0.config.address,
                    token1Address: pool.token1.config.address,
                });
                isToken0Quote = quoteResult.isToken0Quote;
                this.logger.debug({
                    isToken0Quote,
                    quoteToken: isToken0Quote
                        ? pool.token0.symbol
                        : pool.token1.symbol,
                    matchedBy: quoteResult.matchedBy,
                }, "Quote token auto-detected");
            }
            const baseToken = isToken0Quote ? pool.token1 : pool.token0;
            const quoteToken = isToken0Quote ? pool.token0 : pool.token1;
            this.logger.debug({
                isToken0Quote,
                baseToken: baseToken.symbol,
                quoteToken: quoteToken.symbol,
            }, "Token roles determined");
            const config = {
                chainId,
                nftId,
                poolAddress,
                tickUpper: position.tickUpper,
                tickLower: position.tickLower,
            };
            const state = {
                ownerAddress: normalizeAddress(ownerAddress),
                liquidity: position.liquidity,
                feeGrowthInside0LastX128: position.feeGrowthInside0LastX128,
                feeGrowthInside1LastX128: position.feeGrowthInside1LastX128,
                tokensOwed0: position.tokensOwed0,
                tokensOwed1: position.tokensOwed1,
                unclaimedFees0: 0n,
                unclaimedFees1: 0n,
            };
            this.logger.debug({
                ownerAddress: state.ownerAddress,
                liquidity: state.liquidity.toString(),
                tokensOwed0: state.tokensOwed0.toString(),
                tokensOwed1: state.tokensOwed1.toString(),
            }, "Position state initialized from on-chain data");
            const createdPosition = await this.create({
                protocol: "uniswapv3",
                positionType: "CL_TICKS",
                userId,
                poolId: pool.id,
                isToken0Quote,
                config,
                state,
            });
            this.logger.info({
                id: createdPosition.id,
                userId,
                chainId,
                nftId,
                poolId: pool.id,
                baseToken: baseToken.symbol,
                quoteToken: quoteToken.symbol,
            }, "Position discovered and created");
            try {
                this.logger.info({ positionId: createdPosition.id }, "Discovering ledger events from blockchain");
                const syncResult = await syncLedgerEvents({
                    positionId: createdPosition.id,
                    chainId: createdPosition.config.chainId,
                    nftId: BigInt(createdPosition.config.nftId),
                    forceFullResync: true,
                }, {
                    prisma: this.prisma,
                    etherscanClient: this.etherscanClient,
                    evmBlockService: this.evmBlockService,
                    aprService: this.aprService,
                    logger: this.logger,
                    ledgerService: this.ledgerService,
                    poolPriceService: this.poolPriceService,
                });
                this.logger.info({
                    positionId: createdPosition.id,
                    eventsAdded: syncResult.eventsAdded,
                    fromBlock: syncResult.fromBlock.toString(),
                    finalizedBlock: syncResult.finalizedBlock.toString(),
                }, "Ledger events discovered successfully");
                if (syncResult.eventsAdded > 0) {
                    const mostRecentEvent = await this.ledgerService.getMostRecentEvent(createdPosition.id);
                    if (mostRecentEvent) {
                        const eventConfig = mostRecentEvent.config;
                        const currentPosition = await this.findById(createdPosition.id);
                        if (!currentPosition) {
                            throw new Error(`Position ${createdPosition.id} not found after sync`);
                        }
                        const finalLiquidity = typeof eventConfig.liquidityAfter === "string" ? BigInt(eventConfig.liquidityAfter) : eventConfig.liquidityAfter;
                        if (finalLiquidity !== undefined) {
                            currentPosition.state.liquidity = finalLiquidity;
                        }
                        else {
                            this.logger.warn({ positionId: createdPosition.id, eventType: mostRecentEvent.eventType }, "Most recent event has no liquidityAfter - skipping update");
                        }
                        const stateDB = this.serializeState(currentPosition.state);
                        await this.prisma.position.update({
                            where: { id: createdPosition.id },
                            data: { state: stateDB },
                        });
                        createdPosition.state.liquidity = currentPosition.state.liquidity;
                    }
                }
            }
            catch (error) {
                this.logger.warn({ error, positionId: createdPosition.id }, "Failed to discover ledger events, position will have zero PnL");
            }
            try {
                this.logger.debug({ positionId: createdPosition.id }, "Calculating position common fields");
                const ledgerSummary = await this.getLedgerSummary(createdPosition.id);
                const currentValue = this.calculateCurrentPositionValue(createdPosition, pool);
                const unrealizedPnl = currentValue - ledgerSummary.costBasis;
                const fees = await this.calculateUnclaimedFees(createdPosition, pool);
                createdPosition.state.unclaimedFees0 = fees.unclaimedFees0;
                createdPosition.state.unclaimedFees1 = fees.unclaimedFees1;
                const stateDB = this.serializeState(createdPosition.state);
                await this.prisma.position.update({
                    where: { id: createdPosition.id },
                    data: { state: stateDB },
                });
                const { priceRangeLower, priceRangeUpper } = this.calculatePriceRange(createdPosition, pool);
                await this.updatePositionCommonFields(createdPosition.id, {
                    currentValue,
                    currentCostBasis: ledgerSummary.costBasis,
                    realizedPnl: ledgerSummary.realizedPnl,
                    unrealizedPnl,
                    collectedFees: ledgerSummary.collectedFees,
                    unClaimedFees: fees.unclaimedFeesValue,
                    lastFeesCollectedAt: ledgerSummary.lastFeesCollectedAt.getTime() === 0
                        ? createdPosition.positionOpenedAt
                        : ledgerSummary.lastFeesCollectedAt,
                    priceRangeLower,
                    priceRangeUpper,
                });
                this.logger.info({
                    positionId: createdPosition.id,
                    currentValue: currentValue.toString(),
                    costBasis: ledgerSummary.costBasis.toString(),
                    unrealizedPnl: unrealizedPnl.toString(),
                }, "Position common fields calculated and updated");
            }
            catch (error) {
                this.logger.error({
                    error,
                    positionId: createdPosition.id,
                }, "Failed to calculate/update common fields, deleting orphaned position");
                await this.delete(createdPosition.id);
                throw error;
            }
            log.methodExit(this.logger, "discover", {
                id: createdPosition.id,
                fromDatabase: false,
            });
            const finalPosition = await this.findById(createdPosition.id);
            return finalPosition ?? createdPosition;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("Invalid") ||
                    error.message.includes("Chain") ||
                    error.message.includes("Quote token")))) {
                log.methodError(this.logger, "discover", error, {
                    userId,
                    chainId,
                    nftId,
                    quoteTokenAddress,
                });
            }
            throw error;
        }
    }
    async computePoolAddress(chainId, token0, token1, fee) {
        const factoryAddress = getFactoryAddress(chainId);
        const client = this.evmConfig.getPublicClient(chainId);
        this.logger.debug({ factoryAddress, token0, token1, fee, chainId }, "Querying factory for pool address");
        const poolAddress = (await client.readContract({
            address: factoryAddress,
            abi: UNISWAP_V3_FACTORY_ABI,
            functionName: "getPool",
            args: [token0, token1, fee],
        }));
        const zeroAddress = "0x0000000000000000000000000000000000000000";
        if (poolAddress.toLowerCase() === zeroAddress.toLowerCase() ||
            poolAddress === zeroAddress) {
            throw new Error(`Pool does not exist for token0=${token0}, token1=${token1}, fee=${fee} on chain ${chainId}`);
        }
        this.logger.debug({ poolAddress, token0, token1, fee }, "Pool address retrieved from factory");
        return normalizeAddress(poolAddress);
    }
    async refresh(id) {
        log.methodEntry(this.logger, "refresh", { id });
        try {
            const existingPosition = await this.findById(id);
            if (!existingPosition) {
                const error = new Error(`Position not found: ${id}`);
                log.methodError(this.logger, "refresh", error, { id });
                throw error;
            }
            const now = new Date();
            const ageSeconds = (now.getTime() - existingPosition.updatedAt.getTime()) / 1000;
            const positionAgeSeconds = (now.getTime() - existingPosition.createdAt.getTime()) / 1000;
            const isNewlyCreated = positionAgeSeconds < 5;
            if (!isNewlyCreated && ageSeconds < 15) {
                this.logger.info({ id, ageSeconds: ageSeconds.toFixed(2) }, "Position updated recently, returning cached data");
                log.methodExit(this.logger, "refresh", { id, cached: true });
                return existingPosition;
            }
            if (isNewlyCreated) {
                this.logger.debug({ id, positionAgeSeconds: positionAgeSeconds.toFixed(2) }, "Position newly created, bypassing cache to process missing events");
            }
            this.logger.debug({
                id,
                chainId: existingPosition.config.chainId,
                nftId: existingPosition.config.nftId,
            }, "Position found, proceeding with state refresh");
            const { chainId, nftId } = existingPosition.config;
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(", ")}`);
                log.methodError(this.logger, "refresh", error, { id, chainId });
                throw error;
            }
            this.logger.debug({ id, chainId }, "Chain is supported, proceeding with on-chain state read");
            const positionManagerAddress = getPositionManagerAddress(chainId);
            const client = this.evmConfig.getPublicClient(chainId);
            this.logger.debug({ id, positionManagerAddress, nftId, chainId }, "Reading fresh position state from NonfungiblePositionManager");
            let updatedState;
            const [positionData, ownerAddress] = await Promise.all([
                client.readContract({
                    address: positionManagerAddress,
                    abi: UNISWAP_V3_POSITION_MANAGER_ABI,
                    functionName: "positions",
                    args: [BigInt(nftId)],
                }),
                client.readContract({
                    address: positionManagerAddress,
                    abi: UNISWAP_V3_POSITION_MANAGER_ABI,
                    functionName: "ownerOf",
                    args: [BigInt(nftId)],
                }),
            ]);
            this.logger.debug({
                id,
                liquidity: positionData[7].toString(),
                feeGrowthInside0LastX128: positionData[8].toString(),
                feeGrowthInside1LastX128: positionData[9].toString(),
                tokensOwed0: positionData[10].toString(),
                tokensOwed1: positionData[11].toString(),
                owner: ownerAddress,
            }, "Position state read from on-chain");
            updatedState = {
                ownerAddress: normalizeAddress(ownerAddress),
                liquidity: positionData[7],
                feeGrowthInside0LastX128: positionData[8],
                feeGrowthInside1LastX128: positionData[9],
                tokensOwed0: positionData[10],
                tokensOwed1: positionData[11],
                unclaimedFees0: 0n,
                unclaimedFees1: 0n,
            };
            this.logger.debug({
                id,
                ownerAddress: updatedState.ownerAddress,
                liquidity: updatedState.liquidity.toString(),
                stateSource: "on-chain",
            }, "State updated from on-chain data");
            this.logger.debug({ id }, "Checking for missing events in sync state");
            const finalizedBlock = await this.evmBlockService.getLastFinalizedBlockNumber(chainId);
            if (finalizedBlock === null || finalizedBlock === undefined) {
                const error = new Error(`Failed to retrieve finalized block number for chain ${chainId}. ` +
                    'Chain may not be supported or RPC endpoint may be unavailable.');
                this.logger.error({ id, chainId, error: error.message }, 'Finalized block is null or undefined during missing events check');
                throw error;
            }
            const syncState = await UniswapV3PositionSyncState.load(this.prisma, id);
            syncState.pruneEvents(finalizedBlock);
            const missingEvents = syncState.getMissingEventsSorted();
            await syncState.save(this.prisma, 'position-refresh');
            if (missingEvents.length > 0) {
                this.logger.info({
                    id,
                    missingEventCount: missingEvents.length,
                    oldestBlock: missingEvents[0]?.blockNumber,
                    newestBlock: missingEvents[missingEvents.length - 1]?.blockNumber,
                }, "Missing events detected - forcing ledger sync (skipping state checks)");
                const syncResult = await syncLedgerEvents({
                    positionId: id,
                    chainId,
                    nftId: BigInt(nftId),
                    forceFullResync: false,
                }, {
                    prisma: this.prisma,
                    etherscanClient: this.etherscanClient,
                    evmBlockService: this.evmBlockService,
                    aprService: this.aprService,
                    logger: this.logger,
                    ledgerService: this.ledgerService,
                    poolPriceService: this.poolPriceService,
                });
                this.logger.info({
                    id,
                    eventsAdded: syncResult.eventsAdded,
                    fromBlock: syncResult.fromBlock.toString(),
                    finalizedBlock: syncResult.finalizedBlock.toString(),
                }, "Ledger events synced successfully after missing events detection");
                const syncedPosition = await this.findById(id);
                if (!syncedPosition) {
                    throw new Error(`Position ${id} not found after syncing missing events`);
                }
                this.logger.debug({ poolId: syncedPosition.pool.id }, "Refreshing pool state to get current sqrtPriceX96 and tick");
                const pool = await this.poolService.refresh(syncedPosition.pool.id);
                this.logger.debug({
                    id,
                    poolId: pool.id,
                    sqrtPriceX96: pool.state.sqrtPriceX96.toString(),
                    currentTick: pool.state.currentTick
                }, "Position re-fetched after missing events sync, pool state refreshed - proceeding to value calculation");
                this.logger.debug({ id }, "Syncing position.state with ledger after event processing");
                const lastEvents = await this.ledgerService.findAllItems(id);
                const lastLedgerEvent = lastEvents[0];
                if (lastLedgerEvent) {
                    const ledgerLiquidity = lastLedgerEvent.config.liquidityAfter ?? 0n;
                    const currentStateLiquidity = syncedPosition.state.liquidity;
                    if (ledgerLiquidity !== currentStateLiquidity) {
                        this.logger.info({
                            id,
                            oldLiquidity: currentStateLiquidity.toString(),
                            newLiquidity: ledgerLiquidity.toString(),
                        }, "Updating position.state.liquidity to match ledger");
                        const updatedState = {
                            ...syncedPosition.state,
                            liquidity: ledgerLiquidity,
                        };
                        const stateDB = this.serializeState(updatedState);
                        await this.prisma.position.update({
                            where: { id },
                            data: {
                                state: stateDB,
                            },
                        });
                        syncedPosition.state.liquidity = ledgerLiquidity;
                    }
                    const hasRecentCollect = lastLedgerEvent && lastLedgerEvent.eventType === 'COLLECT';
                    if (hasRecentCollect) {
                        this.logger.info({
                            id,
                            collectTimestamp: lastLedgerEvent.timestamp.toISOString(),
                        }, "COLLECT event detected - refreshing fee growth checkpoints from on-chain");
                        const positionManagerAddress = getPositionManagerAddress(chainId);
                        const client = this.evmConfig.getPublicClient(chainId);
                        const [freshPositionData] = await Promise.all([
                            client.readContract({
                                address: positionManagerAddress,
                                abi: UNISWAP_V3_POSITION_MANAGER_ABI,
                                functionName: "positions",
                                args: [BigInt(nftId)],
                            }),
                        ]);
                        this.logger.debug({
                            id,
                            oldCheckpoint0: syncedPosition.state.feeGrowthInside0LastX128.toString(),
                            newCheckpoint0: freshPositionData[8].toString(),
                            oldCheckpoint1: syncedPosition.state.feeGrowthInside1LastX128.toString(),
                            newCheckpoint1: freshPositionData[9].toString(),
                            oldTokensOwed0: syncedPosition.state.tokensOwed0.toString(),
                            newTokensOwed0: freshPositionData[10].toString(),
                            oldTokensOwed1: syncedPosition.state.tokensOwed1.toString(),
                            newTokensOwed1: freshPositionData[11].toString(),
                        }, "Fee growth checkpoints comparison (old vs new)");
                        const refreshedState = {
                            ...syncedPosition.state,
                            feeGrowthInside0LastX128: freshPositionData[8],
                            feeGrowthInside1LastX128: freshPositionData[9],
                            tokensOwed0: freshPositionData[10],
                            tokensOwed1: freshPositionData[11],
                        };
                        const refreshedStateDB = this.serializeState(refreshedState);
                        await this.prisma.position.update({
                            where: { id },
                            data: {
                                state: refreshedStateDB,
                            },
                        });
                        syncedPosition.state.feeGrowthInside0LastX128 = freshPositionData[8];
                        syncedPosition.state.feeGrowthInside1LastX128 = freshPositionData[9];
                        syncedPosition.state.tokensOwed0 = freshPositionData[10];
                        syncedPosition.state.tokensOwed1 = freshPositionData[11];
                        this.logger.info({ id }, "Fee growth checkpoints refreshed successfully after COLLECT");
                    }
                    const isLiquidityZero = ledgerLiquidity === 0n;
                    const isLastEventCollect = lastLedgerEvent.eventType === 'COLLECT';
                    const isCurrentlyActive = syncedPosition.isActive;
                    if (isLiquidityZero && isLastEventCollect && isCurrentlyActive) {
                        const closedAt = lastLedgerEvent.timestamp;
                        this.logger.info({
                            id,
                            closedAt: closedAt.toISOString(),
                            lastEventType: lastLedgerEvent.eventType,
                        }, "Position fully closed - setting isActive=false and positionClosedAt");
                        await this.prisma.position.update({
                            where: { id },
                            data: {
                                isActive: false,
                                positionClosedAt: closedAt,
                            },
                        });
                        syncedPosition.isActive = false;
                        syncedPosition.positionClosedAt = closedAt;
                    }
                }
                const ledgerSummary = await this.getLedgerSummary(id);
                const currentValue = this.calculateCurrentPositionValue(syncedPosition, pool);
                const unrealizedPnl = currentValue - ledgerSummary.costBasis;
                const fees = await this.calculateUnclaimedFees(syncedPosition, pool);
                syncedPosition.state.unclaimedFees0 = fees.unclaimedFees0;
                syncedPosition.state.unclaimedFees1 = fees.unclaimedFees1;
                const feeStateDB = this.serializeState(syncedPosition.state);
                await this.prisma.position.update({
                    where: { id },
                    data: { state: feeStateDB },
                });
                const { priceRangeLower, priceRangeUpper } = this.calculatePriceRange(syncedPosition, pool);
                await this.updatePositionCommonFields(id, {
                    currentValue,
                    currentCostBasis: ledgerSummary.costBasis,
                    realizedPnl: ledgerSummary.realizedPnl,
                    unrealizedPnl,
                    collectedFees: ledgerSummary.collectedFees,
                    unClaimedFees: fees.unclaimedFeesValue,
                    lastFeesCollectedAt: ledgerSummary.lastFeesCollectedAt.getTime() === 0
                        ? syncedPosition.positionOpenedAt
                        : ledgerSummary.lastFeesCollectedAt,
                    priceRangeLower,
                    priceRangeUpper,
                });
                this.logger.info({
                    id,
                    currentValue: currentValue.toString(),
                    costBasis: ledgerSummary.costBasis.toString(),
                    unrealizedPnl: unrealizedPnl.toString(),
                    unClaimedFees: fees.unclaimedFeesValue.toString(),
                }, "Position values calculated and updated after missing events sync");
                const finalPosition = await this.findById(id);
                return finalPosition ?? syncedPosition;
            }
            else {
                this.logger.debug({ id }, "No missing events found - proceeding with normal state checks");
                this.logger.debug({ id }, "Checking ledger liquidity consistency with on-chain state");
                const lastEvents = await this.ledgerService.findAllItems(id);
                const lastLedgerEvent = lastEvents[0];
                const ledgerLiquidity = lastLedgerEvent?.config.liquidityAfter ?? 0n;
                const onChainLiquidity = updatedState.liquidity;
                const liquidityMismatch = ledgerLiquidity !== onChainLiquidity;
                if (liquidityMismatch) {
                    this.logger.warn({
                        id,
                        ledgerLiquidity: ledgerLiquidity.toString(),
                        onChainLiquidity: onChainLiquidity.toString(),
                        delta: (onChainLiquidity - ledgerLiquidity).toString(),
                    }, "Liquidity mismatch detected - missing events in ledger, forcing sync");
                    const syncResult = await syncLedgerEvents({
                        positionId: id,
                        chainId,
                        nftId: BigInt(nftId),
                        forceFullResync: false,
                    }, {
                        prisma: this.prisma,
                        etherscanClient: this.etherscanClient,
                        evmBlockService: this.evmBlockService,
                        aprService: this.aprService,
                        logger: this.logger,
                        ledgerService: this.ledgerService,
                        poolPriceService: this.poolPriceService,
                    });
                    this.logger.info({
                        id,
                        eventsAdded: syncResult.eventsAdded,
                        fromBlock: syncResult.fromBlock.toString(),
                        finalizedBlock: syncResult.finalizedBlock.toString(),
                    }, "Ledger events synced successfully after liquidity mismatch");
                }
                else {
                    this.logger.debug({
                        id,
                        liquidity: ledgerLiquidity.toString(),
                    }, "Ledger liquidity consistent with on-chain - proceeding to full state check");
                    const stateChanged = (updatedState.liquidity !== existingPosition.state.liquidity ||
                        updatedState.tokensOwed0 !== existingPosition.state.tokensOwed0 ||
                        updatedState.tokensOwed1 !== existingPosition.state.tokensOwed1 ||
                        updatedState.feeGrowthInside0LastX128 !== existingPosition.state.feeGrowthInside0LastX128 ||
                        updatedState.feeGrowthInside1LastX128 !== existingPosition.state.feeGrowthInside1LastX128);
                    if (stateChanged) {
                        this.logger.info({ id, chainId, nftId }, "Position state changed on-chain, triggering ledger event sync");
                        const syncResult = await syncLedgerEvents({
                            positionId: id,
                            chainId,
                            nftId: BigInt(nftId),
                            forceFullResync: false,
                        }, {
                            prisma: this.prisma,
                            etherscanClient: this.etherscanClient,
                            evmBlockService: this.evmBlockService,
                            aprService: this.aprService,
                            logger: this.logger,
                            ledgerService: this.ledgerService,
                            poolPriceService: this.poolPriceService,
                        });
                        this.logger.info({
                            id,
                            eventsAdded: syncResult.eventsAdded,
                            fromBlock: syncResult.fromBlock.toString(),
                            finalizedBlock: syncResult.finalizedBlock.toString(),
                        }, "Ledger events synced successfully after state change detection");
                    }
                    else {
                        this.logger.debug({ id }, "No state changes detected, skipping ledger event sync");
                    }
                }
            }
            this.logger.debug({ id }, "Syncing position.state with ledger before saving (Path 2)");
            const lastEventsBeforeSave = await this.ledgerService.findAllItems(id);
            const lastLedgerEventBeforeSave = lastEventsBeforeSave[0];
            let positionClosureInfo = null;
            if (lastLedgerEventBeforeSave) {
                const ledgerLiquidityBeforeSave = lastLedgerEventBeforeSave.config.liquidityAfter ?? 0n;
                if (ledgerLiquidityBeforeSave !== updatedState.liquidity) {
                    this.logger.info({
                        id,
                        oldLiquidity: updatedState.liquidity.toString(),
                        newLiquidity: ledgerLiquidityBeforeSave.toString(),
                    }, "Updating updatedState.liquidity to match ledger before save");
                    updatedState.liquidity = ledgerLiquidityBeforeSave;
                }
                const isLiquidityZero = ledgerLiquidityBeforeSave === 0n;
                const isLastEventCollect = lastLedgerEventBeforeSave.eventType === 'COLLECT';
                const isCurrentlyActive = existingPosition.isActive;
                if (isLiquidityZero && isLastEventCollect && isCurrentlyActive) {
                    const closedAt = lastLedgerEventBeforeSave.timestamp;
                    this.logger.info({
                        id,
                        closedAt: closedAt.toISOString(),
                        lastEventType: lastLedgerEventBeforeSave.eventType,
                    }, "Position fully closed - will mark as closed after state update");
                    positionClosureInfo = { shouldClose: true, closedAt };
                }
            }
            const stateDB = this.serializeState(updatedState);
            log.dbOperation(this.logger, "update", "Position", {
                id,
                fields: ["state"],
            });
            const result = await this.prisma.position.update({
                where: { id },
                data: {
                    state: stateDB,
                },
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            const refreshedPosition = this.mapToPosition(result);
            this.logger.info({
                id,
                chainId,
                nftId,
                liquidity: updatedState.liquidity.toString(),
            }, "Position state refreshed successfully");
            if (positionClosureInfo?.shouldClose) {
                this.logger.info({
                    id,
                    closedAt: positionClosureInfo.closedAt.toISOString(),
                }, "Marking position as closed");
                await this.prisma.position.update({
                    where: { id },
                    data: {
                        isActive: false,
                        positionClosedAt: positionClosureInfo.closedAt,
                    },
                });
                refreshedPosition.isActive = false;
                refreshedPosition.positionClosedAt = positionClosureInfo.closedAt;
            }
            this.logger.debug({ positionId: id }, "Recalculating position common fields");
            this.logger.debug({ poolId: refreshedPosition.pool.id }, "Refreshing pool state to get current sqrtPriceX96 and tick");
            const pool = await this.poolService.refresh(refreshedPosition.pool.id);
            this.logger.debug({
                poolId: pool.id,
                sqrtPriceX96: pool.state.sqrtPriceX96.toString(),
                currentTick: pool.state.currentTick
            }, "Pool state refreshed with current on-chain price");
            const ledgerSummary = await this.getLedgerSummary(id);
            const currentValue = this.calculateCurrentPositionValue(refreshedPosition, pool);
            const unrealizedPnl = currentValue - ledgerSummary.costBasis;
            const fees = await this.calculateUnclaimedFees(refreshedPosition, pool);
            refreshedPosition.state.unclaimedFees0 = fees.unclaimedFees0;
            refreshedPosition.state.unclaimedFees1 = fees.unclaimedFees1;
            const feeUpdatedStateDB = this.serializeState(refreshedPosition.state);
            await this.prisma.position.update({
                where: { id },
                data: { state: feeUpdatedStateDB },
            });
            const { priceRangeLower, priceRangeUpper } = this.calculatePriceRange(refreshedPosition, pool);
            await this.updatePositionCommonFields(id, {
                currentValue,
                currentCostBasis: ledgerSummary.costBasis,
                realizedPnl: ledgerSummary.realizedPnl,
                unrealizedPnl,
                collectedFees: ledgerSummary.collectedFees,
                unClaimedFees: fees.unclaimedFeesValue,
                lastFeesCollectedAt: ledgerSummary.lastFeesCollectedAt.getTime() === 0
                    ? refreshedPosition.positionOpenedAt
                    : ledgerSummary.lastFeesCollectedAt,
                priceRangeLower,
                priceRangeUpper,
            });
            this.logger.info({
                positionId: id,
                currentValue: currentValue.toString(),
                unrealizedPnl: unrealizedPnl.toString(),
                unClaimedFees: fees.unclaimedFeesValue.toString(),
            }, "Position common fields recalculated and updated");
            log.methodExit(this.logger, "refresh", { id });
            const finalPosition = await this.findById(id);
            return finalPosition ?? refreshedPosition;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("not found") ||
                    error.message.includes("Chain")))) {
                log.methodError(this.logger, "refresh", error, { id });
            }
            throw error;
        }
    }
    async reset(id) {
        log.methodEntry(this.logger, "reset", { id });
        try {
            const existingPosition = await this.findById(id);
            if (!existingPosition) {
                const error = new Error(`Position not found: ${id}`);
                log.methodError(this.logger, "reset", error, { id });
                throw error;
            }
            this.logger.info({
                positionId: id,
                chainId: existingPosition.config.chainId,
                nftId: existingPosition.config.nftId,
            }, "Starting position reset - rediscovering ledger events from blockchain");
            this.logger.info({ positionId: id }, "Deleting old events and rediscovering from blockchain");
            const syncResult = await syncLedgerEvents({
                positionId: id,
                chainId: existingPosition.config.chainId,
                nftId: BigInt(existingPosition.config.nftId),
                forceFullResync: true,
            }, {
                prisma: this.prisma,
                etherscanClient: this.etherscanClient,
                evmBlockService: this.evmBlockService,
                aprService: this.aprService,
                logger: this.logger,
                ledgerService: this.ledgerService,
                poolPriceService: this.poolPriceService,
            });
            this.logger.info({
                positionId: id,
                eventsAdded: syncResult.eventsAdded,
                fromBlock: syncResult.fromBlock.toString(),
                finalizedBlock: syncResult.finalizedBlock.toString(),
            }, "Ledger events rediscovered and APR periods recalculated");
            this.logger.info({ positionId: id }, "Refreshing position state from on-chain data");
            const refreshedPosition = await this.refresh(id);
            this.logger.info({
                positionId: id,
                currentValue: refreshedPosition.currentValue.toString(),
                costBasis: refreshedPosition.currentCostBasis.toString(),
                realizedPnl: refreshedPosition.realizedPnl.toString(),
                unrealizedPnl: refreshedPosition.unrealizedPnl.toString(),
            }, "Position reset complete - ledger rebuilt and state refreshed");
            log.methodExit(this.logger, "reset", { id });
            return refreshedPosition;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("not found") ||
                    error.message.includes("Chain")))) {
                log.methodError(this.logger, "reset", error, { id });
            }
            throw error;
        }
    }
    async createPositionFromUserData(userId, chainId, nftId, input) {
        log.methodEntry(this.logger, "createPositionFromUserData", {
            userId,
            chainId,
            nftId,
        });
        try {
            const positionHash = this.createPositionHash({
                chainId,
                nftId,
                poolAddress: input.poolAddress,
                tickLower: input.tickLower,
                tickUpper: input.tickUpper,
            });
            const existing = await this.findByPositionHash(userId, positionHash);
            if (existing) {
                this.logger.info({
                    id: existing.id,
                    userId,
                    chainId,
                    nftId,
                    positionHash,
                }, "Position already exists, returning existing position");
                log.methodExit(this.logger, "createPositionFromUserData", {
                    id: existing.id,
                    duplicate: true,
                });
                return existing;
            }
            if (!this.evmConfig.isChainSupported(chainId)) {
                const error = new Error(`Chain ${chainId} is not configured. Supported chains: ${this.evmConfig
                    .getSupportedChainIds()
                    .join(", ")}`);
                log.methodError(this.logger, "createPositionFromUserData", error, {
                    chainId,
                });
                throw error;
            }
            if (!isValidAddress(input.poolAddress)) {
                const error = new Error(`Invalid pool address format: ${input.poolAddress}`);
                log.methodError(this.logger, "createPositionFromUserData", error, {
                    poolAddress: input.poolAddress,
                });
                throw error;
            }
            if (!isValidAddress(input.ownerAddress)) {
                const error = new Error(`Invalid owner address format: ${input.ownerAddress}`);
                log.methodError(this.logger, "createPositionFromUserData", error, {
                    ownerAddress: input.ownerAddress,
                });
                throw error;
            }
            const poolAddress = normalizeAddress(input.poolAddress);
            const ownerAddress = normalizeAddress(input.ownerAddress);
            let normalizedQuoteAddress;
            if (input.quoteTokenAddress) {
                if (!isValidAddress(input.quoteTokenAddress)) {
                    const error = new Error(`Invalid quote token address format: ${input.quoteTokenAddress}`);
                    log.methodError(this.logger, "createPositionFromUserData", error, {
                        quoteTokenAddress: input.quoteTokenAddress,
                    });
                    throw error;
                }
                normalizedQuoteAddress = normalizeAddress(input.quoteTokenAddress);
            }
            this.logger.debug({
                poolAddress,
                ownerAddress,
                quoteTokenAddress: normalizedQuoteAddress ?? "auto-detect",
            }, "Addresses validated and normalized");
            const pool = await this.poolService.discover({
                poolAddress,
                chainId,
            });
            this.logger.debug({
                poolId: pool.id,
                token0: pool.token0.symbol,
                token1: pool.token1.symbol,
            }, "Pool discovered/fetched");
            let isToken0Quote;
            if (normalizedQuoteAddress) {
                const token0Matches = compareAddresses(pool.token0.config.address, normalizedQuoteAddress) === 0;
                const token1Matches = compareAddresses(pool.token1.config.address, normalizedQuoteAddress) === 0;
                if (!token0Matches && !token1Matches) {
                    const error = new Error(`Quote token address ${normalizedQuoteAddress} does not match either pool token. ` +
                        `Pool token0: ${pool.token0.config.address}, token1: ${pool.token1.config.address}`);
                    log.methodError(this.logger, "createPositionFromUserData", error, {
                        quoteTokenAddress: normalizedQuoteAddress,
                        poolToken0: pool.token0.config.address,
                        poolToken1: pool.token1.config.address,
                    });
                    throw error;
                }
                isToken0Quote = token0Matches;
                this.logger.debug({
                    isToken0Quote,
                    quoteToken: isToken0Quote
                        ? pool.token0.symbol
                        : pool.token1.symbol,
                }, "Quote token determined from caller input");
            }
            else {
                this.logger.debug("Auto-detecting quote token using QuoteTokenService");
                const quoteResult = await this.quoteTokenService.determineQuoteToken({
                    userId,
                    chainId,
                    token0Address: pool.token0.config.address,
                    token1Address: pool.token1.config.address,
                });
                isToken0Quote = quoteResult.isToken0Quote;
                this.logger.debug({
                    isToken0Quote,
                    quoteToken: isToken0Quote
                        ? pool.token0.symbol
                        : pool.token1.symbol,
                    matchedBy: quoteResult.matchedBy,
                }, "Quote token auto-detected");
            }
            const baseToken = isToken0Quote ? pool.token1 : pool.token0;
            const quoteToken = isToken0Quote ? pool.token0 : pool.token1;
            this.logger.debug({
                isToken0Quote,
                baseToken: baseToken.symbol,
                quoteToken: quoteToken.symbol,
            }, "Token roles determined");
            const config = {
                chainId,
                nftId,
                poolAddress,
                tickUpper: input.tickUpper,
                tickLower: input.tickLower,
            };
            this.logger.debug({
                poolAddress,
                blockNumber: input.increaseEvent.blockNumber.toString(),
                tickLower: input.tickLower,
                tickUpper: input.tickUpper,
            }, "Fetching fee growth inside at position creation block");
            const client = this.evmConfig.getPublicClient(chainId);
            const blockNumber = input.increaseEvent.blockNumber;
            const [feeGrowthGlobal0X128, feeGrowthGlobal1X128, tickDataLower, tickDataUpper, poolSlot0,] = await Promise.all([
                client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "feeGrowthGlobal0X128",
                    blockNumber,
                }),
                client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "feeGrowthGlobal1X128",
                    blockNumber,
                }),
                client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "ticks",
                    args: [input.tickLower],
                    blockNumber,
                }),
                client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "ticks",
                    args: [input.tickUpper],
                    blockNumber,
                }),
                client.readContract({
                    address: poolAddress,
                    abi: uniswapV3PoolAbi,
                    functionName: "slot0",
                    blockNumber,
                }),
            ]);
            const currentTick = poolSlot0[1];
            const feeGrowthOutsideLower0X128 = tickDataLower[2];
            const feeGrowthOutsideLower1X128 = tickDataLower[3];
            const feeGrowthOutsideUpper0X128 = tickDataUpper[2];
            const feeGrowthOutsideUpper1X128 = tickDataUpper[3];
            const feeGrowthInside = computeFeeGrowthInside(currentTick, input.tickLower, input.tickUpper, feeGrowthGlobal0X128, feeGrowthGlobal1X128, feeGrowthOutsideLower0X128, feeGrowthOutsideLower1X128, feeGrowthOutsideUpper0X128, feeGrowthOutsideUpper1X128);
            this.logger.debug({
                feeGrowthInside0: feeGrowthInside.inside0.toString(),
                feeGrowthInside1: feeGrowthInside.inside1.toString(),
                currentTick,
            }, "Fee growth inside calculated at position creation block");
            const state = {
                ownerAddress,
                liquidity: input.increaseEvent.liquidity,
                feeGrowthInside0LastX128: feeGrowthInside.inside0,
                feeGrowthInside1LastX128: feeGrowthInside.inside1,
                tokensOwed0: 0n,
                tokensOwed1: 0n,
                unclaimedFees0: 0n,
                unclaimedFees1: 0n,
            };
            this.logger.debug({
                ownerAddress: state.ownerAddress,
                liquidity: state.liquidity.toString(),
                feeGrowthInside0LastX128: state.feeGrowthInside0LastX128.toString(),
                feeGrowthInside1LastX128: state.feeGrowthInside1LastX128.toString(),
            }, "Position state initialized with fee growth checkpoints");
            const createdPosition = await this.create({
                protocol: "uniswapv3",
                positionType: "CL_TICKS",
                userId,
                poolId: pool.id,
                isToken0Quote,
                config,
                state,
            });
            this.logger.info({
                id: createdPosition.id,
                userId,
                chainId,
                nftId,
                poolId: pool.id,
                baseToken: baseToken.symbol,
                quoteToken: quoteToken.symbol,
            }, "Position created in database");
            this.logger.debug({
                positionId: createdPosition.id,
                blockNumber: input.increaseEvent.blockNumber.toString(),
            }, "Fetching historic pool price at event blockNumber");
            const poolPriceService = new (await import("../pool-price/uniswapv3-pool-price-service.js")).UniswapV3PoolPriceService({
                prisma: this.prisma,
            });
            const poolPrice = await poolPriceService.discover(pool.id, {
                blockNumber: Number(input.increaseEvent.blockNumber),
            });
            this.logger.debug({
                positionId: createdPosition.id,
                sqrtPriceX96: poolPrice.state.sqrtPriceX96.toString(),
            }, "Historic pool price fetched");
            const sqrtPriceX96 = poolPrice.state.sqrtPriceX96;
            const poolPriceValue = calculatePoolPriceInQuoteToken(sqrtPriceX96, isToken0Quote, pool.token0.decimals, pool.token1.decimals);
            this.logger.debug({
                positionId: createdPosition.id,
                poolPrice: poolPriceValue.toString(),
                quoteToken: quoteToken.symbol,
                baseToken: baseToken.symbol,
            }, "Pool price calculated from historic sqrtPriceX96");
            const token0Amount = input.increaseEvent.amount0;
            const token1Amount = input.increaseEvent.amount1;
            const tokenValue = calculateTokenValueInQuote(token0Amount, token1Amount, sqrtPriceX96, isToken0Quote, pool.token0.decimals, pool.token1.decimals);
            this.logger.debug({
                positionId: createdPosition.id,
                tokenValue: tokenValue.toString(),
            }, "Token value calculated in quote units");
            this.logger.debug({ positionId: createdPosition.id }, "Creating initial sync state with user-provided INCREASE event");
            const { UniswapV3PositionSyncState } = await import("../position-ledger/position-sync-state.js");
            const syncState = await UniswapV3PositionSyncState.load(this.prisma, createdPosition.id);
            syncState.addMissingEvent({
                eventType: "INCREASE_LIQUIDITY",
                timestamp: input.increaseEvent.timestamp.toISOString(),
                blockNumber: input.increaseEvent.blockNumber.toString(),
                transactionIndex: input.increaseEvent.transactionIndex,
                logIndex: input.increaseEvent.logIndex,
                transactionHash: input.increaseEvent.transactionHash,
                liquidity: input.increaseEvent.liquidity.toString(),
                amount0: input.increaseEvent.amount0.toString(),
                amount1: input.increaseEvent.amount1.toString(),
            });
            await syncState.save(this.prisma, "position-create");
            this.logger.info({
                positionId: createdPosition.id,
                eventType: "INCREASE_LIQUIDITY",
                transactionHash: input.increaseEvent.transactionHash,
            }, "Initial INCREASE_LIQUIDITY event stored as missing event");
            this.logger.debug({ positionId: createdPosition.id }, "Calling refresh() to process missing event and sync blockchain events");
            const refreshedPosition = await this.refresh(createdPosition.id);
            this.logger.info({
                positionId: refreshedPosition.id,
                currentValue: refreshedPosition.currentValue.toString(),
                costBasis: refreshedPosition.currentCostBasis.toString(),
                unrealizedPnl: refreshedPosition.unrealizedPnl.toString(),
            }, "Position created and refreshed successfully");
            log.methodExit(this.logger, "createPositionFromUserData", {
                id: refreshedPosition.id,
                duplicate: false,
            });
            return refreshedPosition;
        }
        catch (error) {
            if (!(error instanceof Error &&
                (error.message.includes("Invalid") ||
                    error.message.includes("Chain") ||
                    error.message.includes("Quote token") ||
                    error.message.includes("already exists")))) {
                log.methodError(this.logger, "createPositionFromUserData", error, {
                    userId,
                    chainId,
                    nftId,
                });
            }
            throw error;
        }
    }
    async updatePositionWithEvents(userId, chainId, nftId, events) {
        log.methodEntry(this.logger, "updatePositionWithEvents", {
            userId,
            chainId,
            nftId,
            eventCount: events.length,
        });
        try {
            const positionHash = this.createPositionHash({
                chainId,
                nftId,
                poolAddress: "0x0000000000000000000000000000000000000000",
                tickLower: 0,
                tickUpper: 0,
            });
            log.dbOperation(this.logger, "findUnique", "Position", {
                userId,
                chainId,
                nftId,
                positionHash,
            });
            const existingPosition = await this.prisma.position.findUnique({
                where: { positionHash },
                include: { pool: true },
            });
            if (!existingPosition || existingPosition.userId !== userId) {
                this.logger.info({ userId, chainId, nftId, exists: !!existingPosition }, "Position not found or not owned by user");
                log.methodExit(this.logger, "updatePositionWithEvents", {
                    result: "not_found_or_not_owned",
                });
                return null;
            }
            this.logger.debug({ positionId: existingPosition.id, userId, chainId, nftId }, "Position found and ownership verified");
            this.logger.info({ positionId: existingPosition.id, eventCount: events.length }, "Adding events to position ledger");
            await this.ledgerService.addEventsFromUserData(existingPosition.id, events);
            this.logger.info({ positionId: existingPosition.id, eventCount: events.length }, "Events added successfully");
            this.logger.info({ positionId: existingPosition.id }, "Refreshing position state");
            const updatedPosition = await this.refresh(existingPosition.id);
            this.logger.info({
                positionId: existingPosition.id,
                liquidity: updatedPosition.state.liquidity.toString(),
                realizedPnl: updatedPosition.realizedPnl.toString(),
                unrealizedPnl: updatedPosition.unrealizedPnl.toString(),
            }, "Position refreshed with new state");
            log.methodExit(this.logger, "updatePositionWithEvents", {
                positionId: existingPosition.id,
                eventsAdded: events.length,
            });
            return updatedPosition;
        }
        catch (error) {
            log.methodError(this.logger, "updatePositionWithEvents", error, {
                userId,
                chainId,
                nftId,
                eventCount: events.length,
            });
            throw error;
        }
    }
    async create(input) {
        log.methodEntry(this.logger, "create", {
            userId: input.userId,
            chainId: input.config.chainId,
            nftId: input.config.nftId,
        });
        try {
            const positionHash = this.createPositionHash(input.config);
            const existing = await this.findByPositionHash(input.userId, positionHash);
            if (existing) {
                this.logger.info({
                    id: existing.id,
                    userId: input.userId,
                    chainId: input.config.chainId,
                    nftId: input.config.nftId,
                    positionHash,
                }, "Position already exists, returning existing position");
                log.methodExit(this.logger, "create", {
                    id: existing.id,
                    duplicate: true,
                });
                return existing;
            }
            const position = await super.create(input);
            log.methodExit(this.logger, "create", {
                id: position.id,
                duplicate: false,
            });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, "create", error, {
                userId: input.userId,
                chainId: input.config.chainId,
                nftId: input.config.nftId,
            });
            throw error;
        }
    }
    async findById(id) {
        log.methodEntry(this.logger, "findById", { id });
        try {
            log.dbOperation(this.logger, "findUnique", "Position", { id });
            const result = await this.prisma.position.findUnique({
                where: { id },
                include: {
                    pool: {
                        include: {
                            token0: true,
                            token1: true,
                        },
                    },
                },
            });
            if (!result) {
                log.methodExit(this.logger, "findById", { id, found: false });
                return null;
            }
            if (result.protocol !== "uniswapv3") {
                this.logger.debug({ id, protocol: result.protocol }, "Position found but is not uniswapv3 protocol");
                log.methodExit(this.logger, "findById", {
                    id,
                    found: false,
                    reason: "wrong_protocol",
                });
                return null;
            }
            const position = this.mapToPosition(result);
            log.methodExit(this.logger, "findById", { id, found: true });
            return position;
        }
        catch (error) {
            log.methodError(this.logger, "findById", error, { id });
            throw error;
        }
    }
    async delete(id) {
        log.methodEntry(this.logger, "delete", { id });
        try {
            log.dbOperation(this.logger, "findUnique", "Position", { id });
            const existing = await this.prisma.position.findUnique({
                where: { id },
            });
            if (!existing) {
                this.logger.debug({ id }, "Position not found, delete operation is no-op");
                log.methodExit(this.logger, "delete", { id, deleted: false });
                return;
            }
            if (existing.protocol !== "uniswapv3") {
                const error = new Error(`Cannot delete position ${id}: expected protocol 'uniswapv3', got '${existing.protocol}'`);
                log.methodError(this.logger, "delete", error, {
                    id,
                    protocol: existing.protocol,
                });
                throw error;
            }
            await super.delete(id);
            log.methodExit(this.logger, "delete", { id, deleted: true });
        }
        catch (error) {
            if (!(error instanceof Error &&
                error.message.includes("Cannot delete"))) {
                log.methodError(this.logger, "delete", error, { id });
            }
            throw error;
        }
    }
    async getLedgerSummary(positionId) {
        try {
            const events = await this.ledgerService.findAllItems(positionId);
            if (events.length === 0) {
                return {
                    costBasis: 0n,
                    realizedPnl: 0n,
                    collectedFees: 0n,
                    lastFeesCollectedAt: new Date(0),
                };
            }
            const latestEvent = await this.ledgerService.getMostRecentEvent(positionId);
            if (!latestEvent) {
                throw new Error(`Expected to find events but got null`);
            }
            let collectedFees = 0n;
            let lastFeesCollectedAt = null;
            for (const event of events) {
                if (event.eventType === "COLLECT" && event.rewards.length > 0) {
                    for (const reward of event.rewards) {
                        collectedFees += reward.tokenValue;
                    }
                    if (!lastFeesCollectedAt ||
                        event.timestamp > lastFeesCollectedAt) {
                        lastFeesCollectedAt = event.timestamp;
                    }
                }
            }
            return {
                costBasis: latestEvent.costBasisAfter,
                realizedPnl: latestEvent.pnlAfter,
                collectedFees,
                lastFeesCollectedAt: lastFeesCollectedAt ?? new Date(0),
            };
        }
        catch (error) {
            this.logger.warn({ error, positionId }, "Failed to get ledger summary, using defaults");
            return {
                costBasis: 0n,
                realizedPnl: 0n,
                collectedFees: 0n,
                lastFeesCollectedAt: new Date(0),
            };
        }
    }
    async calculateUnclaimedFees(position, pool) {
        return calculateUnclaimedFees(position, pool, this.evmConfig, this.ledgerService, this.logger);
    }
    calculateCurrentPositionValue(position, pool) {
        const { tickLower, tickUpper } = position.config;
        const { liquidity } = position.state;
        const { sqrtPriceX96 } = pool.state;
        if (liquidity === 0n) {
            return 0n;
        }
        const baseIsToken0 = !position.isToken0Quote;
        const positionValue = calculatePositionValue(liquidity, sqrtPriceX96, tickLower, tickUpper, baseIsToken0);
        return positionValue;
    }
    calculatePriceRange(position, pool) {
        const { tickLower, tickUpper } = position.config;
        const baseToken = position.isToken0Quote ? pool.token1 : pool.token0;
        const quoteToken = position.isToken0Quote ? pool.token0 : pool.token1;
        const baseTokenAddress = baseToken.config.address;
        const quoteTokenAddress = quoteToken.config.address;
        const baseTokenDecimals = baseToken.decimals;
        const priceRangeLower = tickToPrice(tickLower, baseTokenAddress, quoteTokenAddress, baseTokenDecimals);
        const priceRangeUpper = tickToPrice(tickUpper, baseTokenAddress, quoteTokenAddress, baseTokenDecimals);
        return { priceRangeLower, priceRangeUpper };
    }
    async updatePositionCommonFields(positionId, fields) {
        log.dbOperation(this.logger, "update", "Position", {
            id: positionId,
            fields: [
                "currentValue",
                "currentCostBasis",
                "realizedPnl",
                "unrealizedPnl",
                "collectedFees",
                "unClaimedFees",
                "lastFeesCollectedAt",
                "priceRangeLower",
                "priceRangeUpper",
            ],
        });
        await this.prisma.position.update({
            where: { id: positionId },
            data: {
                currentValue: fields.currentValue.toString(),
                currentCostBasis: fields.currentCostBasis.toString(),
                realizedPnl: fields.realizedPnl.toString(),
                unrealizedPnl: fields.unrealizedPnl.toString(),
                collectedFees: fields.collectedFees.toString(),
                unClaimedFees: fields.unClaimedFees.toString(),
                lastFeesCollectedAt: fields.lastFeesCollectedAt,
                priceRangeLower: fields.priceRangeLower.toString(),
                priceRangeUpper: fields.priceRangeUpper.toString(),
            },
        });
        this.logger.debug({
            positionId,
            currentValue: fields.currentValue.toString(),
            currentCostBasis: fields.currentCostBasis.toString(),
            unrealizedPnl: fields.unrealizedPnl.toString(),
        }, "Position common fields updated");
    }
    async getCurrentLiquidityFromLedger(positionId) {
        const lastEvent = await this.prisma.positionLedgerEvent.findFirst({
            where: { positionId },
            orderBy: { timestamp: "desc" },
            select: { config: true },
        });
        if (!lastEvent) {
            this.logger.debug({ positionId }, "No ledger events found, returning liquidity = 0");
            return 0n;
        }
        const config = lastEvent.config;
        const liquidityAfter = config.liquidityAfter
            ? BigInt(config.liquidityAfter)
            : 0n;
        this.logger.debug({ positionId, liquidityAfter: liquidityAfter.toString() }, "Retrieved liquidity from last ledger event");
        return liquidityAfter;
    }
    async getPositionCloseTimestamp(positionId) {
        const lastEvent = await this.prisma.positionLedgerEvent.findFirst({
            where: { positionId },
            orderBy: { timestamp: "desc" },
            select: { eventType: true, timestamp: true, config: true },
        });
        if (!lastEvent) {
            this.logger.debug({ positionId }, "No ledger events found, position not closed");
            return null;
        }
        if (lastEvent.eventType !== "COLLECT") {
            this.logger.debug({ positionId, lastEventType: lastEvent.eventType }, "Last event is not COLLECT, position not closed");
            return null;
        }
        const config = lastEvent.config;
        const uncollectedPrincipal0After = config.uncollectedPrincipal0After
            ? BigInt(config.uncollectedPrincipal0After)
            : 0n;
        const uncollectedPrincipal1After = config.uncollectedPrincipal1After
            ? BigInt(config.uncollectedPrincipal1After)
            : 0n;
        if (uncollectedPrincipal0After === 0n &&
            uncollectedPrincipal1After === 0n) {
            this.logger.debug({ positionId, closedAt: lastEvent.timestamp }, "Position is fully closed (final COLLECT with all principal withdrawn)");
            return lastEvent.timestamp;
        }
        this.logger.debug({
            positionId,
            uncollectedPrincipal0After: uncollectedPrincipal0After.toString(),
            uncollectedPrincipal1After: uncollectedPrincipal1After.toString(),
        }, "Position has uncollected principal, not fully closed");
        return null;
    }
}
//# sourceMappingURL=uniswapv3-position-service.js.map