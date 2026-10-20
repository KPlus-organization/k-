import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

// Over plain HTTP by IP (no domain yet) browsers hide secure-context APIs such as
// crypto.randomUUID; tests run on 127.0.0.1, where they exist, so they are removed here.
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Crypto.prototype, 'randomUUID', { value: undefined });
  });
});

test('a material page and the document editor work without crypto.randomUUID', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/protect');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.getByRole('link', { name: 'МоёПраво' }).first().click();
  await expect(page.getByRole('heading').first()).toBeVisible();

  await signIn(page, request);
  await page.goto('/documents/claim/code');
  await expect(page.locator('#document-applicantType')).toBeVisible();
  expect(errors).toEqual([]);
});
