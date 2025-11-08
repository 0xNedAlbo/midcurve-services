import { PrismaClient } from '@prisma/client';
export class UserService {
    prisma;
    constructor(dependencies = {}) {
        this.prisma = dependencies.prisma ?? new PrismaClient();
    }
    async create(input) {
        const user = await this.prisma.user.create({
            data: {
                name: input.name,
            },
        });
        return user;
    }
    async findById(id) {
        const user = await this.prisma.user.findUnique({
            where: { id },
        });
        return user;
    }
    async findByName(name) {
        const user = await this.prisma.user.findFirst({
            where: { name },
        });
        return user;
    }
    async update(id, input) {
        const user = await this.prisma.user.update({
            where: { id },
            data: input,
        });
        return user;
    }
    async delete(id) {
        const user = await this.prisma.user.delete({
            where: { id },
        });
        return user;
    }
    async findAll() {
        const users = await this.prisma.user.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return users;
    }
}
//# sourceMappingURL=user-service.js.map