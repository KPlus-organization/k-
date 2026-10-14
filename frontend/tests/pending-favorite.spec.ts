import { test, expect } from '@playwright/test';
import { addFavorite, createUser, newCredentials, PASSWORD } from './helpers';

test('guest intent survives registration and reload, then is consumed once', async ({ page }) => {
  const credentials = newCredentials();
  await page.goto('/protect/code');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
  await page.getByRole('button', { name: 'Сохранить чек-лист' }).click();
  await page
    .getByRole('navigation', { name: 'Вход и регистрация' })
    .getByRole('link', { name: 'Создать профиль' })
    .click();
  await page.reload();
  await page.getByLabel('Логин', { exact: true }).fill(credentials.login);
  await page.getByLabel('Электронная почта', { exact: true }).fill(credentials.email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/protect\/code$/);
  const saved = page.getByRole('button', { name: 'В избранном', exact: true });
  await expect(saved).toBeVisible();
  await page.reload();
  await expect(saved).toBeVisible();
  await saved.click();
  await expect(page.getByRole('button', { name: 'Сохранить чек-лист' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Сохранить чек-лист' })).toBeVisible();
});

test('retry after failed auto-save adds idempotently without removing an existing favorite', async ({
  page,
  request,
}) => {
  const user = await createUser(request);
  await addFavorite(request, user, 'code-0');
  let attempts = 0;
  const mutations: string[] = [];
  await page.route('**/api/favorites/code-0', async (route) => {
    const method = route.request().method();
    mutations.push(method);
    if (method === 'PUT' && ++attempts === 1) await route.abort('connectionfailed');
    else await route.continue();
  });
  await page.goto('/articles/code-0');
  await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
  await page.getByRole('button', { name: 'Сохранить материал' }).click();
  await page.getByLabel('Электронная почта или логин').fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/code-0$/);
  await expect(
    page.getByRole('status').filter({ hasText: 'Не удалось добавить материал' }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByRole('status').filter({ hasText: 'Добавлено в избранное' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();
  expect(mutations).toEqual(['PUT', 'PUT']);
});
