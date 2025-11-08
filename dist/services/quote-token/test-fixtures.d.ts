import type { UniswapV3QuoteTokenInput } from '../types/quote-token/quote-token-input.js';
import type { UniswapV3QuoteTokenResult } from '@midcurve/shared';
export declare const TEST_USER_IDS: {
    readonly ALICE: "user_alice_001";
    readonly BOB: "user_bob_002";
    readonly CHARLIE: "user_charlie_003";
};
export declare const TOKENS: {
    readonly ETHEREUM: {
        readonly USDC: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        readonly USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        readonly DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F";
        readonly WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        readonly UNI: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984";
        readonly LINK: "0x514910771AF9Ca656af840dff83E8264EcF986CA";
    };
    readonly ARBITRUM: {
        readonly USDC: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        readonly USDC_E: "0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8";
        readonly USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9";
        readonly WETH: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
        readonly ARB: "0x912CE59144191C1204E64559FE8253a0e49E6548";
    };
    readonly BASE: {
        readonly USDC: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
        readonly WETH: "0x4200000000000000000000000000000000000006";
        readonly DEGEN: "0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed";
    };
};
export declare const SCENARIO_WETH_USDC_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_USDC_LINK_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_LINK_WETH_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_UNI_LINK_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_WETH_ARB_ARBITRUM: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_USDC_USDT_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_USDT_DAI_ETH: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_USER_PREFERS_WETH: {
    input: UniswapV3QuoteTokenInput;
    userPreferences: string[];
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare const SCENARIO_CASE_INSENSITIVE: {
    input: UniswapV3QuoteTokenInput;
    expected: Omit<UniswapV3QuoteTokenResult, 'quoteTokenSymbol' | 'baseTokenSymbol'>;
};
export declare function createQuoteTokenInput(overrides: Partial<UniswapV3QuoteTokenInput>): UniswapV3QuoteTokenInput;
//# sourceMappingURL=test-fixtures.d.ts.map