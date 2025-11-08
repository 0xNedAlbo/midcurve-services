import { CacheService } from '../../services/cache/index.js';
import { RequestScheduler } from '../../utils/request-scheduler/index.js';
import type { EtherscanLog, FetchLogsOptions, FetchPositionEventsOptions, RawPositionEvent } from './types.js';
export declare const EVENT_SIGNATURES: {
    readonly INCREASE_LIQUIDITY: "0x3067048beee31b25b2f1681f88dac838c8bba36af25bfb2b7cf7473a5847e35f";
    readonly DECREASE_LIQUIDITY: "0x26f6a048ee9138f2c0ce266f322cb99228e8d619ae2bff30c67f8dcf9d2377b4";
    readonly COLLECT: "0x40d0efd1a53d60ecbf40971b9daf7dc90178c3aadc7aab1765632738fa8b8f01";
};
export declare const NFT_POSITION_MANAGER_ADDRESSES: Record<number, string>;
export declare const SUPPORTED_CHAIN_IDS: readonly [1, 42161, 8453, 10, 137];
export declare class EtherscanApiError extends Error {
    readonly statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
export declare class EtherscanApiKeyMissingError extends Error {
    constructor();
}
export interface EtherscanClientDependencies {
    cacheService?: CacheService;
    requestScheduler?: RequestScheduler;
    apiKey?: string;
}
export declare class EtherscanClient {
    private static instance;
    private readonly cacheService;
    private readonly requestScheduler;
    private readonly apiKey;
    private readonly logger;
    private readonly contractCreationCacheTtl;
    constructor(dependencies?: EtherscanClientDependencies);
    static getInstance(): EtherscanClient;
    static resetInstance(): void;
    private isEtherscanRateLimited;
    private scheduledFetch;
    fetchLogs(chainId: number, contractAddress: string, options?: FetchLogsOptions): Promise<EtherscanLog[]>;
    getContractCreationBlock(chainId: number, contractAddress: string): Promise<string>;
    getBlockNumberForTimestamp(chainId: number, timestamp: number, closest?: 'before' | 'after'): Promise<string>;
    fetchPositionEvents(chainId: number, nftId: string | number, options?: FetchPositionEventsOptions): Promise<RawPositionEvent[]>;
    private parseEventLog;
    private decodeIncreaseLiquidityData;
    private decodeDecreaseLiquidityData;
    private decodeCollectData;
    private deduplicateAndSort;
    private validateChainId;
    getSupportedChainIds(): readonly number[];
    isChainSupported(chainId: number): boolean;
}
//# sourceMappingURL=etherscan-client.d.ts.map