import type { PoolConfigMap } from '@midcurve/shared';
export interface QuoteTokenInputMap {
    uniswapv3: UniswapV3QuoteTokenInput;
}
export interface UniswapV3QuoteTokenInput {
    userId: string;
    chainId: number;
    token0Address: string;
    token1Address: string;
}
export type QuoteTokenInput<P extends keyof PoolConfigMap> = QuoteTokenInputMap[P];
//# sourceMappingURL=quote-token-input.d.ts.map