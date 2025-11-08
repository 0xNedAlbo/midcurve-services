import type { CreateTokenInput } from '../types/token/token-input.js';
interface TokenFixture {
    input: CreateTokenInput<'erc20'>;
    dbResult: {
        id: string;
        createdAt: Date;
        updatedAt: Date;
        tokenType: string;
        name: string;
        symbol: string;
        decimals: number;
        logoUrl: string | null;
        coingeckoId: string | null;
        marketCap: number | null;
        config: unknown;
    };
}
export declare const USDC_ETHEREUM: TokenFixture;
export declare const WETH_ETHEREUM: TokenFixture;
export declare const DAI_ETHEREUM: TokenFixture;
export declare const USDC_ARBITRUM: TokenFixture;
export declare const USDC_BASE: TokenFixture;
export declare const MINIMAL_ERC20: TokenFixture;
export declare const SPECIAL_CHARS_TOKEN: TokenFixture;
export declare const ZERO_MARKET_CAP_TOKEN: TokenFixture;
export declare const HIGH_DECIMALS_TOKEN: TokenFixture;
export declare const ZERO_DECIMALS_TOKEN: TokenFixture;
export declare const DISCOVERED_TOKEN: TokenFixture;
export declare const NON_COMPLIANT_TOKEN: {
    address: string;
    chainId: number;
};
export declare const ERC20_FIXTURES: {
    readonly USDC_ETHEREUM: TokenFixture;
    readonly WETH_ETHEREUM: TokenFixture;
    readonly DAI_ETHEREUM: TokenFixture;
    readonly USDC_ARBITRUM: TokenFixture;
    readonly USDC_BASE: TokenFixture;
};
export declare const EDGE_CASE_FIXTURES: {
    readonly MINIMAL_ERC20: TokenFixture;
    readonly SPECIAL_CHARS_TOKEN: TokenFixture;
    readonly ZERO_MARKET_CAP_TOKEN: TokenFixture;
    readonly HIGH_DECIMALS_TOKEN: TokenFixture;
    readonly ZERO_DECIMALS_TOKEN: TokenFixture;
};
export declare const DISCOVERY_FIXTURES: {
    readonly DISCOVERED_TOKEN: TokenFixture;
    readonly NON_COMPLIANT_TOKEN: {
        address: string;
        chainId: number;
    };
};
export declare const ALL_FIXTURES: {
    readonly DISCOVERED_TOKEN: TokenFixture;
    readonly NON_COMPLIANT_TOKEN: {
        address: string;
        chainId: number;
    };
    readonly MINIMAL_ERC20: TokenFixture;
    readonly SPECIAL_CHARS_TOKEN: TokenFixture;
    readonly ZERO_MARKET_CAP_TOKEN: TokenFixture;
    readonly HIGH_DECIMALS_TOKEN: TokenFixture;
    readonly ZERO_DECIMALS_TOKEN: TokenFixture;
    readonly USDC_ETHEREUM: TokenFixture;
    readonly WETH_ETHEREUM: TokenFixture;
    readonly DAI_ETHEREUM: TokenFixture;
    readonly USDC_ARBITRUM: TokenFixture;
    readonly USDC_BASE: TokenFixture;
};
export declare function createTokenFixture(overrides: Partial<CreateTokenInput<'erc20'>>): TokenFixture;
export {};
//# sourceMappingURL=test-fixtures.d.ts.map