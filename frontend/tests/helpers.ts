import { randomBytes } from 'node:crypto';
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { materialHref } from '../src/entities/material/model/routes';

export const API_URL = process.env.VITE_API_URL ?? 'http://localhost:3001';
export const PASSWORD = 'e2e-password-123';

export type TestUser = {
  login: string;
  email: string;
  accessToken: string;
  refreshToken: string;
};

/** Unique e2e credentials: the tests share one database. */
export function newCredentials() {
  const login = `e2e_${randomBytes(5).toString('hex')}`;
  return { login, email: `${login}@example.test` };
}

/** Registers a new user through the API. */
export async function createUser(request: APIRequestContext): Promise<TestUser> {
  const credentials = newCredentials();
  const response = await request.post(`${API_URL}/api/auth/register`, {
    data: { ...credentials, password: PASSWORD, consent: true },
  });
  if (response.status() !== 201) throw new Error(`register: ${response.status()}`);
  const session = await response.json();
  return { ...credentials, accessToken: session.accessToken, refreshToken: session.refreshToken };
}

/** Opens the site as a signed-in new user: the app restores the session from storage. */
export async function signIn(page: Page, request: APIRequestContext): Promise<TestUser> {
  const user = await createUser(request);
  await page.goto('/');
  await page.evaluate(
    (token) => localStorage.setItem('moe-pravo:refresh-token', JSON.stringify(token)),
    user.refreshToken,
  );
  return user;
}

export async function addFavorite(request: APIRequestContext, user: TestUser, materialId: string) {
  const response = await request.put(`${API_URL}/api/favorites/${materialId}`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  if (response.status() !== 204) throw new Error(`favorite: ${response.status()}`);
}

/**
 * A link to a material found by its address: titles and wording change with the content,
 * material ids do not.
 */
export function linkTo(scope: Page | Locator, materialId: string) {
  const href = materialHref(materialId);
  // Search results add ?q=… to highlight the words found; links to a place in it add #….
  return scope.locator(`a[href="${href}"], a[href^="${href}?"], a[href^="${href}#"]`).first();
}

/** A checklist is shown: at least one step, whatever their number in the content. */
export function steps(page: Page) {
  return page.getByTestId('guide-step').first();
}
