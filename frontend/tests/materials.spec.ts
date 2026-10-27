import { test, expect } from '@playwright/test';
import { linkTo, signIn, steps } from './helpers';

test('brand object opens complete article, source table, and checklist', async ({
  page,
  request,
}) => {
  await page.goto('/articles?topic=brand');
  await linkTo(page, 'brand-article').click();
  await expect(page).toHaveURL(/\/articles\/brand-article$/);
  const article = page.getByRole('article');
  await expect(article.getByRole('table').first()).toBeVisible();
  await expect(article.locator('a[href^="https://www.consultant.ru/"]').first()).toBeVisible();
  const download = await page.getByRole('link', { name: 'Скачать файл' }).getAttribute('href');
  const response = await request.get(download!);
  expect(response.ok()).toBeTruthy();
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  await linkTo(page, 'brand-protection').click();
  await expect(page).toHaveURL(/\/protect\/brand$/);
  await expect(steps(page)).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('table').first()).toBeVisible();
});

test('database checklists have no completion controls and keep favorites across navigation and reload', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/protect/databases');
  await expect(steps(page)).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить чек-лист' }).click();
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();
  await linkTo(page.getByRole('article'), 'database-registration').click();
  await expect(page).toHaveURL(/\/ownership\/databases$/);
  await expect(steps(page)).toBeVisible();
  await expect(page.getByRole('table').first()).toBeVisible();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('link', { name: /Все материалы по теме/ }).click();
  await expect(page).toHaveURL(/\/articles\?topic=databases$/);
  await linkTo(page, 'database-protection').click();
  await expect(page).toHaveURL(/\/protect\/databases$/);
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('code checklist links to both articles and expert questions, with full-text search', async ({
  page,
}) => {
  await page.goto('/protect/code');
  await linkTo(page.getByRole('article'), 'code-0').click();
  await expect(page).toHaveURL(/\/articles\/code-0$/);
  await linkTo(page.getByRole('article'), 'code-expert').click();
  await expect(page).toHaveURL(/\/articles\/code-expert$/);
  await expect(page.getByRole('article').getByRole('listitem').first()).toBeVisible();
  await page.goto('/protect/code');
  await linkTo(page.getByRole('article'), 'code-1').click();
  await expect(page).toHaveURL(/\/articles\/code-1$/);
  // Full-text search finds a material by words from its text, not only from its title.
  await page.goto('/search?q=' + encodeURIComponent('служебные комментарии'));
  await expect(linkTo(page.getByRole('main'), 'code-expert')).toBeVisible();
  // The topic catalog lists the topic's materials and no others.
  await page.goto('/articles?topic=databases');
  await expect(linkTo(page, 'database-protection')).toBeVisible();
  await expect(linkTo(page, 'database-registration')).toBeVisible();
  await expect(page.locator('a[href="/articles/code-0"]')).toHaveCount(0);
});

test('ownership entry opens available guides and existing addresses remain accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Оформить права/ }).click();
  await expect(page).toHaveURL('/ownership');
  await expect(steps(page)).toBeVisible();
  await expect(
    page.getByTestId('object-card').getByRole('link', { name: 'Программный код', exact: true }),
  ).toBeVisible();
  await page.goto('/ownership/databases');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.goto('/articles/unknown-material');
  await expect(page.getByRole('heading', { name: 'Материал не найден' })).toBeVisible();
});
