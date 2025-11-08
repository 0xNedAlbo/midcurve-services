import { SupportedChainId } from './evm';
export const UNISWAP_V3_POSITION_MANAGER_ADDRESSES = {
    [SupportedChainId.ETHEREUM]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    [SupportedChainId.ARBITRUM]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    [SupportedChainId.OPTIMISM]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    [SupportedChainId.POLYGON]: '0xC36442b4a4522E871399CD717aBDD847Ab11FE88',
    [SupportedChainId.BASE]: '0x03a520b32C04BF3bEEf7BEb72E919cf822Ed34f1',
    [SupportedChainId.BSC]: '0x7b8A01B39D58278b5DE7e48c8449c9f4F5170613',
};
export const UNISWAP_V3_POSITION_MANAGER_ABI = [
    {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'positions',
        outputs: [
            { internalType: 'uint96', name: 'nonce', type: 'uint96' },
            { internalType: 'address', name: 'operator', type: 'address' },
            { internalType: 'address', name: 'token0', type: 'address' },
            { internalType: 'address', name: 'token1', type: 'address' },
            { internalType: 'uint24', name: 'fee', type: 'uint24' },
            { internalType: 'int24', name: 'tickLower', type: 'int24' },
            { internalType: 'int24', name: 'tickUpper', type: 'int24' },
            { internalType: 'uint128', name: 'liquidity', type: 'uint128' },
            {
                internalType: 'uint256',
                name: 'feeGrowthInside0LastX128',
                type: 'uint256',
            },
            {
                internalType: 'uint256',
                name: 'feeGrowthInside1LastX128',
                type: 'uint256',
            },
            { internalType: 'uint128', name: 'tokensOwed0', type: 'uint128' },
            { internalType: 'uint128', name: 'tokensOwed1', type: 'uint128' },
        ],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'uint256', name: 'tokenId', type: 'uint256' }],
        name: 'ownerOf',
        outputs: [{ internalType: 'address', name: '', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [{ internalType: 'address', name: 'owner', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
    {
        inputs: [
            { internalType: 'address', name: 'owner', type: 'address' },
            { internalType: 'uint256', name: 'index', type: 'uint256' },
        ],
        name: 'tokenOfOwnerByIndex',
        outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
    },
];
export const UNISWAP_V3_FACTORY_ADDRESSES = {
    [SupportedChainId.ETHEREUM]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    [SupportedChainId.ARBITRUM]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    [SupportedChainId.OPTIMISM]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    [SupportedChainId.POLYGON]: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
    [SupportedChainId.BASE]: '0x33128a8fC17869897dcE68Ed026d694621f6FDfD',
    [SupportedChainId.BSC]: '0xdB1d10011AD0Ff90774D0C6Bb92e5C5c8b4461F7',
};
export const UNISWAP_V3_FACTORY_ABI = [
    {
        inputs: [
            { internalType: 'address', name: 'tokenA', type: 'address' },
            { internalType: 'address', name: 'tokenB', type: 'address' },
            { internalType: 'uint24', name: 'fee', type: 'uint24' },
        ],
        name: 'getPool',
        outputs: [{ internalType: 'address', name: 'pool', type: 'address' }],
        stateMutability: 'view',
        type: 'function',
    },
];
export function getPositionManagerAddress(chainId) {
    const address = UNISWAP_V3_POSITION_MANAGER_ADDRESSES[chainId];
    if (!address) {
        throw new Error(`UniswapV3 NonfungiblePositionManager not deployed on chain ${chainId}. ` +
            `Supported chains: ${Object.keys(UNISWAP_V3_POSITION_MANAGER_ADDRESSES).join(', ')}`);
    }
    return address;
}
export function getFactoryAddress(chainId) {
    const address = UNISWAP_V3_FACTORY_ADDRESSES[chainId];
    if (!address) {
        throw new Error(`UniswapV3 Factory not deployed on chain ${chainId}. ` +
            `Supported chains: ${Object.keys(UNISWAP_V3_FACTORY_ADDRESSES).join(', ')}`);
    }
    return address;
}
export const NFPM_DEPLOYMENT_BLOCKS = {
    [SupportedChainId.ETHEREUM]: 12369621n,
    [SupportedChainId.ARBITRUM]: 165n,
    [SupportedChainId.BASE]: 1371680n,
    [SupportedChainId.BSC]: 26324014n,
    [SupportedChainId.POLYGON]: 22757547n,
    [SupportedChainId.OPTIMISM]: 4294n,
};
export function getNfpmDeploymentBlock(chainId) {
    const block = NFPM_DEPLOYMENT_BLOCKS[chainId];
    if (block === undefined) {
        throw new Error(`UniswapV3 NonfungiblePositionManager deployment block unknown for chain ${chainId}. ` +
            `Supported chains: ${Object.keys(NFPM_DEPLOYMENT_BLOCKS).join(', ')}`);
    }
    return block;
}
//# sourceMappingURL=uniswapv3.js.map