import type { PositionAprPeriod } from '@midcurve/shared';
export type CreateAprPeriodInput = Omit<PositionAprPeriod, 'id' | 'createdAt' | 'updatedAt'>;
export type UpdateAprPeriodInput = Partial<Omit<PositionAprPeriod, 'id' | 'createdAt' | 'updatedAt' | 'positionId' | 'startEventId' | 'endEventId'>>;
//# sourceMappingURL=position-apr-input.d.ts.map