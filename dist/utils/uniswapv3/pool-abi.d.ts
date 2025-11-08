export declare const uniswapV3PoolAbi: readonly [{
    readonly type: "function";
    readonly name: "token0";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }];
}, {
    readonly type: "function";
    readonly name: "token1";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "address";
    }];
}, {
    readonly type: "function";
    readonly name: "fee";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint24";
    }];
}, {
    readonly type: "function";
    readonly name: "tickSpacing";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "int24";
    }];
}, {
    readonly type: "function";
    readonly name: "slot0";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "sqrtPriceX96";
        readonly type: "uint160";
    }, {
        readonly name: "tick";
        readonly type: "int24";
    }, {
        readonly name: "observationIndex";
        readonly type: "uint16";
    }, {
        readonly name: "observationCardinality";
        readonly type: "uint16";
    }, {
        readonly name: "observationCardinalityNext";
        readonly type: "uint16";
    }, {
        readonly name: "feeProtocol";
        readonly type: "uint8";
    }, {
        readonly name: "unlocked";
        readonly type: "bool";
    }];
}, {
    readonly type: "function";
    readonly name: "liquidity";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint128";
    }];
}, {
    readonly type: "function";
    readonly name: "feeGrowthGlobal0X128";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly type: "function";
    readonly name: "feeGrowthGlobal1X128";
    readonly stateMutability: "view";
    readonly inputs: readonly [];
    readonly outputs: readonly [{
        readonly name: "";
        readonly type: "uint256";
    }];
}, {
    readonly type: "function";
    readonly name: "ticks";
    readonly stateMutability: "view";
    readonly inputs: readonly [{
        readonly name: "tick";
        readonly type: "int24";
    }];
    readonly outputs: readonly [{
        readonly name: "liquidityGross";
        readonly type: "uint128";
    }, {
        readonly name: "liquidityNet";
        readonly type: "int128";
    }, {
        readonly name: "feeGrowthOutside0X128";
        readonly type: "uint256";
    }, {
        readonly name: "feeGrowthOutside1X128";
        readonly type: "uint256";
    }, {
        readonly name: "tickCumulativeOutside";
        readonly type: "int56";
    }, {
        readonly name: "secondsPerLiquidityOutsideX128";
        readonly type: "uint160";
    }, {
        readonly name: "secondsOutside";
        readonly type: "uint32";
    }, {
        readonly name: "initialized";
        readonly type: "bool";
    }];
}];
export interface Slot0 {
    sqrtPriceX96: bigint;
    tick: number;
    observationIndex: number;
    observationCardinality: number;
    observationCardinalityNext: number;
    feeProtocol: number;
    unlocked: boolean;
}
//# sourceMappingURL=pool-abi.d.ts.map