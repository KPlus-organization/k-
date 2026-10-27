import { test, expect } from '@playwright/test';
import { linkTo, steps } from './helpers';

for (const area of ['protect', 'defend']) {
  test(`${area}: every object opens relevant content or an available consultation form`, async ({
    page,
  }) => {
    await page.goto(`/${area}`);
    const links = page.getByTestId('object-card').getByRole('link');
    await expect(links).toHaveCount(7);
    const routes = await links.evaluateAll((items) =>
      items.map((item) => item.getAttribute('href')!),
    );
    for (const route of routes) {
      await page.goto(route);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (/\/(code|design|databases|brand|visuals)$/.test(route)) {
        await expect(page.getByText('Материалы по этому объекту готовятся')).toHaveCount(0);
        if (route === '/defend/code') {
          // Claims about code lead to evidence and remedies, not to registration.
          await expect(linkTo(page.getByRole('article'), 'code-0')).toBeVisible();
          await expect(linkTo(page.getByRole('main'), 'code-expert')).toBeVisible();
          await expect(linkTo(page.getByRole('main'), 'code-1')).toBeVisible();
          await expect(page.locator('a[href="/articles/code-registration"]')).toHaveCount(0);
        } else {
          await expect(page.getByRole('article')).toBeVisible();
        }
      } else {
        await expect(
          page.getByRole('heading', { name: 'Материалы по этому объекту готовятся' }),
        ).toBeVisible();
        await page.getByRole('button', { name: 'Обсудить задачу с нами' }).click();
        await expect(page.getByRole('dialog').getByLabel('Коротко о задаче')).toBeVisible();
        await page.keyboard.press('Escape');
      }
    }
  });
}

test('database and brand routes distinguish protecting rights from answering claims', async ({
  page,
}) => {
  for (const object of ['databases', 'brand']) {
    const titles: string[] = [];
    for (const area of ['protect', 'defend']) {
      await page.goto(`/${area}/${object}`);
      await expect(steps(page)).toBeVisible();
      titles.push(await page.getByRole('heading', { level: 1 }).innerText());
    }
    expect(titles[0], object).not.toBe(titles[1]);
  }
  await page.goto('/protect/unknown-object');
  await expect(page.getByRole('heading', { name: 'Объект не найден' })).toBeVisible();
  await page.getByRole('link', { name: 'Выбрать объект' }).click();
  await expect(page.getByTestId('object-card')).toHaveCount(7);
});
