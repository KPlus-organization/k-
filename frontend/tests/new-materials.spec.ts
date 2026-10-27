import { test, expect } from '@playwright/test';
import { linkTo, steps } from './helpers';

test('ownership and claims journeys open the new guides and their linked articles', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Оформить права/ }).click();
  await page
    .getByTestId('object-card')
    .getByRole('link', { name: 'Программный код', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ownership\/code$/);
  await expect(steps(page)).toBeVisible();
  await linkTo(page.getByRole('article'), 'code-registration').click();
  await expect(page).toHaveURL(/\/articles\/code-registration$/);
  await page.goto('/ownership/databases');
  await linkTo(page.getByRole('article'), 'database-rights').click();
  await expect(page).toHaveURL(/\/articles\/database-rights$/);
  await linkTo(page.getByRole('article'), 'database-coauthors').click();
  await expect(page).toHaveURL(/\/articles\/database-coauthors$/);
  await page.goto('/defend');
  await expect(page.getByTestId('object-card').getByRole('link')).toHaveCount(7);
  await page.getByRole('link', { name: 'Базы данных', exact: true }).click();
  await expect(page).toHaveURL(/\/defend\/databases$/);
  await expect(steps(page)).toBeVisible();
  await page.goto('/defend');
  await page.getByRole('link', { name: 'Обозначения бренда', exact: true }).click();
  await expect(page).toHaveURL(/\/defend\/brand$/);
  await expect(steps(page)).toBeVisible();
  await linkTo(page, 'brand-claim').click();
  await expect(page).toHaveURL(/\/articles\/brand-claim$/);
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('full-text search finds an imported article by a phrase from its text', async ({ page }) => {
  await page.goto('/search?q=' + encodeURIComponent('нераздельном соавторстве'));
  await expect(linkTo(page.getByRole('main'), 'database-coauthors')).toBeVisible();
});
