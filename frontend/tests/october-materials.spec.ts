import { expect, test } from '@playwright/test';
import { linkTo, steps } from './helpers';

test('general guides lead to the brand and visual checklists for each task', async ({ page }) => {
  for (const [area, topic, label, article] of [
    ['ownership', 'brand', /Обозначения продукта/, 'brand-start'],
    ['ownership', 'visuals', /Визуальный контент/, 'visuals-ai'],
    ['protect', 'visuals', /Визуальный контент/, 'visuals-copying'],
    ['defend', 'visuals', /Визуальный контент/, 'visuals-claim'],
    ['defend', 'brand', /Обозначения бренда/, 'brand-claim'],
  ] as const) {
    await page.goto(`/${area}`);
    const scope =
      area === 'ownership' ? page.getByRole('article') : page.getByTestId('object-card');
    await scope.getByRole('link', { name: label }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${area}/${topic}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(steps(page)).toBeVisible();
    await linkTo(page.getByRole('main'), article).click();
    await expect(page).toHaveURL(`/articles/${article}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('the code compensation article keeps the anchor the constructor links to', async ({
  page,
}) => {
  await page.goto('/articles/code-1#compensation-calculation');
  await expect(page.locator('#compensation-calculation')).toBeInViewport();
});

test('database, brand and visual questions link to published articles and are searchable', async ({
  page,
}) => {
  for (const topic of ['databases', 'brand', 'visuals']) {
    await page.goto('/questions');
    await page.getByLabel('Тема', { exact: true }).selectOption(topic);
    const questions = page.locator('details');
    await expect(questions.first()).toBeVisible();
    for (const summary of await page.locator('summary').all()) await summary.click();
    // One material link per answer, besides links to legal acts.
    await expect(page.locator('details[open] a[href^="/"]')).toHaveCount(await questions.count());
    await expect(page.getByText('Подробный материал готовится')).toHaveCount(0);
  }
  await linkTo(page, 'visuals-ai').click();
  await expect(page).toHaveURL(/\/articles\/visuals-ai$/);
  await linkTo(page.getByRole('article'), 'brand-ownership').click();
  await expect(page).toHaveURL(/\/ownership\/brand$/);
  await page
    .getByRole('article')
    .locator('a[href="/tools/calculator?schedule=trademarks"]')
    .click();
  await expect(page).toHaveURL(/\/tools\/calculator\?schedule=trademarks$/);
  await page.goto(
    '/search?q=' + encodeURIComponent('Элементы базы данных как объект правовой защиты'),
  );
  await linkTo(page.getByRole('main'), 'database-elements').click();
  await expect(page).toHaveURL(/\/articles\/database-elements/);
  await linkTo(page.getByRole('article'), 'database-protection').click();
  await expect(page).toHaveURL(/\/protect\/databases$/);
});
