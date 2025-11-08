import type { UniswapV3PoolDiscoveryInput } from '../types/pool-discovery/pool-discovery-input.js';
export declare const KNOWN_TOKEN_PAIRS: {
    readonly WETH_USDC_ETHEREUM: {
        readonly chainId: 1;
        readonly tokenA: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        readonly tokenB: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        readonly expectedPools: readonly [{
            readonly fee: 500;
            readonly poolAddress: "0x88e6A0c2dDD26FEEb64F039a2c41296FcB3f5640";
            readonly tickSpacing: 10;
            readonly poolName: "CL10-USDC/WETH";
        }, {
            readonly fee: 3000;
            readonly poolAddress: "0x8ad599c3A0ff1De082011EFDDc58f1908eb6e6D8";
            readonly tickSpacing: 60;
            readonly poolName: "CL60-USDC/WETH";
        }, {
            readonly fee: 10000;
            readonly poolAddress: "0x7BeA39867e4169DBe237d55C8242a8f2fcDcc387";
            readonly tickSpacing: 200;
            readonly poolName: "CL200-USDC/WETH";
        }];
    };
    readonly WETH_DAI_ETHEREUM: {
        readonly chainId: 1;
        readonly tokenA: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2";
        readonly tokenB: "0x6B175474E89094C44Da98b954EedeAC495271d0F";
        readonly expectedPools: readonly [{
            readonly fee: 500;
            readonly poolAddress: "0xC2e9F25Be6257c210d7Adf0D4Cd6E3E881ba25f8";
            readonly tickSpacing: 10;
            readonly poolName: "CL10-DAI/WETH";
        }, {
            readonly fee: 3000;
            readonly poolAddress: "0xC36442b4a4522E871399CD717aBDD847Ab11FE88";
            readonly tickSpacing: 60;
            readonly poolName: "CL60-DAI/WETH";
        }];
    };
    readonly USDC_USDT_ETHEREUM: {
        readonly chainId: 1;
        readonly tokenA: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
        readonly tokenB: "0xdAC17F958D2ee523a2206206994597C13D831ec7";
        readonly expectedPools: readonly [{
            readonly fee: 100;
            readonly poolAddress: "0x3416cF6C708Da44DB2624D63ea0AAef7113527C6";
            readonly tickSpacing: 1;
            readonly poolName: "CL1-USDC/USDT";
        }, {
            readonly fee: 500;
            readonly poolAddress: "0x7858E59e0C01EA06Df3aF3D20aC7B0003275D4Bf";
            readonly tickSpacing: 10;
            readonly poolName: "CL10-USDC/USDT";
        }];
    };
    readonly WETH_USDC_ARBITRUM: {
        readonly chainId: 42161;
        readonly tokenA: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
        readonly tokenB: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831";
        readonly expectedPools: readonly [{
            readonly fee: 500;
            readonly poolAddress: "0xC31E54c7a869B9FcBEcc14363CF510d1c41fa443";
            readonly tickSpacing: 10;
            readonly poolName: "CL10-USDC/WETH";
        }];
    };
};
export declare const WETH_USDC_INPUT: UniswapV3PoolDiscoveryInput;
export declare const WETH_DAI_INPUT: UniswapV3PoolDiscoveryInput;
export declare const USDC_USDT_INPUT: UniswapV3PoolDiscoveryInput;
export declare const WETH_USDC_ARBITRUM_INPUT: UniswapV3PoolDiscoveryInput;
export declare const LOWERCASE_ADDRESSES_INPUT: UniswapV3PoolDiscoveryInput;
export declare const REVERSED_TOKEN_ORDER_INPUT: UniswapV3PoolDiscoveryInput;
export declare const INVALID_TOKEN_A_INPUT: UniswapV3PoolDiscoveryInput;
export declare const INVALID_TOKEN_B_INPUT: UniswapV3PoolDiscoveryInput;
export declare const UNSUPPORTED_CHAIN_INPUT: UniswapV3PoolDiscoveryInput;
export declare const MOCK_POOL_METRICS: {
    readonly HIGH_TVL: {
        readonly tvlUSD: "234567890.75";
        readonly volumeUSD: "23456789.12";
        readonly feesUSD: "23456.78";
    };
    readonly MEDIUM_TVL: {
        readonly tvlUSD: "123456789.50";
        readonly volumeUSD: "12345678.90";
        readonly feesUSD: "12345.67";
    };
    readonly LOW_TVL: {
        readonly tvlUSD: "45678901.25";
        readonly volumeUSD: "4567890.45";
        readonly feesUSD: "4567.89";
    };
    readonly ZERO_METRICS: {
        readonly tvlUSD: "0";
        readonly volumeUSD: "0";
        readonly feesUSD: "0";
    };
};
//# sourceMappingURL=test-fixtures.d.ts.map