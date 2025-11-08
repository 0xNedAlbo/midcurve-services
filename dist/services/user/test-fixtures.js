export const ALICE = {
    input: {
        name: 'Alice',
        email: null,
        image: null,
    },
    dbResult: {
        id: 'user_alice_001',
        name: 'Alice',
        email: null,
        image: null,
        createdAt: new Date('2024-01-01T00:00:00.000Z'),
        updatedAt: new Date('2024-01-01T00:00:00.000Z'),
    },
};
export const BOB = {
    input: {
        name: 'Bob',
        email: null,
        image: null,
    },
    dbResult: {
        id: 'user_bob_001',
        name: 'Bob',
        email: null,
        image: null,
        createdAt: new Date('2024-01-02T00:00:00.000Z'),
        updatedAt: new Date('2024-01-02T00:00:00.000Z'),
    },
};
export const CHARLIE = {
    input: {
        name: 'Charlie Thompson',
        email: null,
        image: null,
    },
    dbResult: {
        id: 'user_charlie_001',
        name: 'Charlie Thompson',
        email: null,
        image: null,
        createdAt: new Date('2024-01-03T00:00:00.000Z'),
        updatedAt: new Date('2024-01-03T00:00:00.000Z'),
    },
};
export function createUserFixture(overrides = {}) {
    const name = overrides.name ?? 'Test User';
    const email = overrides.email ?? null;
    const image = overrides.image ?? null;
    const id = overrides.id ?? 'user_test_001';
    return {
        input: {
            name,
            email,
            image,
        },
        dbResult: {
            id,
            name,
            email,
            image,
            createdAt: new Date('2024-01-01T00:00:00.000Z'),
            updatedAt: new Date('2024-01-01T00:00:00.000Z'),
        },
    };
}
//# sourceMappingURL=test-fixtures.js.map