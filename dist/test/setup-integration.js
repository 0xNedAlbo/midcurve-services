import { beforeEach, afterEach } from 'vitest';
import { clearDatabase } from './helpers.js';
beforeEach(async () => {
    await clearDatabase();
});
afterEach(async () => {
    await clearDatabase();
});
//# sourceMappingURL=setup-integration.js.map