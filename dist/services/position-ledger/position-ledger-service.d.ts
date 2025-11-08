import { PrismaClient } from '@prisma/client';
import type { PositionLedgerEvent, PositionLedgerEventConfigMap, PositionLedgerEventStateMap } from '@midcurve/shared';
import type { CreatePositionLedgerEventInput, PositionLedgerEventDiscoverInput } from '../types/position-ledger/position-ledger-event-input.js';
import type { ServiceLogger } from '../../logging/index.js';
import { PositionAprService } from '../position-apr/position-apr-service.js';
export interface PositionLedgerServiceDependencies {
    prisma?: PrismaClient;
    aprService?: PositionAprService;
}
export interface LedgerEventDbResult {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    positionId: string;
    protocol: string;
    previousId: string | null;
    timestamp: Date;
    eventType: string;
    inputHash: string;
    poolPrice: string;
    token0Amount: string;
    token1Amount: string;
    tokenValue: string;
    rewards: unknown;
    deltaCostBasis: string;
    costBasisAfter: string;
    deltaPnl: string;
    pnlAfter: string;
    config: unknown;
    state: unknown;
}
export declare abstract class PositionLedgerService<P extends keyof PositionLedgerEventConfigMap> {
    protected readonly _prisma: PrismaClient;
    protected readonly _aprService: PositionAprService;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PositionLedgerServiceDependencies);
    protected get prisma(): PrismaClient;
    protected get aprService(): PositionAprService;
    abstract parseConfig(configDB: unknown): PositionLedgerEventConfigMap[P]['config'];
    abstract serializeConfig(config: PositionLedgerEventConfigMap[P]['config']): unknown;
    abstract parseState(stateDB: unknown): PositionLedgerEventStateMap[P]['state'];
    abstract serializeState(state: PositionLedgerEventStateMap[P]['state']): unknown;
    abstract generateInputHash(input: CreatePositionLedgerEventInput<P>): string;
    abstract discoverAllEvents(positionId: string): Promise<PositionLedgerEvent<P>[]>;
    abstract discoverEvent(positionId: string, input: PositionLedgerEventDiscoverInput<P>): Promise<PositionLedgerEvent<P>[]>;
    protected mapToLedgerEvent(dbResult: LedgerEventDbResult): PositionLedgerEvent<P>;
    protected validateEventSequence(positionId: string, previousId: string | null, protocol: string): Promise<void>;
    findAllItems(positionId: string): Promise<PositionLedgerEvent<P>[]>;
    getMostRecentEvent(positionId: string): Promise<PositionLedgerEvent<P> | null>;
    addItem(positionId: string, input: CreatePositionLedgerEventInput<P>): Promise<PositionLedgerEvent<P>[]>;
    deleteAllItems(positionId: string): Promise<void>;
}
//# sourceMappingURL=position-ledger-service.d.ts.map