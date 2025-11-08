import type { Position, PositionConfigMap } from '@midcurve/shared';
export interface UniswapV3PositionDiscoverInput {
    chainId: number;
    nftId: number;
    quoteTokenAddress?: string;
}
export interface PositionDiscoverInputMap {
    uniswapv3: UniswapV3PositionDiscoverInput;
}
export type PositionDiscoverInput<P extends keyof PositionDiscoverInputMap> = PositionDiscoverInputMap[P];
export type AnyPositionDiscoverInput = PositionDiscoverInput<keyof PositionDiscoverInputMap>;
export type CreatePositionInput<P extends keyof PositionConfigMap> = Pick<Position<P>, 'protocol' | 'positionType' | 'userId' | 'isToken0Quote' | 'config' | 'state'> & {
    poolId: string;
};
export type CreateUniswapV3PositionInput = CreatePositionInput<'uniswapv3'>;
export type CreateAnyPositionInput = CreatePositionInput<keyof PositionConfigMap>;
export type UpdatePositionInput<P extends keyof PositionConfigMap> = Partial<Pick<Position<P>, never>>;
export type UpdateUniswapV3PositionInput = UpdatePositionInput<'uniswapv3'>;
export type UpdateAnyPositionInput = UpdatePositionInput<keyof PositionConfigMap>;
//# sourceMappingURL=position-input.d.ts.map