import { test, expect } from '@playwright/test';

test('Figma navigation, complete guide, and persistent favorites', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Мой продукт. Мои права.' })).toBeVisible();
  const cards = page.getByRole('region', { name: 'С чего начать' }).locator(':scope > *');
  await expect(cards).toHaveCount(4);
  const sizes = await cards.evaluateAll((elements) =>
    elements.map((element) => ({
      width: element.getBoundingClientRect().width,
      height: element.getBoundingClientRect().height,
    })),
  );
  expect(new Set(sizes.map((size) => Math.round(size.width))).size).toBe(1);
  expect(new Set(sizes.map((size) => Math.round(size.height))).size).toBe(1);
  await page.getByRole('link', { name: /^Защитить нарушенные права/ }).click();
  const objects = page.getByTestId('object-card');
  await expect(objects).toHaveCount(7);
  await expect(objects.getByRole('link')).toHaveCount(1);
  await expect(page.getByText('Раздел пока не готов')).toHaveCount(6);
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  const info = page.getByRole('button', { name: 'Об объекте «Программный код»' });
  await info.hover();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.getByRole('heading', { level: 1 }).hover();
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await info.focus();
  await expect(page.getByRole('tooltip')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('tooltip')).toHaveCount(0);
  await page.getByRole('link', { name: 'Программный код', exact: true }).click();
  await expect(page.getByTestId('guide-step')).toHaveCount(8);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await page.getByRole('button', { name: 'Сохранить чек-лист' }).click();
  await page.reload();
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await page.getByRole('link', { name: '8 Оценить ответ' }).click();
  await expect(page.locator('#step-8')).toBeInViewport();
  expect(errors).toEqual([]);
});

test('registration checks confirmation, profile settings persist, logout works', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Логин', { exact: true }).fill('test_user');
  await page.getByLabel('Электронная почта', { exact: true }).fill('test@example.com');
  await page.getByLabel('Пароль', { exact: true }).fill('mock-password');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('mismatched');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Пароли не совпадают');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('mock-password');
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: 'Добро пожаловать, test_user' })).toBeVisible();
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('dialog').getByLabel('Имя', { exact: true }).fill('Мария Иванова');
  await page.getByRole('button', { name: 'Сохранить изменения' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Добро пожаловать, Мария' })).toBeVisible();
  const stored = await page.evaluate(() => JSON.stringify(localStorage));
  expect(stored).not.toContain('mock-password');
  expect(stored).not.toContain('mismatched');
  await page.getByRole('button', { name: 'Выйти из профиля' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/profile');
  await expect(page.getByRole('button', { name: 'Открыть демо-профиль' })).toBeVisible();
});

test('login visibility toggle, menu keyboard handling, search and empty result', async ({
  page,
}) => {
  await page.goto('/login');
  await page.getByLabel('Электронная почта или логин').fill('anna');
  await page.getByLabel('Пароль', { exact: true }).fill('demo12345');
  await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Добро пожаловать, Анна' })).toBeVisible();
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Открыть меню' })).toBeFocused();
  await page.keyboard.press('Control+k');
  await expect(page.getByRole('textbox', { name: 'Поиск по сайту' })).toBeFocused();
  await page.getByRole('textbox', { name: 'Поиск по сайту' }).fill('код');
  await page.getByRole('textbox', { name: 'Поиск по сайту' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Программный код', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'Поиск по сайту' }).fill('zzzzzzz');
  await page.getByRole('textbox', { name: 'Поиск по сайту' }).press('Enter');
  await expect(page.getByRole('heading', { name: 'Ничего не найдено' })).toBeVisible();
});

test('favorites can be removed and an unavailable tool has an honest state', async ({ page }) => {
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Открыть демо-профиль' }).click();
  await page.getByRole('button', { name: 'Все избранные' }).click();
  await expect(page.getByRole('dialog').getByTestId('saved-row')).toHaveCount(3);
  for (let index = 0; index < 3; index++)
    await page
      .getByRole('button', { name: /Удалить из избранного:/ })
      .first()
      .click();
  await expect(page.getByText('Пока нет сохранённых материалов.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /Калькулятор госпошлины Оцените/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Этот раздел готовится');
  await page.getByRole('dialog').getByRole('link', { name: 'Открыть чек-лист' }).click();
  await expect(page).toHaveURL(/\/protect\/code$/);
});

test('desktop screenshots for comparison with Figma', async ({ page }) => {
  for (const [url, name] of [
    ['/', 'home'],
    ['/login', 'login'],
    ['/register', 'register'],
    ['/protect', 'protect'],
    ['/protect/code', 'code'],
  ] as const) {
    await page.goto(url);
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: `../tmp/preview/${name}.png`, fullPage: true });
  }
  await page.goto('/');
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page.screenshot({ path: '../tmp/preview/menu.png', fullPage: true });
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Открыть демо-профиль' }).click();
  await page.screenshot({ path: '../tmp/preview/profile.png', fullPage: true });
});

test('mobile screens fit the viewport and navigation works', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const url of [
    '/',
    '/login',
    '/register',
    '/protect',
    '/defend',
    '/protect/code',
    '/articles',
    '/search?q=код',
  ]) {
    await page.goto(url);
    const dimensions = await page.evaluate(() => ({
      content: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.content, url).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.getByRole('heading').first()).toBeVisible();
  }
  await page.goto('/');
  await page.screenshot({ path: '../tmp/preview/mobile-home.png', fullPage: true });
  await page.getByRole('button', { name: 'Открыть меню' }).click();
  await page
    .getByRole('navigation', { name: 'Основная навигация' })
    .getByRole('link', { name: 'Программный код', exact: true })
    .click();
  await expect(page).toHaveURL(/\/protect\/code$/);
  await expect(page.getByRole('navigation', { name: 'Основная навигация' })).not.toBeVisible();
});
