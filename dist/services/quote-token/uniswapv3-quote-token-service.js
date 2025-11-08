import { QuoteTokenService } from './quote-token-service.js';
import { normalizeAddress } from '@midcurve/shared';
import { getDefaultQuoteTokens } from '../../config/quote-tokens.js';
import { log } from '../../logging/index.js';
export class UniswapV3QuoteTokenService extends QuoteTokenService {
    async determineQuoteToken(input) {
        const { userId, chainId, token0Address, token1Address } = input;
        log.methodEntry(this.logger, 'determineQuoteToken', {
            userId,
            chainId,
            token0Address,
            token1Address,
        });
        try {
            const token0 = this.normalizeTokenId(token0Address);
            const token1 = this.normalizeTokenId(token1Address);
            const userPrefs = await this.getUserPreferences(userId);
            if (userPrefs && userPrefs.length > 0) {
                const result = this.matchTokensAgainstPreferences(token0, token1, userPrefs);
                if (result) {
                    log.methodExit(this.logger, 'determineQuoteToken', {
                        matchedBy: 'user_preference',
                    });
                    return {
                        ...result,
                        matchedBy: 'user_preference',
                        protocol: 'uniswapv3',
                    };
                }
            }
            const defaults = this.getDefaultQuoteTokensForChain(chainId);
            const result = this.matchTokensAgainstPreferences(token0, token1, defaults);
            if (result) {
                log.methodExit(this.logger, 'determineQuoteToken', {
                    matchedBy: 'default',
                });
                return { ...result, matchedBy: 'default', protocol: 'uniswapv3' };
            }
            this.logger.debug({ token0, token1 }, 'No matches found, using token0 as quote (fallback)');
            log.methodExit(this.logger, 'determineQuoteToken', {
                matchedBy: 'fallback',
            });
            return {
                isToken0Quote: true,
                quoteTokenId: token0,
                baseTokenId: token1,
                matchedBy: 'fallback',
                protocol: 'uniswapv3',
            };
        }
        catch (error) {
            log.methodError(this.logger, 'determineQuoteToken', error, {
                userId,
                chainId,
                token0Address,
                token1Address,
            });
            throw error;
        }
    }
    getDefaultQuoteTokens() {
        return [];
    }
    getDefaultQuoteTokensForChain(chainId) {
        const defaults = getDefaultQuoteTokens(chainId);
        if (!defaults || defaults.length === 0) {
            this.logger.warn({ chainId }, 'No default quote tokens for chain, using empty list');
            return [];
        }
        return defaults;
    }
    normalizeTokenId(tokenId) {
        return normalizeAddress(tokenId);
    }
    compareTokenIds(tokenIdA, tokenIdB) {
        try {
            const normalizedA = this.normalizeTokenId(tokenIdA);
            const normalizedB = this.normalizeTokenId(tokenIdB);
            return normalizedA === normalizedB;
        }
        catch {
            return false;
        }
    }
    getProtocol() {
        return 'uniswapv3';
    }
    matchTokensAgainstPreferences(token0, token1, preferences) {
        const token0Matches = preferences.some((pref) => this.compareTokenIds(pref, token0));
        const token1Matches = preferences.some((pref) => this.compareTokenIds(pref, token1));
        if (token0Matches && !token1Matches) {
            return {
                isToken0Quote: true,
                quoteTokenId: token0,
                baseTokenId: token1,
            };
        }
        if (token1Matches && !token0Matches) {
            return {
                isToken0Quote: false,
                quoteTokenId: token1,
                baseTokenId: token0,
            };
        }
        if (token0Matches && token1Matches) {
            const token0Index = preferences.findIndex((pref) => this.compareTokenIds(pref, token0));
            const token1Index = preferences.findIndex((pref) => this.compareTokenIds(pref, token1));
            return token0Index < token1Index
                ? { isToken0Quote: true, quoteTokenId: token0, baseTokenId: token1 }
                : { isToken0Quote: false, quoteTokenId: token1, baseTokenId: token0 };
        }
        return null;
    }
}
//# sourceMappingURL=uniswapv3-quote-token-service.js.map