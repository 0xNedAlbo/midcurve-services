import { computeFeeGrowthInside, calculateIncrementalFees, tickToPrice, calculatePositionValue, } from "@midcurve/shared";
import { calculateTokenValueInQuote } from "../../../../utils/uniswapv3/ledger-calculations.js";
import { uniswapV3PoolAbi } from "../../../../utils/uniswapv3/pool-abi.js";
export async function getLedgerSummary(positionId, ledgerService, logger) {
    try {
        const events = await ledgerService.findAllItems(positionId);
        if (events.length === 0) {
            return {
                costBasis: 0n,
                realizedPnl: 0n,
                collectedFees: 0n,
                lastFeesCollectedAt: new Date(0),
            };
        }
        const latestEvent = events[0];
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
        logger.warn({ error, positionId }, "Failed to get ledger summary, using defaults");
        return {
            costBasis: 0n,
            realizedPnl: 0n,
            collectedFees: 0n,
            lastFeesCollectedAt: new Date(0),
        };
    }
}
export async function getUncollectedPrincipalFromLedger(positionId, ledgerService, logger) {
    try {
        const events = await ledgerService.findAllItems(positionId);
        if (events.length === 0) {
            return {
                uncollectedPrincipal0: 0n,
                uncollectedPrincipal1: 0n,
            };
        }
        const latestEvent = events[0];
        const config = latestEvent.config;
        return {
            uncollectedPrincipal0: config.uncollectedPrincipal0After,
            uncollectedPrincipal1: config.uncollectedPrincipal1After,
        };
    }
    catch (error) {
        logger.warn({ error, positionId }, "Failed to get uncollected principal from ledger, using 0");
        return {
            uncollectedPrincipal0: 0n,
            uncollectedPrincipal1: 0n,
        };
    }
}
export async function calculateUnclaimedFees(position, pool, evmConfig, ledgerService, logger) {
    try {
        const { chainId, poolAddress, tickLower, tickUpper } = position.config;
        const { liquidity, feeGrowthInside0LastX128, feeGrowthInside1LastX128, } = position.state;
        if (liquidity === 0n) {
            return {
                unclaimedFeesValue: 0n,
                unclaimedFees0: 0n,
                unclaimedFees1: 0n,
            };
        }
        const client = evmConfig.getPublicClient(chainId);
        const [feeGrowthGlobal0X128, feeGrowthGlobal1X128, tickDataLower, tickDataUpper,] = await Promise.all([
            client.readContract({
                address: poolAddress,
                abi: uniswapV3PoolAbi,
                functionName: "feeGrowthGlobal0X128",
            }),
            client.readContract({
                address: poolAddress,
                abi: uniswapV3PoolAbi,
                functionName: "feeGrowthGlobal1X128",
            }),
            client.readContract({
                address: poolAddress,
                abi: uniswapV3PoolAbi,
                functionName: "ticks",
                args: [tickLower],
            }),
            client.readContract({
                address: poolAddress,
                abi: uniswapV3PoolAbi,
                functionName: "ticks",
                args: [tickUpper],
            }),
        ]);
        const feeGrowthOutsideLower0X128 = tickDataLower[2];
        const feeGrowthOutsideLower1X128 = tickDataLower[3];
        const feeGrowthOutsideUpper0X128 = tickDataUpper[2];
        const feeGrowthOutsideUpper1X128 = tickDataUpper[3];
        const feeGrowthInside = computeFeeGrowthInside(pool.state.currentTick, tickLower, tickUpper, feeGrowthGlobal0X128, feeGrowthGlobal1X128, feeGrowthOutsideLower0X128, feeGrowthOutsideLower1X128, feeGrowthOutsideUpper0X128, feeGrowthOutsideUpper1X128);
        const incremental0 = calculateIncrementalFees(feeGrowthInside.inside0, feeGrowthInside0LastX128, liquidity);
        const incremental1 = calculateIncrementalFees(feeGrowthInside.inside1, feeGrowthInside1LastX128, liquidity);
        const tokensOwed0 = position.state.tokensOwed0;
        const tokensOwed1 = position.state.tokensOwed1;
        const uncollectedPrincipal = await getUncollectedPrincipalFromLedger(position.id, ledgerService, logger);
        const pureCheckpointedFees0 = tokensOwed0 > uncollectedPrincipal.uncollectedPrincipal0
            ? tokensOwed0 - uncollectedPrincipal.uncollectedPrincipal0
            : 0n;
        const pureCheckpointedFees1 = tokensOwed1 > uncollectedPrincipal.uncollectedPrincipal1
            ? tokensOwed1 - uncollectedPrincipal.uncollectedPrincipal1
            : 0n;
        const totalClaimable0 = pureCheckpointedFees0 + incremental0;
        const totalClaimable1 = pureCheckpointedFees1 + incremental1;
        const unclaimedFeesValue = calculateTokenValueInQuote(totalClaimable0, totalClaimable1, pool.state.sqrtPriceX96, position.isToken0Quote, pool.token0.decimals, pool.token1.decimals);
        logger.debug({
            positionId: position.id,
            incremental0: incremental0.toString(),
            incremental1: incremental1.toString(),
            tokensOwed0: tokensOwed0.toString(),
            tokensOwed1: tokensOwed1.toString(),
            uncollectedPrincipal0: uncollectedPrincipal.uncollectedPrincipal0.toString(),
            uncollectedPrincipal1: uncollectedPrincipal.uncollectedPrincipal1.toString(),
            pureCheckpointedFees0: pureCheckpointedFees0.toString(),
            pureCheckpointedFees1: pureCheckpointedFees1.toString(),
            totalClaimable0: totalClaimable0.toString(),
            totalClaimable1: totalClaimable1.toString(),
            unclaimedFeesValue: unclaimedFeesValue.toString(),
        }, "Unclaimed fees calculation breakdown");
        return {
            unclaimedFeesValue,
            unclaimedFees0: totalClaimable0,
            unclaimedFees1: totalClaimable1,
        };
    }
    catch (error) {
        logger.warn({ error, positionId: position.id }, "Failed to calculate unclaimed fees, using 0");
        return {
            unclaimedFeesValue: 0n,
            unclaimedFees0: 0n,
            unclaimedFees1: 0n,
        };
    }
}
export function calculateCurrentPositionValue(position, pool) {
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
export function calculatePriceRange(position, pool) {
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
export async function getCurrentLiquidityFromLedger(positionId, prisma, logger) {
    const lastEvent = await prisma.positionLedgerEvent.findFirst({
        where: { positionId },
        orderBy: { timestamp: "desc" },
        select: { config: true },
    });
    if (!lastEvent) {
        logger.debug({ positionId }, "No ledger events found, returning liquidity = 0");
        return 0n;
    }
    const config = lastEvent.config;
    const liquidityAfter = config.liquidityAfter
        ? BigInt(config.liquidityAfter)
        : 0n;
    logger.debug({ positionId, liquidityAfter: liquidityAfter.toString() }, "Retrieved liquidity from last ledger event");
    return liquidityAfter;
}
//# sourceMappingURL=position-calculations.js.map