import { PrismaClient } from '@prisma/client';
import { createServiceLogger } from '../../logging/index.js';
export class PoolDiscoveryService {
    _prisma;
    logger;
    constructor(dependencies = {}) {
        this._prisma = dependencies.prisma ?? new PrismaClient();
        this.logger = createServiceLogger(this.constructor.name);
        this.logger.info('PoolDiscoveryService initialized');
    }
    get prisma() {
        return this._prisma;
    }
}
//# sourceMappingURL=pool-discovery-service.js.map