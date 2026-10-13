import { randomBytes } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { after, before } from 'node:test';

import { createApp } from '../src/app';
import { closePool, pool } from '../src/config/db';
import { migrate } from '../src/db/migrate';
import { syncContent } from '../src/db/seed';

export interface ApiResponse<T = any> {
  status: number;
  headers: Headers;
  body: T;
}

let server: Server;
let baseUrl = '';
const createdLogins: string[] = [];

/**
 * Starts the app on a random port against DATABASE_URL, after applying migrations
 * and syncing content/ (the demo user is not touched). Users created through
 * `registerUser` are deleted afterwards.
 */
export function setupApi(): void {
  before(async () => {
    const quiet = () => undefined;
    await migrate(quiet);
    await syncContent({ log: quiet });
    server = createServer(createApp());
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  after(async () => {
    if (createdLogins.length > 0) {
      await pool.query('DELETE FROM users WHERE login_key = ANY($1)', [createdLogins.map((l) => l.toLowerCase())]);
    }
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await closePool();
  });
}

export function apiUrl(path: string): string {
  return baseUrl + path;
}

export async function api<T = any>(
  method: string,
  path: string,
  options: { body?: unknown; token?: string; headers?: Record<string, string> } = {},
): Promise<ApiResponse<T>> {
  const headers: Record<string, string> = { ...options.headers };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  const res = await fetch(baseUrl + path, {
    method,
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const text = await res.text();
  return { status: res.status, headers: res.headers, body: text ? JSON.parse(text) : undefined };
}

export function uniqueLogin(): string {
  return `t_${randomBytes(5).toString('hex')}`;
}

export const TEST_PASSWORD = 'correct-horse-battery';

/** Registers a fresh user; it is deleted after the test file finishes. */
export async function registerUser(overrides: Record<string, unknown> = {}) {
  const login = (overrides['login'] as string | undefined) ?? uniqueLogin();
  createdLogins.push(login);
  const res = await api('POST', '/api/auth/register', {
    body: { login, email: `${login}@example.test`, password: TEST_PASSWORD, consent: true, ...overrides },
  });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body as {
    accessToken: string;
    refreshToken: string;
    user: { id: string; login: string; email: string; name: string };
  };
}

/** Remembers a login created outside registerUser so that it is cleaned up. */
export function trackLogin(login: string): void {
  createdLogins.push(login);
}
