import { expect, test } from '@playwright/test';
import { API_URL, linkTo, steps } from './helpers';

test('design guides open for each task and lead to the relevant articles', async ({ page }) => {
  for (const [area, article] of [
    ['ownership', 'design-figma'],
    ['protect', 'design-comparison'],
    ['defend', 'design-ui-kit'],
  ] as const) {
    await page.goto(`/${area}`);
    await page
      .getByTestId('object-card')
      .getByRole('link', { name: 'Дизайн интерфейса (UI/UX)' })
      .click();
    await expect(page).toHaveURL(`/${area}/design`);
    await expect(steps(page)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await linkTo(page.getByRole('article'), article).click();
    await expect(page).toHaveURL(`/articles/${article}`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  }
});

test('the code claim guide links to the contractor article and existing evidence material', async ({
  page,
}) => {
  await page.goto('/defend/code');
  await expect(steps(page)).toBeVisible();
  await linkTo(page.getByRole('article'), 'code-contractor').click();
  await expect(page).toHaveURL('/articles/code-contractor');
  await page.goto('/defend/code');
  await linkTo(page.getByRole('article'), 'code-0').click();
  await expect(page).toHaveURL('/articles/code-0');
  await linkTo(page.getByRole('article'), 'code-expert').click();
  await expect(page).toHaveURL('/articles/code-expert');
});

test('FAQ answers lead to the new materials and their downloads', async ({ page }) => {
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
    // The material link; links to legal acts in the answer lead to ConsultantPlus.
    await answer.locator('a[href^="/"]').click();
    await expect(page.getByRole('article')).toBeVisible();
    const file = page.getByRole('link', { name: 'Скачать файл' });
    await expect(file).toHaveAttribute('href', `${API_URL}/api/materials/${material}/file`);
  }
});
