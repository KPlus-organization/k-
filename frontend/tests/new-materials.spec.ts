import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { API_URL } from './helpers';

test('ownership and claims journeys open the new guides and their linked articles', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Оформить права/ }).click();
  await page.getByRole('link', { name: 'Программный код', exact: true }).click();
  await expect(page).toHaveURL(/\/ownership\/code$/);
  await expect(page.getByTestId('guide-step')).toHaveCount(8);
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Когда будет полезна регистрация программного кода в Роспатенте' })
    .first()
    .click();
  await expect(page).toHaveURL(/\/articles\/code-registration$/);
  await expect(page.getByRole('article')).toContainText('62 рабочих дня');
  await page.goto('/ownership/databases');
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Кому принадлежат права на базу данных', exact: true })
    .click();
  await expect(page).toHaveURL(/\/articles\/database-rights$/);
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Соавторство при создании базы данных' })
    .click();
  await expect(page).toHaveURL(/\/articles\/database-coauthors$/);
  await page.goto('/defend');
  await expect(page.getByTestId('object-card').getByRole('link')).toHaveCount(7);
  await page.getByRole('link', { name: 'Базы данных', exact: true }).click();
  await expect(page.getByTestId('guide-step')).toHaveCount(6);
  await expect(page.getByRole('heading', { name: 'Шаг 4. Выбор позиции' })).toBeVisible();
  await page.goto('/defend');
  await page.getByRole('link', { name: 'Обозначения бренда', exact: true }).click();
  await expect(page).toHaveURL(/\/defend\/brand$/);
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('article')).toContainText('10 000 000 руб.');
});

test('seven imported files are downloadable unchanged and their content fits mobile', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [id, route, file] of [
    ['database-claim', '/defend/databases', 'database-claim'],
    ['brand-claim', '/defend/brand', 'brand-claim'],
    ['code-ownership', '/ownership/code', 'code-ownership'],
    ['code-registration', '/articles/code-registration', 'code-registration'],
    ['database-registration', '/ownership/databases', 'database-ownership'],
    ['database-coauthors', '/articles/database-coauthors', 'database-coauthors'],
    ['database-rights', '/articles/database-rights', 'database-rights'],
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('article')).not.toContainText(
      /можно ли здесь|здесь можно сделать|возможно стоит|если возможно/,
    );
    await expect(
      page.getByRole('complementary', { name: 'Обратите внимание' }).getByRole('button'),
    ).toHaveCount(2);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      route,
    ).toBeLessThanOrEqual(390);
    const download = await request.get(`${API_URL}/api/materials/${id}/file`);
    expect(download.status()).toBe(200);
    expect(await download.body()).toEqual(await readFile(`../content/files/${file}.docx`));
  }
  await page.goto('/search?q=' + encodeURIComponent('нераздельном соавторстве'));
  await expect(
    page.getByRole('link', { name: /Соавторство при создании базы данных/ }),
  ).toBeVisible();
  await page.goto('/defend/brand');
  await page.screenshot({ path: '../tmp/preview/new-brand-claim-mobile.png', fullPage: true });
});
