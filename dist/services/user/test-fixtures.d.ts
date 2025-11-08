import type { User } from '@prisma/client';
import type { CreateUserInput } from '../types/user/index.js';
export interface UserFixture {
    input: CreateUserInput;
    dbResult: User;
}
export declare const ALICE: UserFixture;
export declare const BOB: UserFixture;
export declare const CHARLIE: UserFixture;
export declare function createUserFixture(overrides?: Partial<CreateUserInput> & {
    id?: string;
}): UserFixture;
//# sourceMappingURL=test-fixtures.d.ts.map