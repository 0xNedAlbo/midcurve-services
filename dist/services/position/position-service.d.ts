import { PrismaClient } from '@prisma/client';
import type { Position, PositionConfigMap } from '@midcurve/shared';
import type { PositionDiscoverInput, CreatePositionInput, UpdatePositionInput } from '../types/position/position-input.js';
import type { ServiceLogger } from '../../logging/index.js';
export interface PositionServiceDependencies {
    prisma?: PrismaClient;
}
interface PositionDbResult {
    id: string;
    positionHash: string | null;
    createdAt: Date;
    updatedAt: Date;
    protocol: string;
    positionType: string;
    userId: string;
    currentValue: string;
    currentCostBasis: string;
    realizedPnl: string;
    unrealizedPnl: string;
    collectedFees: string;
    unClaimedFees: string;
    lastFeesCollectedAt: Date;
    priceRangeLower: string;
    priceRangeUpper: string;
    poolId: string;
    isToken0Quote: boolean;
    pool: any;
    positionOpenedAt: Date;
    positionClosedAt: Date | null;
    isActive: boolean;
    config: unknown;
    state: unknown;
}
export declare abstract class PositionService<P extends keyof PositionConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PositionServiceDependencies);
    protected get prisma(): PrismaClient;
    abstract parseConfig(configDB: unknown): PositionConfigMap[P]['config'];
    abstract serializeConfig(config: PositionConfigMap[P]['config']): unknown;
    abstract parseState(stateDB: unknown): PositionConfigMap[P]['state'];
    abstract serializeState(state: PositionConfigMap[P]['state']): unknown;
    abstract createPositionHash(config: PositionConfigMap[P]['config']): string;
    abstract discover(userId: string, params: PositionDiscoverInput<P>): Promise<Position<P>>;
    abstract refresh(id: string): Promise<Position<P>>;
    abstract reset(id: string): Promise<Position<P>>;
    create(input: CreatePositionInput<P>): Promise<Position<P>>;
    findById(id: string): Promise<Position<P> | null>;
    findByPositionHash(userId: string, positionHash: string): Promise<Position<P> | null>;
    update(id: string, input: UpdatePositionInput<P>): Promise<Position<P>>;
    delete(id: string): Promise<void>;
    protected mapToPosition(dbResult: PositionDbResult): Position<P>;
}
export {};
//# sourceMappingURL=position-service.d.ts.map