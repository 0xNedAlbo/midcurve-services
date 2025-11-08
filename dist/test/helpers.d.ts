import { PrismaClient } from '@prisma/client';
export declare function getPrismaClient(): PrismaClient;
export declare function clearDatabase(): Promise<void>;
export declare function disconnectPrisma(): Promise<void>;
export declare function seedTestData(): Promise<{
    testUser: {
        name: string | null;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        email: string | null;
        image: string | null;
    };
    usdc: {
        symbol: string;
        name: string;
        id: string;
        config: import("@prisma/client/runtime/library").JsonValue;
        createdAt: Date;
        updatedAt: Date;
        coingeckoId: string | null;
        marketCap: number | null;
        decimals: number;
        tokenType: string;
        logoUrl: string | null;
    };
}>;
export declare function countAllRecords(): Promise<{
    users: number;
    tokens: number;
    pools: number;
    positions: number;
}>;
//# sourceMappingURL=helpers.d.ts.map