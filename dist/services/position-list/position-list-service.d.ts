import { PrismaClient } from '@prisma/client';
import type { PositionListFilters, PositionListResult } from '../types/position-list/position-list-input.js';
export interface PositionListServiceDependencies {
    prisma?: PrismaClient;
}
export declare class PositionListService {
    private readonly _prisma;
    private readonly logger;
    constructor(dependencies?: PositionListServiceDependencies);
    protected get prisma(): PrismaClient;
    list(userId: string, filters?: PositionListFilters): Promise<PositionListResult>;
    private mapToPosition;
    private mapPool;
    private mapToken;
}
//# sourceMappingURL=position-list-service.d.ts.map