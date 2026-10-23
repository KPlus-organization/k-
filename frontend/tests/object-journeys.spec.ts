import { test, expect } from '@playwright/test';

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
          await expect(
            page
              .getByRole('article')
              .getByRole('link', { name: 'Как доказывают заимствование кода', exact: true }),
          ).toBeVisible();
          await expect(
            page.getByRole('main').getByRole('link', { name: /Вопросы эксперту/ }),
          ).toBeVisible();
          await expect(
            page
              .getByRole('main')
              .getByRole('link', { name: /Запрет использования, убытки или компенсация/ }),
          ).toBeVisible();
          await expect(
            page.getByRole('link', { name: /Когда будет полезна регистрация/ }),
          ).toHaveCount(0);
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
  for (const [route, title, steps] of [
    ['/protect/databases', 'База данных как объект прав: как защититься при копировании?', 7],
    ['/defend/databases', 'Содержание базы данных: что делать, если вам предъявили претензию', 6],
    ['/protect/brand', 'Порядок защиты бренда и домена от копирования: как пресечь нарушение', 4],
    ['/defend/brand', 'Как защититься от претензии из-за использования чужого обозначения', 7],
  ] as const) {
    await page.goto(route);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByTestId('guide-step')).toHaveCount(steps);
  }
  await page.goto('/protect/unknown-object');
  await expect(page.getByRole('heading', { name: 'Объект не найден' })).toBeVisible();
  await page.getByRole('link', { name: 'Выбрать объект' }).click();
  await expect(page.getByTestId('object-card')).toHaveCount(7);
});
