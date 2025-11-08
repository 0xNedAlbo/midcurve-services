import { createHash } from 'crypto';
import { PositionLedgerService } from './position-ledger-service.js';
import { toEventConfig, toEventConfigDB, toEventState, toEventStateDB, } from '../types/uniswapv3/position-ledger-event-db.js';
import { EtherscanClient } from '../../clients/etherscan/index.js';
import { UniswapV3PositionService } from '../position/uniswapv3-position-service.js';
import { UniswapV3PoolService } from '../pool/uniswapv3-pool-service.js';
import { UniswapV3PoolPriceService } from '../pool-price/uniswapv3-pool-price-service.js';
import { calculatePoolPriceInQuoteToken, calculateTokenValueInQuote, calculateProportionalCostBasis, separateFeesFromPrincipal, } from '../../utils/uniswapv3/ledger-calculations.js';
import { log } from '../../logging/index.js';
export class UniswapV3PositionLedgerService extends PositionLedgerService {
    _etherscanClient;
    _positionService;
    _poolService;
    _poolPriceService;
    constructor(dependencies = {}) {
        super(dependencies);
        this._etherscanClient =
            dependencies.etherscanClient ?? EtherscanClient.getInstance();
        this._positionService =
            dependencies.positionService ??
                new UniswapV3PositionService({ prisma: this.prisma });
        this._poolService =
            dependencies.poolService ?? new UniswapV3PoolService({ prisma: this.prisma });
        this._poolPriceService =
            dependencies.poolPriceService ??
                new UniswapV3PoolPriceService({ prisma: this.prisma });
        this.logger.info('UniswapV3PositionLedgerService initialized');
    }
    get etherscanClient() {
        return this._etherscanClient;
    }
    get positionService() {
        return this._positionService;
    }
    get poolService() {
        return this._poolService;
    }
    get poolPriceService() {
        return this._poolPriceService;
    }
    parseConfig(configDB) {
        return toEventConfig(configDB);
    }
    serializeConfig(config) {
        return toEventConfigDB(config);
    }
    parseState(stateDB) {
        return toEventState(stateDB);
    }
    serializeState(state) {
        return toEventStateDB(state);
    }
    generateInputHash(input) {
        const { blockNumber, txIndex, logIndex } = input.config;
        const hashInput = `${blockNumber}-${txIndex}-${logIndex}`;
        return createHash('md5').update(hashInput).digest('hex');
    }
    async discoverAllEvents(positionId) {
        log.methodEntry(this.logger, 'discoverAllEvents', { positionId });
        try {
            const positionData = await this.fetchPositionData(positionId);
            const { nftId, chainId, poolId } = positionData;
            this.logger.info({ positionId, nftId, chainId, poolId }, 'Starting event discovery');
            await this.deleteAllItems(positionId);
            const poolMetadata = await this.fetchPoolMetadata(poolId);
            this.logger.info({ chainId, nftId }, 'Fetching events from Etherscan');
            const rawEvents = await this.etherscanClient.fetchPositionEvents(chainId, nftId.toString());
            this.logger.info({ positionId, eventCount: rawEvents.length }, 'Raw events fetched from Etherscan');
            if (rawEvents.length === 0) {
                this.logger.info({ positionId }, 'No events found for position');
                log.methodExit(this.logger, 'discoverAllEvents', { count: 0 });
                return [];
            }
            const sortedEvents = this.sortEventsChronologically(rawEvents);
            let previousState = {
                uncollectedPrincipal0: 0n,
                uncollectedPrincipal1: 0n,
                liquidity: 0n,
                costBasis: 0n,
                pnl: 0n,
            };
            let previousEventId = null;
            for (const rawEvent of sortedEvents) {
                this.logger.debug({
                    positionId,
                    blockNumber: rawEvent.blockNumber,
                    eventType: rawEvent.eventType,
                }, 'Processing event');
                const historicPrice = await this.getHistoricPoolPrice(poolId, rawEvent.blockNumber);
                const eventInput = await this.buildEventFromRawData({
                    rawEvent,
                    previousState,
                    poolMetadata,
                    sqrtPriceX96: historicPrice.sqrtPriceX96,
                    previousEventId,
                    positionId,
                });
                const savedEvents = await this.addItem(positionId, eventInput);
                previousEventId = savedEvents[0].id;
                previousState = {
                    uncollectedPrincipal0: eventInput.config.uncollectedPrincipal0After,
                    uncollectedPrincipal1: eventInput.config.uncollectedPrincipal1After,
                    liquidity: eventInput.config.liquidityAfter,
                    costBasis: eventInput.costBasisAfter,
                    pnl: eventInput.pnlAfter,
                };
                this.logger.debug({
                    positionId,
                    eventId: previousEventId,
                    eventType: eventInput.eventType,
                    costBasisAfter: eventInput.costBasisAfter.toString(),
                    pnlAfter: eventInput.pnlAfter.toString(),
                }, 'Event processed and saved');
            }
            this.logger.info({ positionId }, 'Calculating APR periods');
            await this.aprService.refresh(positionId);
            const allEvents = await this.findAllItems(positionId);
            this.logger.info({
                positionId,
                eventCount: allEvents.length,
                finalCostBasis: previousState.costBasis.toString(),
                finalPnl: previousState.pnl.toString(),
            }, 'Event discovery completed');
            log.methodExit(this.logger, 'discoverAllEvents', { count: allEvents.length });
            return allEvents;
        }
        catch (error) {
            log.methodError(this.logger, 'discoverAllEvents', error, {
                positionId,
            });
            throw error;
        }
    }
    async discoverEvent(positionId, input) {
        log.methodEntry(this.logger, 'discoverEvent', {
            positionId,
            eventType: input.eventType,
            blockNumber: input.blockNumber,
        });
        try {
            const positionData = await this.fetchPositionData(positionId);
            const { nftId, poolId } = positionData;
            if (nftId !== input.tokenId) {
                const error = new Error(`NFT ID mismatch: position has ${nftId}, event has ${input.tokenId}`);
                log.methodError(this.logger, 'discoverEvent', error, {
                    positionId,
                    positionNftId: nftId,
                    eventNftId: input.tokenId,
                });
                throw error;
            }
            const poolMetadata = await this.fetchPoolMetadata(poolId);
            const existingEvents = await this.findAllItems(positionId);
            const lastEvent = existingEvents[0];
            if (lastEvent && input.timestamp <= lastEvent.timestamp) {
                const error = new Error(`Event timestamp (${input.timestamp.toISOString()}) must be after last event (${lastEvent.timestamp.toISOString()})`);
                log.methodError(this.logger, 'discoverEvent', error, {
                    positionId,
                    eventTimestamp: input.timestamp,
                    lastEventTimestamp: lastEvent.timestamp,
                });
                throw error;
            }
            const previousState = lastEvent
                ? {
                    uncollectedPrincipal0: lastEvent.config.uncollectedPrincipal0After,
                    uncollectedPrincipal1: lastEvent.config.uncollectedPrincipal1After,
                    liquidity: lastEvent.config.liquidityAfter,
                    costBasis: lastEvent.costBasisAfter,
                    pnl: lastEvent.pnlAfter,
                }
                : {
                    uncollectedPrincipal0: 0n,
                    uncollectedPrincipal1: 0n,
                    liquidity: 0n,
                    costBasis: 0n,
                    pnl: 0n,
                };
            const previousEventId = lastEvent?.id ?? null;
            this.logger.info({ positionId, blockNumber: input.blockNumber }, 'Discovering historic pool price');
            const historicPrice = await this.getHistoricPoolPrice(poolId, input.blockNumber);
            const rawEvent = this.convertDiscoverInputToRawEvent(input, positionData.chainId);
            const eventInput = await this.buildEventFromRawData({
                rawEvent,
                previousState,
                poolMetadata,
                sqrtPriceX96: historicPrice.sqrtPriceX96,
                previousEventId,
                positionId,
            });
            const allEvents = await this.addItem(positionId, eventInput);
            this.logger.info({
                positionId,
                eventId: allEvents[0].id,
                eventType: input.eventType,
                costBasisAfter: eventInput.costBasisAfter.toString(),
                pnlAfter: eventInput.pnlAfter.toString(),
            }, 'Single event discovered and saved');
            this.logger.info({ positionId }, 'Refreshing APR periods');
            await this.aprService.refresh(positionId);
            log.methodExit(this.logger, 'discoverEvent', { count: allEvents.length });
            return allEvents;
        }
        catch (error) {
            log.methodError(this.logger, 'discoverEvent', error, {
                positionId,
                eventType: input.eventType,
            });
            throw error;
        }
    }
    async fetchPositionData(positionId) {
        log.dbOperation(this.logger, 'findUnique', 'Position', { id: positionId });
        const position = await this.prisma.position.findUnique({
            where: { id: positionId },
            include: { pool: true },
        });
        if (!position) {
            throw new Error(`Position not found: ${positionId}`);
        }
        if (position.protocol !== 'uniswapv3') {
            throw new Error(`Invalid position protocol '${position.protocol}'. Expected 'uniswapv3'.`);
        }
        const config = position.config;
        return {
            position: position,
            nftId: BigInt(config.nftId),
            chainId: config.chainId,
            poolId: position.poolId,
        };
    }
    async fetchPoolMetadata(poolId) {
        log.dbOperation(this.logger, 'findUnique', 'Pool', { id: poolId });
        const pool = await this.prisma.pool.findUnique({
            where: { id: poolId },
            include: {
                token0: true,
                token1: true,
            },
        });
        if (!pool) {
            throw new Error(`Pool not found: ${poolId}`);
        }
        if (!pool.token0 || !pool.token1) {
            throw new Error(`Pool tokens not found for pool: ${poolId}`);
        }
        const token0IsQuote = false;
        return {
            pool: pool,
            token0: pool.token0,
            token1: pool.token1,
            token0IsQuote,
            token0Decimals: pool.token0.decimals,
            token1Decimals: pool.token1.decimals,
        };
    }
    async addEventsFromUserData(positionId, events) {
        log.methodEntry(this.logger, 'addEventsFromUserData', {
            positionId,
            eventCount: events.length,
        });
        try {
            const positionData = await this.fetchPositionData(positionId);
            const { chainId, nftId, poolId } = positionData;
            this.logger.debug({ positionId, poolId, chainId, nftId }, 'Position data fetched');
            const poolMetadata = await this.fetchPoolMetadata(poolId);
            this.logger.debug({
                positionId,
                poolId,
                token0: poolMetadata.token0.symbol,
                token1: poolMetadata.token1.symbol,
                token0IsQuote: poolMetadata.token0IsQuote,
            }, 'Pool metadata fetched');
            const existingEvents = await this.findAllItems(positionId);
            this.logger.debug({ positionId, existingEventCount: existingEvents.length }, 'Existing events fetched');
            const sortedExisting = [...existingEvents].sort((a, b) => {
                const aBlock = a.config.blockNumber;
                const bBlock = b.config.blockNumber;
                if (aBlock !== bBlock)
                    return Number(aBlock - bBlock);
                const aTx = a.config.txIndex;
                const bTx = b.config.txIndex;
                if (aTx !== bTx)
                    return aTx - bTx;
                return a.config.logIndex - b.config.logIndex;
            });
            let previousEventId = null;
            let lastBlockNumber = 0n;
            let lastTxIndex = 0;
            let lastLogIndex = 0;
            let liquidity = 0n;
            let costBasis = 0n;
            let pnl = 0n;
            let uncollectedPrincipal0 = 0n;
            let uncollectedPrincipal1 = 0n;
            if (sortedExisting.length > 0) {
                const lastEvent = sortedExisting[sortedExisting.length - 1];
                if (!lastEvent) {
                    throw new Error('Expected last event but got undefined');
                }
                previousEventId = lastEvent.id;
                lastBlockNumber = lastEvent.config.blockNumber;
                lastTxIndex = lastEvent.config.txIndex;
                lastLogIndex = lastEvent.config.logIndex;
                liquidity = lastEvent.config.liquidityAfter;
                costBasis = lastEvent.costBasisAfter;
                pnl = lastEvent.pnlAfter;
                uncollectedPrincipal0 = lastEvent.config.uncollectedPrincipal0After;
                uncollectedPrincipal1 = lastEvent.config.uncollectedPrincipal1After;
                this.logger.debug({
                    positionId,
                    lastEventId: previousEventId,
                    lastBlock: lastBlockNumber.toString(),
                    lastTxIndex,
                    lastLogIndex,
                    liquidity: liquidity.toString(),
                    costBasis: costBasis.toString(),
                }, 'Latest event state extracted');
            }
            else {
                this.logger.debug({ positionId }, 'No existing events, starting fresh');
            }
            const sortedEvents = [...events].sort((a, b) => {
                if (a.blockNumber !== b.blockNumber)
                    return Number(a.blockNumber - b.blockNumber);
                if (a.transactionIndex !== b.transactionIndex)
                    return a.transactionIndex - b.transactionIndex;
                return a.logIndex - b.logIndex;
            });
            if (sortedEvents.length === 0) {
                this.logger.debug({ positionId }, 'No events to add');
                return;
            }
            const firstEvent = sortedEvents[0];
            const lastNewEvent = sortedEvents[sortedEvents.length - 1];
            if (!firstEvent || !lastNewEvent) {
                throw new Error('Expected events but got undefined');
            }
            this.logger.debug({
                positionId,
                newEventCount: sortedEvents.length,
                firstBlock: firstEvent.blockNumber.toString(),
                lastBlock: lastNewEvent.blockNumber.toString(),
            }, 'New events sorted by blockchain order');
            for (const event of sortedEvents) {
                if (event.blockNumber < lastBlockNumber) {
                    const error = new Error(`Event at block ${event.blockNumber} comes before last existing event at block ${lastBlockNumber}`);
                    log.methodError(this.logger, 'addEventsFromUserData', error, {
                        positionId,
                        eventBlock: event.blockNumber.toString(),
                        lastBlock: lastBlockNumber.toString(),
                    });
                    throw error;
                }
                if (event.blockNumber === lastBlockNumber) {
                    if (event.transactionIndex < lastTxIndex) {
                        const error = new Error(`Event at tx index ${event.transactionIndex} comes before last existing event at tx index ${lastTxIndex} (same block ${lastBlockNumber})`);
                        log.methodError(this.logger, 'addEventsFromUserData', error, {
                            positionId,
                            eventTxIndex: event.transactionIndex,
                            lastTxIndex,
                        });
                        throw error;
                    }
                    if (event.transactionIndex === lastTxIndex) {
                        if (event.logIndex <= lastLogIndex) {
                            const error = new Error(`Event at log index ${event.logIndex} comes before or equals last existing event at log index ${lastLogIndex} (same block ${lastBlockNumber}, same tx ${lastTxIndex})`);
                            log.methodError(this.logger, 'addEventsFromUserData', error, {
                                positionId,
                                eventLogIndex: event.logIndex,
                                lastLogIndex,
                            });
                            throw error;
                        }
                    }
                }
            }
            this.logger.info({ positionId, eventCount: sortedEvents.length }, 'Event ordering validated - all events come after existing events');
            for (let i = 0; i < sortedEvents.length; i++) {
                const event = sortedEvents[i];
                if (!event) {
                    throw new Error(`Expected event at index ${i} but got undefined`);
                }
                this.logger.debug({
                    positionId,
                    eventIndex: i + 1,
                    totalEvents: sortedEvents.length,
                    eventType: event.eventType,
                    blockNumber: event.blockNumber.toString(),
                }, 'Processing event');
                const historicPrice = await this.getHistoricPoolPrice(poolId, event.blockNumber);
                const rawEvent = {
                    eventType: event.eventType,
                    tokenId: event.tokenId.toString(),
                    transactionHash: event.transactionHash,
                    blockNumber: event.blockNumber,
                    transactionIndex: event.transactionIndex,
                    logIndex: event.logIndex,
                    blockTimestamp: event.timestamp,
                    chainId,
                    liquidity: event.liquidity?.toString(),
                    amount0: event.amount0.toString(),
                    amount1: event.amount1.toString(),
                    recipient: event.recipient,
                };
                const eventInput = await this.buildEventFromRawData({
                    rawEvent,
                    previousState: {
                        uncollectedPrincipal0,
                        uncollectedPrincipal1,
                        liquidity,
                        costBasis,
                        pnl,
                    },
                    poolMetadata,
                    sqrtPriceX96: historicPrice.sqrtPriceX96,
                    previousEventId,
                    positionId,
                });
                this.logger.debug({
                    positionId,
                    eventIndex: i + 1,
                    eventType: eventInput.eventType,
                    deltaCostBasis: eventInput.deltaCostBasis.toString(),
                    deltaPnl: eventInput.deltaPnl.toString(),
                }, 'Event built with financial calculations');
                await this.addItem(positionId, eventInput);
                const allEvents = await this.findAllItems(positionId);
                const justAdded = allEvents[0];
                if (!justAdded) {
                    throw new Error('Expected to find just-added event but got undefined');
                }
                previousEventId = justAdded.id;
                liquidity = eventInput.config.liquidityAfter;
                costBasis = eventInput.costBasisAfter;
                pnl = eventInput.pnlAfter;
                uncollectedPrincipal0 = eventInput.config.uncollectedPrincipal0After;
                uncollectedPrincipal1 = eventInput.config.uncollectedPrincipal1After;
                lastBlockNumber = event.blockNumber;
                lastTxIndex = event.transactionIndex;
                lastLogIndex = event.logIndex;
                this.logger.info({
                    positionId,
                    eventIndex: i + 1,
                    totalEvents: sortedEvents.length,
                    liquidityAfter: liquidity.toString(),
                    costBasisAfter: costBasis.toString(),
                    pnlAfter: pnl.toString(),
                }, 'Event added successfully');
            }
            log.methodExit(this.logger, 'addEventsFromUserData', {
                positionId,
                eventsAdded: sortedEvents.length,
            });
        }
        catch (error) {
            log.methodError(this.logger, 'addEventsFromUserData', error, {
                positionId,
                eventCount: events.length,
            });
            throw error;
        }
    }
    async getHistoricPoolPrice(poolId, blockNumber) {
        this.logger.debug({ poolId, blockNumber: blockNumber.toString() }, 'Discovering historic pool price');
        const poolPrice = await this.poolPriceService.discover(poolId, {
            blockNumber: Number(blockNumber),
        });
        const sqrtPriceX96 = poolPrice.state.sqrtPriceX96;
        this.logger.debug({
            poolId,
            blockNumber: blockNumber.toString(),
            sqrtPriceX96: sqrtPriceX96.toString(),
            timestamp: poolPrice.timestamp,
        }, 'Historic pool price discovered');
        return {
            poolPrice,
            sqrtPriceX96,
            timestamp: poolPrice.timestamp,
        };
    }
    async buildEventFromRawData(params) {
        const { rawEvent, previousState, poolMetadata, sqrtPriceX96, previousEventId, positionId } = params;
        const { token0, token1, token0IsQuote, token0Decimals, token1Decimals } = poolMetadata;
        const poolPrice = calculatePoolPriceInQuoteToken(sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
        const amount0 = BigInt(rawEvent.amount0 ?? '0');
        const amount1 = BigInt(rawEvent.amount1 ?? '0');
        const tokenId = BigInt(rawEvent.tokenId);
        let deltaL = 0n;
        let liquidityAfter = previousState.liquidity;
        let deltaCostBasis = 0n;
        let costBasisAfter = previousState.costBasis;
        let deltaPnl = 0n;
        let pnlAfter = previousState.pnl;
        let feesCollected0 = 0n;
        let feesCollected1 = 0n;
        let uncollectedPrincipal0After = previousState.uncollectedPrincipal0;
        let uncollectedPrincipal1After = previousState.uncollectedPrincipal1;
        let rewards = [];
        let state;
        if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
            deltaL = BigInt(rawEvent.liquidity ?? '0');
            liquidityAfter = previousState.liquidity + deltaL;
            const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
            deltaCostBasis = tokenValue;
            costBasisAfter = previousState.costBasis + tokenValue;
            deltaPnl = 0n;
            pnlAfter = previousState.pnl;
            state = {
                eventType: 'INCREASE_LIQUIDITY',
                tokenId,
                liquidity: deltaL,
                amount0,
                amount1,
            };
        }
        else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
            deltaL = BigInt(rawEvent.liquidity ?? '0');
            liquidityAfter = previousState.liquidity - deltaL;
            const proportionalCostBasis = calculateProportionalCostBasis(previousState.costBasis, deltaL, previousState.liquidity);
            deltaCostBasis = -proportionalCostBasis;
            costBasisAfter = previousState.costBasis - proportionalCostBasis;
            const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
            deltaPnl = tokenValue - proportionalCostBasis;
            pnlAfter = previousState.pnl + deltaPnl;
            uncollectedPrincipal0After = previousState.uncollectedPrincipal0 + amount0;
            uncollectedPrincipal1After = previousState.uncollectedPrincipal1 + amount1;
            state = {
                eventType: 'DECREASE_LIQUIDITY',
                tokenId,
                liquidity: deltaL,
                amount0,
                amount1,
            };
        }
        else {
            const { feeAmount0, feeAmount1, principalAmount0, principalAmount1 } = separateFeesFromPrincipal(amount0, amount1, previousState.uncollectedPrincipal0, previousState.uncollectedPrincipal1);
            feesCollected0 = feeAmount0;
            feesCollected1 = feeAmount1;
            uncollectedPrincipal0After = previousState.uncollectedPrincipal0 - principalAmount0;
            uncollectedPrincipal1After = previousState.uncollectedPrincipal1 - principalAmount1;
            const fee0Value = calculateTokenValueInQuote(feeAmount0, 0n, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
            const fee1Value = calculateTokenValueInQuote(0n, feeAmount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
            if (feeAmount0 > 0n) {
                rewards.push({
                    tokenId: token0.id,
                    tokenAmount: feeAmount0,
                    tokenValue: fee0Value,
                });
            }
            if (feeAmount1 > 0n) {
                rewards.push({
                    tokenId: token1.id,
                    tokenAmount: feeAmount1,
                    tokenValue: fee1Value,
                });
            }
            deltaCostBasis = 0n;
            costBasisAfter = previousState.costBasis;
            deltaPnl = 0n;
            pnlAfter = previousState.pnl;
            state = {
                eventType: 'COLLECT',
                tokenId,
                recipient: rawEvent.recipient ?? '0x0000000000000000000000000000000000000000',
                amount0,
                amount1,
            };
        }
        const tokenValue = calculateTokenValueInQuote(amount0, amount1, sqrtPriceX96, token0IsQuote, token0Decimals, token1Decimals);
        let ledgerEventType;
        if (rawEvent.eventType === 'INCREASE_LIQUIDITY') {
            ledgerEventType = 'INCREASE_POSITION';
        }
        else if (rawEvent.eventType === 'DECREASE_LIQUIDITY') {
            ledgerEventType = 'DECREASE_POSITION';
        }
        else {
            ledgerEventType = 'COLLECT';
        }
        const eventInput = {
            positionId,
            protocol: 'uniswapv3',
            previousId: previousEventId,
            timestamp: rawEvent.blockTimestamp,
            eventType: ledgerEventType,
            poolPrice,
            token0Amount: amount0,
            token1Amount: amount1,
            tokenValue,
            rewards,
            deltaCostBasis,
            costBasisAfter,
            deltaPnl,
            pnlAfter,
            config: {
                chainId: rawEvent.chainId,
                nftId: BigInt(rawEvent.tokenId),
                blockNumber: rawEvent.blockNumber,
                txIndex: rawEvent.transactionIndex,
                logIndex: rawEvent.logIndex,
                txHash: rawEvent.transactionHash,
                deltaL,
                liquidityAfter,
                feesCollected0,
                feesCollected1,
                uncollectedPrincipal0After,
                uncollectedPrincipal1After,
                sqrtPriceX96,
            },
            state,
        };
        const inputHash = this.generateInputHash(eventInput);
        return {
            ...eventInput,
            inputHash,
        };
    }
    convertDiscoverInputToRawEvent(input, chainId) {
        return {
            eventType: input.eventType,
            tokenId: input.tokenId.toString(),
            transactionHash: input.transactionHash,
            blockNumber: input.blockNumber,
            transactionIndex: input.transactionIndex,
            logIndex: input.logIndex,
            blockTimestamp: input.timestamp,
            chainId,
            liquidity: input.liquidity?.toString(),
            amount0: input.amount0.toString(),
            amount1: input.amount1.toString(),
            recipient: input.recipient,
        };
    }
    async findAllItems(positionId) {
        log.methodEntry(this.logger, 'findAllItems (Uniswap V3 override)', { positionId });
        try {
            log.dbOperation(this.logger, 'findMany', 'PositionLedgerEvent', {
                positionId,
            });
            const results = await this.prisma.positionLedgerEvent.findMany({
                where: {
                    positionId,
                    protocol: 'uniswapv3',
                },
            });
            const events = results.map((r) => this.mapToLedgerEvent(r));
            events.sort((a, b) => {
                const configA = a.config;
                const configB = b.config;
                if (configA.blockNumber > configB.blockNumber)
                    return -1;
                if (configA.blockNumber < configB.blockNumber)
                    return 1;
                if (configA.txIndex > configB.txIndex)
                    return -1;
                if (configA.txIndex < configB.txIndex)
                    return 1;
                if (configA.logIndex > configB.logIndex)
                    return -1;
                if (configA.logIndex < configB.logIndex)
                    return 1;
                return 0;
            });
            this.logger.debug({
                positionId,
                count: events.length,
            }, 'Events retrieved and sorted by blockchain coordinates');
            log.methodExit(this.logger, 'findAllItems', {
                positionId,
                count: events.length,
            });
            return events;
        }
        catch (error) {
            log.methodError(this.logger, 'findAllItems', error, {
                positionId,
            });
            throw error;
        }
    }
    sortEventsChronologically(events) {
        return [...events].sort((a, b) => {
            if (a.blockNumber < b.blockNumber)
                return -1;
            if (a.blockNumber > b.blockNumber)
                return 1;
            if (a.transactionIndex < b.transactionIndex)
                return -1;
            if (a.transactionIndex > b.transactionIndex)
                return 1;
            if (a.logIndex < b.logIndex)
                return -1;
            if (a.logIndex > b.logIndex)
                return 1;
            return 0;
        });
    }
}
//# sourceMappingURL=uniswapv3-position-ledger-service.js.map