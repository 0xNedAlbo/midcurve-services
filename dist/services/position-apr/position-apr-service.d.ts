import { PrismaClient } from '@prisma/client';
import type { PositionAprPeriod } from '@midcurve/shared';
import type { ServiceLogger } from '../../logging/index.js';
export interface PositionAprServiceDependencies {
    prisma?: PrismaClient;
}
export declare class PositionAprService {
    protected readonly prisma: PrismaClient;
    protected readonly logger: ServiceLogger;
    constructor(dependencies?: PositionAprServiceDependencies);
    calculateAprPeriods(positionId: string): Promise<PositionAprPeriod[]>;
    refresh(positionId: string): Promise<PositionAprPeriod[]>;
    getAprPeriods(positionId: string): Promise<PositionAprPeriod[]>;
    getCurrentApr(positionId: string): Promise<number | null>;
    getAverageApr(positionId: string): Promise<number | null>;
    private divideEventsIntoPeriods;
    private buildAprPeriodFromEvents;
    private deserializeEvent;
    private deserializePeriod;
}
//# sourceMappingURL=position-apr-service.d.ts.map