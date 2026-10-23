import { test, expect } from '@playwright/test';
import { API_URL } from './helpers';

test('the menu lists the three most popular questions and each opens its answer', async ({
  page,
  request,
}) => {
  // Other tests open materials in parallel and move the ranking, so the menu gets a fixed answer
  // made of real questions; the ranking itself is covered by the backend tests.
  const all = (await (await request.get(`${API_URL}/api/questions?limit=100`)).json()) as {
    items: { id: string; question: string }[];
  };
  const popular = { hasPopularity: true, items: all.items.slice(-3) };
  await page.route('**/api/questions?order=popular&limit=3', (route) =>
    route.fulfill({ json: { mode: 'popular', total: all.items.length, ...popular } }),
  );
  await page.goto('/articles');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const menu = page.getByRole('navigation', { name: 'Основная навигация' });
  const links = menu.getByRole('listitem').getByRole('link');
  await expect(links).toHaveText(popular.items.map((item) => item.question));

  const target = popular.items[2];
  await links.nth(2).click();
  await expect(page).toHaveURL(new RegExp(`/questions#${target.id}$`));
  const question = page.locator(`#question-${target.id}`);
  await expect(question).toHaveAttribute('open', '');
  await expect(question).toBeInViewport();

  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await menu.getByRole('link', { name: 'Все вопросы' }).click();
  await expect(page).toHaveURL(/\/questions$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Вопрос — ответ' })).toBeVisible();
});

test('every topic in the menu opens all articles on that topic', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  const menu = page.getByRole('navigation', { name: 'Основная навигация' });
  await menu.getByRole('link', { name: /^Обозначения бренда/ }).click();
  await expect(page).toHaveURL(/\/articles\?topic=brand$/);
  await expect(page.getByRole('link', { name: 'Обозначения бренда', exact: true })).toHaveClass(
    /selected/,
  );
});

test('the search field has no shape of its own over its text when focused', async ({ page }) => {
  await page.goto('/articles');
  const field = page.getByRole('textbox', { name: 'Поиск по сайту' });
  await field.focus();
  const style = await field.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { radius: computed.borderRadius, outline: computed.outlineStyle };
  });
  expect(style).toEqual({ radius: '0px', outline: 'none' });
});

test('brand articles: calculator link and no «далее – ПП ВС РФ» notes', async ({ page }) => {
  await page.goto('/articles/brand-start');
  await page.getByRole('link', { name: 'калькуляторе пошлин' }).click();
  await expect(page).toHaveURL(/\/tools\/calculator\?schedule=trademarks$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Калькулятор пошлин' })).toBeVisible();

  await page.goto('/articles/brand-article');
  await expect(page.getByRole('heading', { name: /Как суд оценивает смешение/ })).toContainText(
    '№ 10):',
  );
  await expect(page.locator('main')).not.toContainText('далее – ПП ВС РФ');
  await page.goto('/ownership/brand');
  await expect(page.getByText(/Только регистрация в Роспатенте/)).toContainText(
    'Российской Федерации № 10.',
  );
  await expect(page.locator('main')).not.toContainText('далее – ПП ВС РФ');
});

test('search results mark articles and checklists with their own icon and label', async ({
  page,
}) => {
  await page.goto(`/search?q=${encodeURIComponent('бренд')}`);
  const article = page.getByRole('link', { name: /Элементный состав бренда/ });
  const checklist = page.getByRole('link', { name: /Порядок защиты бренда и домена/ });
  await expect(article).toContainText('Статья');
  await expect(checklist).toContainText('Чек-лист');
  await expect(article.locator('svg.lucide-bookmark')).toHaveCount(1);
  await expect(checklist.locator('svg.lucide-check-check')).toHaveCount(1);
  await expect(checklist.locator('svg.lucide-bookmark')).toHaveCount(0);
});

test('links to tools are one plain in-site link each', async ({ page }) => {
  await page.goto('/ownership/brand');
  const calculator = page.getByRole('link', { name: 'Воспользуйтесь нашим калькулятором' });
  await expect(calculator).toHaveAttribute('href', '/tools/calculator?schedule=trademarks');
  expect(await calculator.evaluate((link) => getComputedStyle(link).fontWeight)).not.toBe('700');
  await page.goto('/articles/brand-start');
  await expect(page.locator('main a[href*="168.113"]')).toHaveCount(0);
  await page.getByRole('button', { name: 'обратитесь к нашему юристу' }).click();
  await expect(page.getByRole('dialog', { name: 'Обсудить задачу с нами' })).toBeVisible();
});
