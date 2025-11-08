import { EvmConfig } from '../../config/evm.js';
import { CacheService } from '../cache/index.js';
export interface TokenBalance {
    walletAddress: string;
    tokenAddress: string;
    chainId: number;
    balance: bigint;
    timestamp: Date;
}
export interface UserTokenBalanceServiceDependencies {
    evmConfig?: EvmConfig;
    cacheService?: CacheService;
}
export declare class UserTokenBalanceService {
    private readonly evmConfig;
    private readonly cacheService;
    private readonly logger;
    private static readonly CACHE_TTL_SECONDS;
    constructor(dependencies?: UserTokenBalanceServiceDependencies);
    getBalance(walletAddress: string, tokenAddress: string, chainId: number): Promise<TokenBalance>;
    private fetchBalanceFromRPC;
    private getCacheKey;
    invalidateCache(walletAddress: string, tokenAddress: string, chainId: number): Promise<void>;
}
//# sourceMappingURL=user-token-balance-service.d.ts.map