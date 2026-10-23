import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { API_URL } from './helpers';

test('design guides open for each task and lead to the relevant articles', async ({ page }) => {
  for (const [area, steps, article] of [
    ['ownership', 8, /Файл в Figma передали/],
    ['protect', 8, /Что сравнивают в споре об интерфейсе/],
    ['defend', 10, /Один UI-kit/],
  ] as const) {
    await page.goto(`/${area}`);
    await page
      .getByTestId('object-card')
      .getByRole('link', { name: 'Дизайн интерфейса (UI/UX)' })
      .click();
    await expect(page).toHaveURL(`/${area}/design`);
    await expect(page.getByTestId('guide-step')).toHaveCount(steps);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await page.getByRole('article').getByRole('link', { name: article }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(article);
  }
});

test('the code claim guide links to the contractor article and existing evidence material', async ({
  page,
}) => {
  await page.goto('/defend/code');
  await expect(page.getByTestId('guide-step')).toHaveCount(10);
  await page
    .getByRole('article')
    .getByRole('link', { name: /Чужой код добавил подрядчик/ })
    .click();
  await expect(page).toHaveURL('/articles/code-contractor');
  await expect(page.getByRole('article')).toContainText(
    'Когда можно взыскать расходы с исполнителя?',
  );
  await page.goto('/defend/code');
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Как доказывают заимствование кода', exact: true })
    .click();
  await expect(page).toHaveURL('/articles/code-0');
  await page
    .getByRole('article')
    .getByRole('link', { name: 'Сформулировать вопросы эксперту.' })
    .click();
  await expect(page).toHaveURL('/articles/code-expert');
});

test('new materials have downloadable sources, readable mobile pages and working FAQ links', async ({
  page,
  request,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const id of [
    'design-ownership',
    'design-defense',
    'design-protection',
    'design-comparison',
    'design-figma',
    'design-ui-kit',
    'design-contractor',
    'code-defense',
    'code-contractor',
    'text-protection',
    'text-authorship',
    'text-claim',
  ]) {
    await page.goto(`/articles/${id}`);
    await expect(page.getByRole('article')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('article')).not.toContainText(
      /СЦЕНАРИЙ:|ОФОРМИТЬ ПРАВА ->|☐|Просчитать риски/,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth), id).toBeLessThanOrEqual(
      390,
    );
    const download = await request.get(`${API_URL}/api/materials/${id}/file`);
    expect(download.ok(), id).toBe(true);
    expect(await download.body(), id).toEqual(await readFile(`../content/files/${id}.docx`));
  }
  for (const [question, material] of [
    ['code-05', 'code-contractor'],
    ['design-10', 'design-figma'],
    ['design-11', 'design-comparison'],
    ['design-12', 'design-ui-kit'],
    ['design-13', 'design-contractor'],
    ['texts-10', 'text-claim'],
    ['texts-11', 'text-protection'],
    ['texts-13', 'text-authorship'],
  ]) {
    await page.goto(`/questions#${question}`);
    const answer = page.locator(`#question-${question}`);
    await expect(answer).toHaveAttribute('open', '');
    await answer.getByRole('link').click();
    await expect(page.getByRole('article')).toBeVisible();
    const file = page.getByRole('link', { name: 'Скачать файл' });
    await expect(file).toHaveAttribute('href', `${API_URL}/api/materials/${material}/file`);
  }
});
