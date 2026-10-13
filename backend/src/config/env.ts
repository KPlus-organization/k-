import path from 'node:path';

import dotenv from 'dotenv';

import { PROJECT_ROOT } from './paths';

// backend/.env regardless of the current working directory.
// Values already present in the process environment take precedence over .env.
dotenv.config({ path: path.join(PROJECT_ROOT, '.env'), quiet: true });

const NODE_ENVS = ['development', 'production', 'test'] as const;
type NodeEnv = (typeof NODE_ENVS)[number];

export interface Env {
  nodeEnv: NodeEnv;
  isProduction: boolean;
  port: number;
  databaseUrl: string;
  frontendOrigins: string[];
  jwtSecret: string;
  accessTokenTtlSeconds: number;
  refreshTokenTtlDays: number;
  /** Repository content: objects.json, materials.json, files/. */
  contentDir: string;
}

const DEFAULT_PORT = 3001;
const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
const DEFAULT_ACCESS_TOKEN_TTL_SECONDS = 900;
const DEFAULT_REFRESH_TOKEN_TTL_DAYS = 30;
const MIN_JWT_SECRET_LENGTH = 32;

function readOptional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function readPositiveInt(name: string, fallback: number, problems: string[]): number {
  const raw = readOptional(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    problems.push(`${name} must be a positive integer`);
  }
  return value;
}

function loadEnv(): Env {
  const problems: string[] = [];

  const rawNodeEnv = readOptional('NODE_ENV') ?? 'development';
  if (!(NODE_ENVS as readonly string[]).includes(rawNodeEnv)) {
    problems.push(`NODE_ENV must be one of: ${NODE_ENVS.join(', ')}`);
  }
  const nodeEnv = rawNodeEnv as NodeEnv;

  const port = readPositiveInt('PORT', DEFAULT_PORT, problems);
  if (port > 65535) {
    problems.push('PORT must be an integer between 1 and 65535');
  }

  // The value itself is never included in messages: it contains credentials.
  const databaseUrl = readOptional('DATABASE_URL') ?? '';
  if (!databaseUrl) {
    problems.push('DATABASE_URL is required');
  } else if (!URL.canParse(databaseUrl) || !['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) {
    problems.push('DATABASE_URL must be a valid postgres:// or postgresql:// connection string');
  }

  const rawOrigins = (readOptional('FRONTEND_ORIGIN') ?? DEFAULT_FRONTEND_ORIGIN)
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
  const frontendOrigins: string[] = [];
  for (const rawOrigin of rawOrigins) {
    // Browsers send Origin without a path or trailing slash, so it must match exactly.
    const url = URL.canParse(rawOrigin) ? new URL(rawOrigin) : undefined;
    if (!url || url.origin === 'null' || rawOrigin.replace(/\/$/, '') !== url.origin) {
      problems.push(
        `FRONTEND_ORIGIN entries must contain only scheme, host and port (no path), e.g. http://localhost:3000; got "${rawOrigin}"`,
      );
    } else {
      frontendOrigins.push(url.origin);
    }
  }
  if (rawOrigins.length === 0) {
    problems.push('FRONTEND_ORIGIN must contain at least one origin');
  }

  // Never included in messages: it is a secret.
  const jwtSecret = readOptional('JWT_SECRET') ?? '';
  if (jwtSecret.length < MIN_JWT_SECRET_LENGTH) {
    problems.push(`JWT_SECRET is required and must be at least ${MIN_JWT_SECRET_LENGTH} characters long`);
  }

  const accessTokenTtlSeconds = readPositiveInt(
    'ACCESS_TOKEN_TTL_SECONDS',
    DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
    problems,
  );
  const refreshTokenTtlDays = readPositiveInt('REFRESH_TOKEN_TTL_DAYS', DEFAULT_REFRESH_TOKEN_TTL_DAYS, problems);

  // Defaults to content/ in the repository root, next to backend/.
  const contentDir = path.resolve(PROJECT_ROOT, readOptional('CONTENT_DIR') ?? '../content');

  if (problems.length > 0) {
    throw new Error(`Invalid environment configuration:\n  - ${problems.join('\n  - ')}`);
  }

  return {
    nodeEnv,
    isProduction: nodeEnv === 'production',
    port,
    databaseUrl,
    frontendOrigins: [...new Set(frontendOrigins)],
    jwtSecret,
    accessTokenTtlSeconds,
    refreshTokenTtlDays,
    contentDir,
  };
}

export const env: Env = loadEnv();
