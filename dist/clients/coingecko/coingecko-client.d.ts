import { CacheService } from '../../services/cache/index.js';
import { RequestScheduler } from '../../utils/request-scheduler/index.js';
export interface CoinGeckoToken {
    id: string;
    symbol: string;
    name: string;
    platforms: Record<string, string>;
}
export interface CoinGeckoDetailedCoin {
    id: string;
    symbol: string;
    name: string;
    image: {
        thumb: string;
        small: string;
        large: string;
    };
    market_data: {
        market_cap: {
            usd: number;
        };
    };
    platforms: Record<string, string>;
}
export interface CoinGeckoMarketData {
    id: string;
    symbol: string;
    name: string;
    image: string;
    market_cap: number;
}
export interface EnrichmentData {
    coingeckoId: string;
    logoUrl: string;
    marketCap: number;
    symbol: string;
    name: string;
}
export declare class TokenNotFoundInCoinGeckoError extends Error {
    constructor(chainId: number, address: string);
}
export declare class CoinGeckoApiError extends Error {
    readonly statusCode?: number | undefined;
    constructor(message: string, statusCode?: number | undefined);
}
export interface CoinGeckoClientDependencies {
    cacheService?: CacheService;
    requestScheduler?: RequestScheduler;
}
export declare class CoinGeckoClient {
    private static instance;
    private readonly baseUrl;
    private readonly cacheService;
    private readonly requestScheduler;
    private readonly cacheTimeout;
    private readonly logger;
    private readonly chainIdToPlatformId;
    constructor(dependencies?: CoinGeckoClientDependencies);
    static getInstance(): CoinGeckoClient;
    static resetInstance(): void;
    private scheduledFetch;
    getAllTokens(): Promise<CoinGeckoToken[]>;
    findCoinByAddress(chainId: number, address: string): Promise<string | null>;
    getCoinDetails(coinId: string): Promise<CoinGeckoDetailedCoin>;
    getCoinsMarketData(coinIds: string[]): Promise<CoinGeckoMarketData[]>;
    getErc20EnrichmentData(chainId: number, address: string): Promise<EnrichmentData>;
    clearCache(): Promise<number>;
    hasCachedData(): Promise<boolean>;
    getSupportedChainIds(): number[];
    isChainSupported(chainId: number): boolean;
    searchTokens(params: {
        platform: string;
        symbol?: string;
        name?: string;
        address?: string;
    }): Promise<Array<{
        coingeckoId: string;
        symbol: string;
        name: string;
        address: string;
    }>>;
}
//# sourceMappingURL=coingecko-client.d.ts.map