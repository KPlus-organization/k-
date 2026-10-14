import { test, expect } from '@playwright/test';
import { PASSWORD, signIn } from './helpers';

test('pending login cannot submit twice and a network error allows retry', async ({ page }) => {
  let requests = 0;
  let release: () => void = () => undefined;
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/login', async (route) => {
    requests++;
    await pending;
    await route.abort('connectionfailed');
  });
  await page.goto('/login');
  await page.getByLabel('Электронная почта или логин').fill('test_user');
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Входим…' })).toBeDisabled();
  await expect(page.getByLabel('Пароль', { exact: true })).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  await page
    .getByRole('main')
    .locator('form')
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  expect(requests).toBe(1);
  release();
  await expect(page.getByRole('alert')).toContainText('Сервер недоступен');
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue(PASSWORD);
  await expect(page.getByRole('button', { name: 'Войти в профиль', exact: true })).toBeEnabled();
});

test('restored session skips login and rejects external or looping return addresses', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  for (const next of [
    '//example.com',
    '/\\example.com',
    '/login/',
    '/REGISTER',
    '/log%69n',
    '/%E0%A4%A',
  ]) {
    await page.goto(`/login?next=${encodeURIComponent(next)}`);
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Добро пожаловать');
  }
  await page.goto('/register?next=%2Farticles%2Fcode-0');
  await expect(page).toHaveURL(/\/articles\/code-0$/);
});

test('switching auth forms preserves the material destination and mobile pages have a heading', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/login?next=%2Farticles%2Fcode-0');
  await expect(page.getByRole('heading', { level: 1, name: 'Войти в профиль' })).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Вход и регистрация' })
    .getByRole('link', { name: 'Создать профиль' })
    .click();
  await expect(page).toHaveURL(/\/register\?next=%2Farticles%2Fcode-0$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Создать профиль' })).toBeVisible();
  await expect(page.getByLabel('Подтверждение пароля', { exact: true })).toHaveAttribute(
    'autocomplete',
    'new-password',
  );
});
