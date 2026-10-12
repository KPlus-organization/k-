import { createServer } from 'node:http';

import { createApp } from './app';
import { closePool } from './config/db';
import { env } from './config/env';

const SHUTDOWN_TIMEOUT_MS = 10_000;

const server = createServer(createApp());

server.on('error', (err) => {
  // E.g. EADDRINUSE: the port is already taken.
  console.error('[server] Failed to start HTTP server:', err);
  closePool()
    .catch((poolErr: unknown) => console.error('[db] Failed to close PostgreSQL pool:', poolErr))
    .finally(() => process.exit(1));
});

server.listen(env.port, () => {
  console.log(`[server] Listening on http://localhost:${env.port} (${env.nodeEnv})`);
  console.log(`[server] CORS allowed origins: ${env.frontendOrigins.join(', ')}`);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[server] Received ${signal}, shutting down...`);

  const forceExit = setTimeout(() => {
    console.error(`[server] Graceful shutdown timed out after ${SHUTDOWN_TIMEOUT_MS} ms, forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  let exitCode = 0;

  try {
    // Stops accepting new connections and waits for in-flight requests.
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
      server.closeIdleConnections();
    });
    console.log('[server] HTTP server closed');
  } catch (err) {
    exitCode = 1;
    console.error('[server] Error while closing HTTP server:', err);
  }

  try {
    await closePool();
    console.log('[db] PostgreSQL pool closed');
  } catch (err) {
    exitCode = 1;
    console.error('[db] Error while closing PostgreSQL pool:', err);
  }

  process.exit(exitCode);
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => void shutdown(signal));
}
