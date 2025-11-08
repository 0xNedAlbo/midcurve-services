import type { AnyPosition } from '@midcurve/shared';
export interface PositionListFilters {
    status?: 'active' | 'closed' | 'all';
    protocols?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'createdAt' | 'positionOpenedAt' | 'currentValue' | 'unrealizedPnl';
    sortDirection?: 'asc' | 'desc';
}
export interface PositionListResult {
    positions: AnyPosition[];
    total: number;
    limit: number;
    offset: number;
}
//# sourceMappingURL=position-list-input.d.ts.map