import { QuoteTokenService } from './quote-token-service.js';
import type { QuoteTokenResult } from '@midcurve/shared';
import type { UniswapV3QuoteTokenInput } from '../types/quote-token/quote-token-input.js';
export declare class UniswapV3QuoteTokenService extends QuoteTokenService<'uniswapv3'> {
    determineQuoteToken(input: UniswapV3QuoteTokenInput): Promise<QuoteTokenResult<'uniswapv3'>>;
    getDefaultQuoteTokens(): string[];
    private getDefaultQuoteTokensForChain;
    normalizeTokenId(tokenId: string): string;
    compareTokenIds(tokenIdA: string, tokenIdB: string): boolean;
    protected getProtocol(): 'uniswapv3';
    private matchTokensAgainstPreferences;
}
//# sourceMappingURL=uniswapv3-quote-token-service.d.ts.map