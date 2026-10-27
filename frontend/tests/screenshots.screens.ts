import { expect, test, type Page } from '@playwright/test';
import { addFavorite, signIn } from './helpers';

// Screenshots for comparison with the Figma mockups, saved to ../tmp/preview/.
// Not part of `npm test`: run with `npm run screenshots`.

const shot = (page: Page, name: string) =>
  page.screenshot({ path: `../tmp/preview/${name}.png`, fullPage: true });

const mobile = { width: 390, height: 844 };

test('desktop pages', async ({ page, request }) => {
  for (const [url, name] of [
    ['/', 'home'],
    ['/login', 'login'],
    ['/register', 'register'],
    ['/protect', 'protect'],
    ['/protect/code', 'code'],
    ['/articles/brand-article', 'brand-article'],
  ] as const) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await shot(page, name);
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await shot(page, 'menu');
  const user = await signIn(page, request);
  await addFavorite(request, user, 'checklist');
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
  await shot(page, 'profile');
  await page.goto('/questions');
  await expect(page.locator('details').first()).toBeVisible();
  await shot(page, 'questions-desktop');
});

test('mobile pages', async ({ page }) => {
  await page.setViewportSize(mobile);
  for (const [url, name] of [
    ['/', 'mobile-home'],
    ['/protect', 'protect-overview-mobile'],
    ['/defend', 'defend-overview-mobile'],
    ['/ownership/brand', 'brand-ownership-mobile'],
    ['/defend/brand', 'new-brand-claim-mobile'],
    ['/ownership/databases', 'database-mobile'],
  ] as const) {
    await page.goto(url);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await shot(page, name);
  }
  await page.goto('/questions');
  await page.getByLabel('Тема', { exact: true }).selectOption('design');
  await page.locator('summary').first().click();
  await shot(page, 'questions-mobile');
  await page.goto('/');
  await page
    .getByRole('complementary', { name: 'Обратите внимание' })
    .getByRole('button', { name: 'Обсудить задачу с нами' })
    .click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Имя', { exact: true }).fill('Мария');
  await dialog.getByLabel('Электронная почта', { exact: true }).fill('maria@example.com');
  await dialog
    .getByLabel('Коротко о задаче')
    .fill('Наш программный код используют без разрешения.');
  await page.screenshot({ path: '../tmp/preview/lawyer-request-mobile.png' });
});

test('calculator', async ({ page }) => {
  await page.goto('/tools/calculator');
  await shot(page, 'calculator-start');
  await page.goto('/tools/calculator?schedule=trademarks&fee=2.22');
  await page.getByLabel('Количество классов МКТУ').selectOption('7');
  await page.getByLabel('Класс 1').fill('14');
  await page.getByRole('checkbox', { name: 'Нужно свидетельство на бумаге' }).check();
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(page.getByRole('region', { name: '31 000 ₽' })).toBeVisible();
  await shot(page, 'calculator');
});

test('document editor', async ({ page, request }) => {
  await signIn(page, request);
  await page.goto('/documents/claim/code');
  const guidance = page.getByRole('complementary', { name: 'Что можно приложить к претензии' });
  await expect(guidance).toBeVisible();
  await guidance.screenshot({ path: '../tmp/preview/claim-attachment-guidance.png' });
  await page.setViewportSize(mobile);
  await expect(page.locator('#document-recipient')).toBeVisible();
  await shot(page, 'document-editor-mobile');
});
