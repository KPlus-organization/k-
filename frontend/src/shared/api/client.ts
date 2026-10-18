import { API_URL } from '@/shared/config';
import { readStored, removeStored, writeStored } from '@/shared/lib';

// HTTP client for the backend API (contract: docs/api.md). Authentication uses JWT:
// the access token lives in memory only, the refresh token in localStorage so that
// a reload keeps the user signed in. No cookies are used.

export type FieldIssue = { field: string; message: string };

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details: FieldIssue[] = [],
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export type AuthTokens = { accessToken: string; refreshToken: string };

const REFRESH_TOKEN_KEY = 'refresh-token';
let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
const expiredListeners = new Set<() => void>();

export function apiUrl(path: string) {
  return API_URL + path;
}

export function startSession(tokens: AuthTokens) {
  accessToken = tokens.accessToken;
  writeStored(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function endSession() {
  accessToken = null;
  removeStored(REFRESH_TOKEN_KEY);
}

export function storedRefreshToken() {
  return readStored<string | null>(REFRESH_TOKEN_KEY, null);
}

/** True if the user is signed in or a stored session can be restored. */
export function hasSession() {
  return accessToken !== null || storedRefreshToken() !== null;
}

/** Called when the session cannot be refreshed any more and the user is signed out. */
export function onSessionExpired(listener: () => void) {
  expiredListeners.add(listener);
  return () => {
    expiredListeners.delete(listener);
  };
}

async function send(path: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(apiUrl(path), init);
  } catch {
    throw new ApiError(0, 'NETWORK_ERROR', 'The server is unreachable');
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const body = await response.json().catch(() => undefined);
  if (response.ok) return body as T;
  const error = body?.error;
  throw new ApiError(
    response.status,
    error?.code ?? 'HTTP_ERROR',
    error?.message ?? response.statusText,
    error?.details ?? [],
  );
}

async function rotateTokens(): Promise<boolean> {
  // Read inside the lock: another tab may have rotated the token meanwhile.
  const refreshToken = storedRefreshToken();
  if (!refreshToken) return false;
  const response = await send('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (response.status === 400 || response.status === 401) {
    endSession();
    expiredListeners.forEach((listener) => listener());
    return false;
  }
  startSession(await parse<AuthTokens>(response));
  return true;
}

/**
 * Gets a new token pair. Concurrent calls share one request, and tabs take turns
 * via the Web Locks API: the server revokes every session if a used refresh token
 * is presented again, so two tabs must never rotate the same token.
 */
function refreshSession(): Promise<boolean> {
  refreshing ??= (
    'locks' in navigator
      ? navigator.locks.request('moe-pravo:refresh-token', rotateTokens)
      : rotateTokens()
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Send the access token, refreshing it when needed. */
  auth?: boolean;
  response?: 'json' | 'blob';
};

/** Calls the API and returns the parsed JSON; throws ApiError for error responses. */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = false } = options;
  if (auth && accessToken === null && !(await refreshSession())) {
    throw new ApiError(401, 'AUTH_REQUIRED', 'Sign-in required');
  }

  const request = () => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (auth && accessToken) headers['Authorization'] = `Bearer ${accessToken}`;
    return send(path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  };

  let response = await request();
  // The access token expired (or the secret changed): refresh once and retry.
  if (auth && response.status === 401 && (await refreshSession())) response = await request();
  if (options.response === 'blob' && response.ok) return (await response.blob()) as T;
  return parse<T>(response);
}
