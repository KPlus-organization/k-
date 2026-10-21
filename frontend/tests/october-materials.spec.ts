import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { API_URL } from './helpers';

test('general guides lead to the brand and visual checklists for each task', async ({ page }) => {
  for (const [area, topic, label, title, steps, article] of [
    [
      'ownership',
      'brand',
      /Обозначения продукта/,
      /Как оформить и зарегистрировать права на название/,
      9,
      /Почему важно оформить права/,
    ],
    [
      'ownership',
      'visuals',
      /Визуальный контент/,
      /Как легально получить и оформить права/,
      9,
      /Картинку сгенерировала нейросеть/,
    ],
    [
      'protect',
      'visuals',
      /Визуальный контент/,
      /Первые шаги после обнаружения копии/,
      7,
      /Как на практике воруют/,
    ],
    [
      'defend',
      'visuals',
      /Визуальный контент/,
      /Получили претензию из-за использования чужого визуального контента/,
      8,
      /Платить нельзя спорить/,
    ],
    [
      'defend',
      'brand',
      /Обозначения бренда/,
      /Как защититься от претензии из-за использования чужого обозначения/,
      7,
      /Требуют компенсацию/,
    ],
  ] as const) {
    await page.goto(`/${area}`);
    const scope =
      area === 'ownership' ? page.getByRole('article') : page.getByTestId('object-card');
    await scope.getByRole('link', { name: label }).first().click();
    await expect(page).toHaveURL(new RegExp(`/${area}/${topic}$`));
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByTestId('guide-step')).toHaveCount(steps);
    await page.getByRole('link', { name: article }).last().click();
    await expect(page).toHaveURL(/\/articles\//);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article);
  }
});

test('published materials render on mobile with current notices and download their originals', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const ids = [
    'code-1',
    'brand-article',
    'brand-protection',
    'database-protection',
    'database-registration',
    'database-fair-use',
    'database-elements',
    'database-rights',
    'database-coauthors',
    'brand-ownership',
    'brand-start',
    'visuals-ownership',
    'visuals-ai',
    'brand-defense',
    'brand-claim',
    'visuals-claim',
    'visuals-protection',
    'visuals-copying',
    'visuals-defense',
  ];
  for (const id of ids) {
    await page.goto(`/articles/${id}`);
    await expect(page.getByRole('article')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('article')).not.toContainText(
      /СЦЕНАРИЙ:|можно ли здесь|здесь можно сделать|возможно стоит|если возможно|\(ссылка|right\d/,
    );
    const notice = page.getByRole('complementary', { name: 'Обратите внимание' });
    await expect(notice.getByRole('button')).toHaveCount(2);
    await expect(notice).toContainText(/актуален на 21\.10\.(?:2026|26)/);
    await expect(notice).not.toContainText(/(?:13|18|19)\.10\.(?:2026|26)/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(
      390,
    );
    const download = await request.get(`${API_URL}/api/materials/${id}/file`);
    expect(download.status(), id).toBe(200);
    const file =
      id === 'database-registration'
        ? 'database-ownership'
        : id === 'brand-article'
          ? 'brand-protection'
          : id;
    expect(await download.body(), id).toEqual(await readFile(`../content/files/${file}.docx`));
  }
  await page.goto('/ownership/brand');
  await page.screenshot({ path: '../tmp/preview/brand-ownership-mobile.png', fullPage: true });
});

test('updated code compensation article retains constructor anchor and practical examples', async ({
  page,
}) => {
  await page.goto('/articles/code-1#compensation-calculation');
  await expect(page.locator('#compensation-calculation')).toHaveText('3. Взыскание компенсации');
  await expect(page.locator('#compensation-calculation')).toBeInViewport();
  const article = page.getByRole('article');
  await expect(article.getByRole('listitem')).toHaveCount(8);
  await expect(article).toContainText('Потеря доходов от лицензирования');
  await expect(article).toContainText('Утрата коммерческого контракта');
  await expect(article).toContainText('4 000 000 рублей');
  await expect(article).toContainText('1 000 000 рублей');
});

test('database, brand and visual questions link to published articles and are searchable', async ({
  page,
}) => {
  for (const [topic, count] of [
    ['databases', 7],
    ['brand', 6],
    ['visuals', 6],
  ] as const) {
    await page.goto('/questions');
    await page.getByLabel('Тема', { exact: true }).selectOption(topic);
    await expect(page.locator('details')).toHaveCount(count);
    for (const summary of await page.locator('summary').all()) await summary.click();
    await expect(page.locator('details[open] a')).toHaveCount(count);
    await expect(page.getByText('Подробный материал готовится')).toHaveCount(0);
  }
  await page.getByRole('link', { name: /Картинку сгенерировала нейросеть/ }).click();
  await expect(page).toHaveURL(/\/articles\/visuals-ai$/);
  await page
    .getByRole('article')
    .getByRole('link', { name: /регистрации названия и логотипа/ })
    .click();
  await expect(page).toHaveURL(/\/ownership\/brand$/);
  await page
    .getByRole('article')
    .getByRole('link', { name: /нашим калькулятором/ })
    .click();
  await expect(page).toHaveURL(/\/tools\/calculator\?schedule=trademarks$/);
  await page.goto(
    '/search?q=' + encodeURIComponent('Элементы базы данных как объект правовой защиты'),
  );
  await page
    .getByRole('link', { name: /^(?:Статья|Чек-лист|Памятка)\s*Элементы базы данных/ })
    .click();
  await expect(page).toHaveURL(/\/articles\/database-elements$/);
  await page
    .getByRole('article')
    .getByRole('link', { name: /База данных как объект прав/ })
    .click();
  await expect(page).toHaveURL(/\/protect\/databases$/);
});
