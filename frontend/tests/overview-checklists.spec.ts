import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { linkTo, signIn, steps } from './helpers';

for (const area of ['protect', 'defend'] as const) {
  test(`${area}: home opens the full overview before object materials`, async ({
    page,
    request,
  }) => {
    await page.goto('/');
    await page
      .getByRole('link', {
        name: area === 'protect' ? /^Защитить нарушенные права/ : /^Оспорить претензию/,
      })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${area}$`));
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(steps(page)).toBeVisible();
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    const download = await request.get(
      (await page.getByRole('link', { name: 'Скачать файл' }).getAttribute('href'))!,
    );
    expect(download.ok()).toBe(true);
    expect(await download.body()).toEqual(await readFile(`../content/files/${area}-overview.docx`));
    if (area === 'defend') {
      // The table of claims leads to the checklist for each object.
      await linkTo(page.getByRole('table'), 'database-claim').click();
      await expect(page).toHaveURL(/\/defend\/databases$/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      await page.goBack();
    }
    await page.getByRole('link', { name: 'Перейти к выбору объекта' }).click();
    await expect(page.locator('#objects')).toBeInViewport();
    await expect(page.getByTestId('object-card')).toHaveCount(7);
    await page
      .getByTestId('object-card')
      .getByRole('link', { name: 'Программный код', exact: true })
      .click();
    await expect(page).toHaveURL(new RegExp(`/${area}/code$`));
  });
}

test('overview favorites reopen the checklist and new guides fit mobile', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/defend');
  await page.getByRole('button', { name: 'Сохранить чек-лист' }).click();
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.goto('/profile');
  await page
    .getByRole('link', {
      name: /^(?:Статья|Чек-лист|Памятка)\s*Как оспорить претензию о нарушении чужих прав/,
    })
    .click();
  await expect(page).toHaveURL(/\/defend$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const area of ['protect', 'defend']) {
    await page.goto(`/${area}`);
    await expect(steps(page)).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});
