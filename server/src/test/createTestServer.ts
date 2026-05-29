import { bootstrap, type BootstrapOptions } from "../nest/bootstrap.js";

/**
 * Test bootstrap — same wiring as src/index.ts but doesn't bind a port.
 * Returns the Express instance (for supertest) and the Nest app (for cleanup).
 */
export async function createTestServer(opts: BootstrapOptions = {}) {
  const nest = await bootstrap({ ...opts, silent: true });
  await nest.init();
  return { express: nest.getHttpAdapter().getInstance(), nest };
}
