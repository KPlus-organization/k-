import { expect, test } from '@playwright/test';
import { API_URL, signIn } from './helpers';

test('questions open from home and sidebar, show eight answers and link to materials', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Вопрос — ответ Короткие/ }).click();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByRole('heading', { name: 'Вопрос — ответ', exact: true })).toBeVisible();
  await expect(page.locator('details')).toHaveCount(8);
  await page.getByRole('button', { name: 'Показать ещё 8' }).click();
  await expect(page.locator('details')).toHaveCount(16);
  await page.getByLabel('Найти вопрос').fill('переписал часть кода');
  await expect(page.locator('details')).toHaveCount(1);
  await page.locator('summary').click();
  await expect(page.locator('details[open]')).toContainText('Частичная переработка кода');
  const view = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/materials/code-0/view') && response.status() === 204,
  );
  await page.getByRole('link', { name: /Как доказывают заимствование кода/ }).click();
  await expect(page).toHaveURL(/\/articles\/code-0$/);
  await view;
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Все вопросы' })
    .click();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.locator('details')).toHaveCount(8);
});

test('published design references, filters, keyboard access and mobile layout', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/questions');
  await page.getByLabel('Тема', { exact: true }).selectOption('design');
  await expect(page.locator('details')).toHaveCount(4);
  await page.locator('#question-design-10 summary').focus();
  await page.keyboard.press('Enter');
  const expanded = page.locator('details[open]');
  await expect(expanded).not.toContainText('Подробный материал готовится');
  await expect(expanded.getByRole('link')).toHaveAttribute('href', '/articles/design-figma');
  await expect(expanded).toContainText('Передача файла Figma');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '../tmp/preview/questions-mobile.png', fullPage: true });
  await page.getByLabel('Найти вопрос').fill('zzz-не-существует');
  await expect(page.getByRole('heading', { name: 'Вопросы не найдены' })).toBeVisible();
  await page.getByRole('button', { name: 'Сбросить поиск' }).click();
  await expect(page.locator('details')).toHaveCount(8);
});

test('reading history personalizes the list and logout clears the personalized selection', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  const view = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/materials/database-rights/view') && response.status() === 204,
  );
  await page.goto('/articles/database-rights');
  await view;
  await page.goto('/questions');
  await expect(page.getByRole('heading', { name: 'По вашим интересам' })).toBeVisible();
  await expect(page.locator('summary').first()).toContainText('Базы данных');
  await expect(page.locator('summary').first()).not.toContainText(
    'Базу данных создавал другой человек',
  );
  const history = await request.get(`${API_URL}/api/history`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  expect(
    (await history.json()).items.some(
      (item: { target: string }) => item.target === 'database-rights',
    ),
  ).toBe(true);
  await page.screenshot({ path: '../tmp/preview/questions-desktop.png', fullPage: true });
  await page.goto('/profile');
  await page.getByRole('button', { name: /Выйти/ }).click();
  await page.goto('/questions');
  await expect(page.getByRole('heading', { name: 'По вашим интересам' })).toHaveCount(0);
  await expect(page.locator('details')).toHaveCount(8);
});

test('a failed questions request can be retried', async ({ page }) => {
  await page.route('**/api/questions?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: { code: 'UNAVAILABLE', message: 'Unavailable' } }),
    }),
  );
  await page.goto('/questions');
  await expect(page.getByRole('button', { name: /Повторить/ })).toBeVisible();
  await page.unroute('**/api/questions?*');
  await page.getByRole('button', { name: /Повторить/ }).click();
  await expect(page.locator('details')).toHaveCount(8);
});
