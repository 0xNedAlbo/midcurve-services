import type { Address } from 'viem';
import { SupportedChainId } from './evm';
export declare const UNISWAP_V3_POSITION_MANAGER_ADDRESSES: Record<SupportedChainId, Address>;
export declare const UNISWAP_V3_POSITION_MANAGER_ABI: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly name: "positions";
    readonly outputs: readonly [{
        readonly internalType: "uint96";
        readonly name: "nonce";
        readonly type: "uint96";
    }, {
        readonly internalType: "address";
        readonly name: "operator";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "token0";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "token1";
        readonly type: "address";
    }, {
        readonly internalType: "uint24";
        readonly name: "fee";
        readonly type: "uint24";
    }, {
        readonly internalType: "int24";
        readonly name: "tickLower";
        readonly type: "int24";
    }, {
        readonly internalType: "int24";
        readonly name: "tickUpper";
        readonly type: "int24";
    }, {
        readonly internalType: "uint128";
        readonly name: "liquidity";
        readonly type: "uint128";
    }, {
        readonly internalType: "uint256";
        readonly name: "feeGrowthInside0LastX128";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint256";
        readonly name: "feeGrowthInside1LastX128";
        readonly type: "uint256";
    }, {
        readonly internalType: "uint128";
        readonly name: "tokensOwed0";
        readonly type: "uint128";
    }, {
        readonly internalType: "uint128";
        readonly name: "tokensOwed1";
        readonly type: "uint128";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "tokenId";
        readonly type: "uint256";
    }];
    readonly name: "ownerOf";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }];
    readonly name: "balanceOf";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}, {
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "owner";
        readonly type: "address";
    }, {
        readonly internalType: "uint256";
        readonly name: "index";
        readonly type: "uint256";
    }];
    readonly name: "tokenOfOwnerByIndex";
    readonly outputs: readonly [{
        readonly internalType: "uint256";
        readonly name: "";
        readonly type: "uint256";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}];
export interface UniswapV3PositionData {
    nonce: bigint;
    operator: Address;
    token0: Address;
    token1: Address;
    fee: number;
    tickLower: number;
    tickUpper: number;
    liquidity: bigint;
    feeGrowthInside0LastX128: bigint;
    feeGrowthInside1LastX128: bigint;
    tokensOwed0: bigint;
    tokensOwed1: bigint;
}
export declare const UNISWAP_V3_FACTORY_ADDRESSES: Record<SupportedChainId, Address>;
export declare const UNISWAP_V3_FACTORY_ABI: readonly [{
    readonly inputs: readonly [{
        readonly internalType: "address";
        readonly name: "tokenA";
        readonly type: "address";
    }, {
        readonly internalType: "address";
        readonly name: "tokenB";
        readonly type: "address";
    }, {
        readonly internalType: "uint24";
        readonly name: "fee";
        readonly type: "uint24";
    }];
    readonly name: "getPool";
    readonly outputs: readonly [{
        readonly internalType: "address";
        readonly name: "pool";
        readonly type: "address";
    }];
    readonly stateMutability: "view";
    readonly type: "function";
}];
export declare function getPositionManagerAddress(chainId: number): Address;
export declare function getFactoryAddress(chainId: number): Address;
export declare const NFPM_DEPLOYMENT_BLOCKS: Record<SupportedChainId, bigint>;
export declare function getNfpmDeploymentBlock(chainId: number): bigint;
//# sourceMappingURL=uniswapv3.d.ts.map