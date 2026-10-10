import path from 'node:path';

import dotenv from 'dotenv';

// backend/.env, resolved from this file so it works for both src/ and dist/
// and regardless of the current working directory.
// Values already present in the process environment take precedence over .env.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), quiet: true });

const NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  frontendOrigin: string;
}

const DEFAULT_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function loadEnv(): Env {
  const problems: string[] = [];

  const rawNodeEnv = readOptional('NODE_ENV') ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(rawNodeEnv)) {
    problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
  }
  const nodeEnv = rawNodeEnv as NodeEnv;

  const rawPort = readOptional('PORT');
  const port = rawPort === undefined ? DEFAULT_PORT : Number(rawPort);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    problems.push('PORT must be an integer between 1 and 65535');
  }

  // The value itself is never included in messages: it contains credentials.
  const databaseUrl = readOptional('DATABASE_URL') ?? '';
  if (!databaseUrl) {
    problems.push('DATABASE_URL is required');
  } else if (!URL.canParse(databaseUrl) || !['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) {
    problems.push('DATABASE_URL must be a valid postgres:// or postgresql:// connection string');
  }

  const rawOrigin = readOptional('FRONTEND_ORIGIN') ?? DEFAULT_FRONTEND_ORIGIN;
  let frontendOrigin = rawOrigin;
  if (!URL.canParse(rawOrigin)) {
    problems.push('FRONTEND_ORIGIN must be an origin such as http://localhost:3000');
  } else {
    const url = new URL(rawOrigin);
    // Browsers send Origin without a path or trailing slash, so it must match exactly.
    if (url.origin === 'null' || rawOrigin.replace(/\/$/, '') !== url.origin) {
      problems.push('FRONTEND_ORIGIN must contain only scheme, host and port (no path), e.g. http://localhost:3000');
    }
    frontendOrigin = url.origin;
  }

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    databaseUrl,
    frontendOrigin,
  };
}

export const env: Env = loadEnv();
