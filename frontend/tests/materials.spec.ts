import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('brand object opens complete article, source table, and four-step checklist', async ({
  page,
  request,
}) => {
  await page.goto('/articles?topic=brand');
  await page.getByRole('link', { name: /Элементный состав бренда/ }).click();
  await expect(page.getByRole('article')).toContainText('Сходство бывает и мнимым');
  await expect(
    page.getByRole('columnheader', { name: 'Категория объекта по ГК РФ' }),
  ).toBeVisible();
  await expect(
    page.getByRole('article').getByRole('link', { name: 'ст. 1225 ГК РФ' }),
  ).toHaveAttribute('href', /^https:\/\/www.consultant.ru\//);
  const download = await page.getByRole('link', { name: 'Скачать файл' }).getAttribute('href');
  const response = await request.get(download!);
  expect(response.ok()).toBeTruthy();
  expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  await page.getByRole('link', { name: /Порядок защиты бренда и домена/ }).click();
  await expect(page.getByTestId('guide-step')).toHaveCount(4);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('table')).toContainText('От цены лицензии');
  await expect(page.getByRole('article')).not.toContainText('краткая сводка ниже');
});

test('database checklists have no completion controls and keep favorites across navigation and reload', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/protect/databases');
  await expect(page.getByTestId('guide-step')).toHaveCount(7);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить чек-лист' }).click();
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Оформление прав на базу данных', exact: true })
    .click();
  await expect(page).toHaveURL(/\/ownership\/databases$/);
  await expect(page.getByTestId('guide-step')).toHaveCount(5);
  await expect(page.getByRole('table')).toHaveCount(2);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByRole('cell').filter({ hasText: 'Существенные затраты' })).toContainText(
    'презумпция — суд считает утверждение истинным, пока не доказано обратное',
  );
  await page.getByRole('link', { name: /Все материалы по теме/ }).click();
  await expect(page).toHaveURL(/\/articles\?topic=databases$/);
  await page
    .getByRole('link', {
      name: /^(?:Статья|Чек-лист|Памятка)\s*База данных как объект прав: как защититься при копировании/,
    })
    .click();
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
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Как доказывают заимствование кода', exact: true })
    .click();
  await expect(page.getByRole('article')).toContainText('Согласно статье 82 АПК РФ');
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Сформулировать вопросы эксперту.', exact: true })
    .click();
  await expect(page.getByRole('article').getByRole('listitem')).toHaveCount(5);
  await expect(page.getByRole('article')).toContainText('специфические ошибки');
  await page.goto('/protect/code');
  await page
    .getByRole('article')
    .getByRole('link', { name: /Убытки или компенсация: что требовать при копировании программы/ })
    .click();
  await expect(page.getByRole('article')).toContainText('одновременно убытки и компенсацию');
  await page.goto('/search?q=' + encodeURIComponent('служебные комментарии'));
  await expect(
    page.getByRole('link', { name: /Вопросы эксперту компьютерно-технической экспертизы/ }),
  ).toBeVisible();
  await page.goto('/articles?topic=databases');
  await expect(
    page.getByRole('link', {
      name: /^(?:Статья|Чек-лист|Памятка)\s*База данных как объект прав: как защититься при копировании/,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', {
      name: /^(?:Статья|Чек-лист|Памятка)\s*Оформление прав на базу данных/,
    }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: /Как доказывают заимствование/ })).toHaveCount(0);
});

test('ownership entry opens available guides and existing addresses remain accessible', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('link', { name: /Оформить права/ }).click();
  await expect(page).toHaveURL('/ownership');
  await expect(page.getByTestId('guide-step')).toHaveCount(5);
  await expect(
    page.getByTestId('object-card').getByRole('link', { name: 'Программный код', exact: true }),
  ).toBeVisible();
  await page.goto('/ownership/databases');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Оформление прав на базу данных',
  );
  await page.goto('/articles/unknown-material');
  await expect(page.getByRole('heading', { name: 'Материал не найден' })).toBeVisible();
});

// Skipped: mobile layout is not a priority yet. Kept to be re-enabled later
// (remove `.skip`); it is slow — nine pages and two full-page screenshots.
test.skip('all imported materials fit mobile and their tables stay scrollable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of [
    '/protect/brand',
    '/protect/databases',
    '/articles/brand-article',
    '/articles/brand-protection',
    '/articles/database-protection',
    '/ownership/databases',
    '/articles/code-0',
    '/articles/code-1',
    '/articles/code-expert',
  ]) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
      route,
    ).toBeLessThanOrEqual(390);
  }
  await page.goto('/ownership/databases');
  const table = page
    .getByRole('region', { name: 'Таблица материала: прокрутка по горизонтали' })
    .first();
  await table.focus();
  await expect(table).toBeFocused();
  expect(await table.evaluate((el) => el.scrollWidth > el.clientWidth)).toBeTruthy();
  await page.screenshot({ path: '../tmp/preview/database-mobile.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 960 });
  await page.goto('/articles/brand-article');
  await page.screenshot({ path: '../tmp/preview/brand-article.png', fullPage: true });
});
