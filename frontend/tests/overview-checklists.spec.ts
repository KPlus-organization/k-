import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { signIn } from './helpers';

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
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      area === 'protect'
        ? 'Как защитить нарушенные права на сайт или приложение'
        : 'Как оспорить претензию о нарушении чужих прав',
    );
    await expect(page.getByTestId('guide-step')).toHaveCount(6);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('article')).not.toContainText('[ссылка]');
    await expect(
      page.getByTestId('guide-step').last().getByRole('heading', { level: 2 }),
    ).toContainText('Шаг 6.');
    const download = await request.get(
      (await page.getByRole('link', { name: 'Скачать файл' }).getAttribute('href'))!,
    );
    expect(download.ok()).toBe(true);
    expect(await download.body()).toEqual(await readFile(`../content/files/${area}-overview.docx`));
    if (area === 'defend') {
      const table = page.getByRole('table');
      await expect(table).toContainText('К чему предъявлена претензия');
      await table
        .getByRole('link', { name: 'Получена претензия к базе данных: как действовать?' })
        .click();
      await expect(page).toHaveURL(/\/defend\/databases$/);
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Содержание базы данных');
      await page.goBack();
    } else {
      await page
        .getByRole('article')
        .getByRole('link', { name: 'Программы для ЭВМ', exact: true })
        .click();
      await expect(page).toHaveURL(/\/protect\/code$/);
      await expect(page.getByTestId('guide-step')).toHaveCount(8);
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
  await page.getByRole('link', { name: /^Как оспорить претензию о нарушении чужих прав/ }).click();
  await expect(page).toHaveURL(/\/defend$/);
  await page.setViewportSize({ width: 390, height: 844 });
  for (const area of ['protect', 'defend']) {
    await page.goto(`/${area}`);
    await expect(page.getByTestId('guide-step')).toHaveCount(6);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `../tmp/preview/${area}-overview-mobile.png`, fullPage: true });
  }
});
