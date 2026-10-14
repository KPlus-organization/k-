import { test, expect } from '@playwright/test';
import { addFavorite, createUser, newCredentials, PASSWORD, signIn } from './helpers';

test('Figma navigation, complete guide, and persistent favorites', async ({ page, request }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await signIn(page, request);
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
  await expect(objects.getByRole('link')).toHaveCount(7);
  await expect(page.getByText('Раздел пока не готов')).toHaveCount(0);
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
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();
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
  request,
}) => {
  const { login, email } = newCredentials();
  await page.goto('/register');
  await page.getByLabel('Логин', { exact: true }).fill(login);
  await page.getByLabel('Электронная почта', { exact: true }).fill(email);
  await page.getByLabel('Пароль', { exact: true }).fill('mock-password');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('mismatched');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Пароли не совпадают');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('mock-password');
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole('heading', { name: `Добро пожаловать, ${login}` })).toBeVisible();
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
  await expect(page.getByRole('link', { name: 'Войти в профиль' })).toBeVisible();

  // The same email cannot be registered twice.
  const duplicate = await request.post('http://localhost:3001/api/auth/register', {
    data: { login: `${login}_2`, email, password: PASSWORD, consent: true },
  });
  expect(duplicate.status()).toBe(409);
});

test('wrong password is rejected; a guest saving a material signs in and returns', async ({
  page,
  request,
}) => {
  const user = await createUser(request);
  await page.goto('/login');
  await page.getByLabel('Электронная почта или логин').fill(user.login);
  await page.getByLabel('Пароль', { exact: true }).fill('wrong-password');
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Неверный логин, email или пароль');

  await page.goto('/articles/code-0');
  await page.getByRole('button', { name: 'Сохранить материал' }).click();
  await expect(page).toHaveURL(/\/login\?next=%2Farticles%2Fcode-0$/);
  await page.getByLabel('Электронная почта или логин').fill(user.email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page).toHaveURL(/\/articles\/code-0$/);
  await expect(page.getByRole('button', { name: 'В избранном', exact: true })).toBeVisible();

  await page.goto('/profile');
  await expect(
    page.getByRole('main').getByRole('link', { name: /^Как доказывают заимствование кода/ }),
  ).toBeVisible();
});

test('login visibility toggle, menu keyboard handling, search and empty result', async ({
  page,
  request,
}) => {
  const user = await createUser(request);
  await page.goto('/login');
  await page.getByLabel('Электронная почта или логин').fill(user.login);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Показать пароль', exact: true }).click();
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: `Добро пожаловать, ${user.login}` }),
  ).toBeVisible();
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

  // Visits are recorded in the personal history.
  await page.goto('/profile');
  const history = page.getByRole('region', { name: 'История навигации' });
  await expect(history.getByRole('link', { name: 'Поиск: zzzzzzz' })).toBeVisible();
  await expect(history.getByRole('link', { name: 'Поиск: код' })).toBeVisible();
});

test('favorites can be removed and an unavailable tool has an honest state', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  for (const id of ['application', 'deadlines', 'classes']) await addFavorite(request, user, id);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Все избранные' }).click();
  const rows = page.getByRole('dialog').getByTestId('saved-row');
  await expect(rows).toHaveCount(3);
  for (let left = 2; left >= 0; left--) {
    await page
      .getByRole('button', { name: /Удалить из избранного:/ })
      .first()
      .click();
    await expect(rows).toHaveCount(left);
  }
  await expect(page.getByText('Пока нет сохранённых материалов.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /Калькулятор госпошлины Оцените/ }).click();
  await expect(page.getByRole('dialog')).toContainText('Этот раздел готовится');
  await page.getByRole('dialog').getByRole('link', { name: 'Открыть чек-лист' }).click();
  await expect(page).toHaveURL(/\/protect\/code$/);
});

test('desktop screenshots for comparison with Figma', async ({ page, request }) => {
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
  const user = await signIn(page, request);
  await addFavorite(request, user, 'checklist');
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: /Добро пожаловать/ })).toBeVisible();
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

test('form validation messages are in Russian, not the browser language', async ({ page }) => {
  const alert = page.getByRole('alert');
  const submit = page.getByRole('button', { name: 'Создать профиль', exact: true });
  await page.goto('/register');

  await submit.click();
  await expect(alert).toHaveText('Заполните поле «Логин».');
  await expect(page.getByLabel('Логин', { exact: true })).toBeFocused();

  await page.getByLabel('Логин', { exact: true }).fill('ab');
  await submit.click();
  await expect(alert).toHaveText('Логин: не менее 3 символов.');

  await page.getByLabel('Логин', { exact: true }).fill('user name');
  await submit.click();
  await expect(alert).toContainText('без пробелов');

  await page.getByLabel('Логин', { exact: true }).fill('new_user');
  await page.getByLabel('Электронная почта', { exact: true }).fill('not-an-email');
  await submit.click();
  await expect(alert).toHaveText('Укажите корректный адрес электронной почты.');

  await page.getByLabel('Электронная почта', { exact: true }).fill('new_user@example.test');
  await page.getByLabel('Пароль', { exact: true }).fill('short');
  await submit.click();
  await expect(alert).toHaveText('Пароль: не менее 8 символов.');

  await page.getByLabel('Пароль', { exact: true }).fill('long-enough-password');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('long-enough-password');
  await submit.click();
  await expect(alert).toHaveText('Подтвердите согласие на обработку персональных данных.');
  await expect(alert).not.toHaveText(/[A-Za-z]/);

  // Nothing was sent: the form is still open.
  await expect(page).toHaveURL(/\/register$/);
});
