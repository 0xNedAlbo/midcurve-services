import { PrismaClient } from '@prisma/client';
import type { User } from '@prisma/client';
import type { CreateUserInput, UpdateUserInput } from '../types/user/index.js';
export declare class UserService {
    private readonly prisma;
    constructor(dependencies?: {
        prisma?: PrismaClient;
    });
    create(input: CreateUserInput): Promise<User>;
    findById(id: string): Promise<User | null>;
    findByName(name: string): Promise<User | null>;
    update(id: string, input: UpdateUserInput): Promise<User>;
    delete(id: string): Promise<User>;
    findAll(): Promise<User[]>;
}
//# sourceMappingURL=user-service.d.ts.map