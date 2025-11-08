import type { PrismaClient } from "@prisma/client";
import type { UniswapV3Position, UniswapV3Pool } from "@midcurve/shared";
import type { Logger } from "pino";
import type { EvmConfig } from "../../../../config/evm.js";
import type { UniswapV3PositionLedgerService } from "../../../position-ledger/uniswapv3-position-ledger-service.js";
export interface LedgerSummary {
    costBasis: bigint;
    realizedPnl: bigint;
    collectedFees: bigint;
    lastFeesCollectedAt: Date;
}
export declare function getLedgerSummary(positionId: string, ledgerService: UniswapV3PositionLedgerService, logger: Logger): Promise<LedgerSummary>;
export interface UncollectedPrincipal {
    uncollectedPrincipal0: bigint;
    uncollectedPrincipal1: bigint;
}
export declare function getUncollectedPrincipalFromLedger(positionId: string, ledgerService: UniswapV3PositionLedgerService, logger: Logger): Promise<UncollectedPrincipal>;
export interface UnclaimedFeesResult {
    unclaimedFeesValue: bigint;
    unclaimedFees0: bigint;
    unclaimedFees1: bigint;
}
export declare function calculateUnclaimedFees(position: UniswapV3Position, pool: UniswapV3Pool, evmConfig: EvmConfig, ledgerService: UniswapV3PositionLedgerService, logger: Logger): Promise<UnclaimedFeesResult>;
export declare function calculateCurrentPositionValue(position: UniswapV3Position, pool: UniswapV3Pool): bigint;
export declare function calculatePriceRange(position: UniswapV3Position, pool: UniswapV3Pool): {
    priceRangeLower: bigint;
    priceRangeUpper: bigint;
};
export declare function getCurrentLiquidityFromLedger(positionId: string, prisma: PrismaClient, logger: Logger): Promise<bigint>;
//# sourceMappingURL=position-calculations.d.ts.map