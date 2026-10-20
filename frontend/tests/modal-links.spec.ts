import { test, expect } from '@playwright/test';

test('an opened window is in the address, Back closes it and the page keeps its scroll', async ({
  page,
}) => {
  await page.goto('/protect');
  const notice = page.getByRole('complementary', { name: 'Обратите внимание' }).first();
  await notice.scrollIntoViewIfNeeded();
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);

  await notice.getByRole('button', { name: 'Обсудить задачу с юристом' }).click();
  const dialog = page.getByRole('dialog', { name: 'Обсудить задачу с юристом' });
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(/\/protect\?modal=lawyer-request$/);

  await page.goBack();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/protect$/);
  expect(await page.evaluate(() => window.scrollY)).toBe(scrolled);

  await page.goForward();
  await expect(dialog).toBeVisible();
  await page.getByRole('button', { name: 'Закрыть' }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/protect$/);
});

test('a link with ?modal opens the window, closing it leaves the page', async ({ page }) => {
  await page.goto('/?modal=lawyer-request');
  const dialog = page.getByRole('dialog', { name: 'Обсудить задачу с юристом' });
  await expect(dialog.getByLabel('Коротко о задаче')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading').first()).toBeVisible();
});

test('a link inside a window goes to its page, Back returns to the window', async ({ page }) => {
  await page.goto('/articles?modal=help');
  const dialog = page.getByRole('dialog', { name: 'Помощь' });
  await dialog.getByRole('link', { name: 'Перейти к защите прав' }).click();
  await expect(page).toHaveURL(/\/protect$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/articles\?modal=help$/);
  await expect(dialog).toBeVisible();
});

test('an unknown window id opens nothing', async ({ page }) => {
  await page.goto('/?modal=constructor');
  await expect(page.getByRole('heading').first()).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);
});
