import { expect, test } from '@playwright/test';

test('registration opens the supplied consent without losing form data or accepting it automatically', async ({
  page,
}) => {
  await page.goto('/register');
  await page.getByLabel('Логин', { exact: true }).fill('consent-check');
  await page.getByLabel('Электронная почта', { exact: true }).fill('consent@example.com');
  await page.getByLabel('Пароль', { exact: true }).fill('test-password-123');
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill('test-password-123');
  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).not.toBeChecked();
  await page
    .getByRole('button', { name: 'согласие на обработку персональных данных', exact: true })
    .click();
  const dialog = page.getByRole('dialog', {
    name: 'Согласие на обработку персональных данных',
    exact: true,
  });
  await expect(dialog).toContainText('ООО «МоёПраво»');
  await expect(dialog).toContainText('регистрации и ведения учетной записи');
  await expect(dialog).toContainText('сохранения черновиков (драфтов) договоров');
  await expect(dialog).toContainText('Отозвать согласие на обработку персональных данных');
  await expect(dialog).toContainText('25.10.2026');
  await expect(dialog).not.toContainText(/\(\?\)|если мы предусматриваем|это если у нас|Или:/);
  await dialog.getByRole('button', { name: 'Вернуться к регистрации' }).click();
  await expect(checkbox).not.toBeChecked();
  await expect(page.getByLabel('Логин', { exact: true })).toHaveValue('consent-check');
  await expect(page.getByLabel('Пароль', { exact: true })).toHaveValue('test-password-123');
  const submitted: unknown[] = [];
  await page.route('**/api/auth/register', async (route) => {
    submitted.push(route.request().postDataJSON());
    await route.fulfill({
      status: 409,
      json: { error: { code: 'LOGIN_TAKEN', message: 'Login is already taken' } },
    });
  });
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Подтвердите согласие на обработку персональных данных.',
  );
  expect(submitted).toHaveLength(0);
  await checkbox.check();
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted[0]).toMatchObject({ consent: true, login: 'consent-check' });
});

test('the consent deep link fits a phone and keeps the intended registration destination', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/register?next=%2Fdocuments&modal=personal-data-consent');
  const dialog = page.getByRole('dialog', { name: 'Согласие на обработку персональных данных' });
  await expect(dialog).toBeVisible();
  expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await dialog.getByRole('button', { name: 'Вернуться к регистрации' }).click();
  await expect(page).toHaveURL('/register?next=%2Fdocuments');
  await expect(page.getByRole('checkbox')).not.toBeChecked();
});

test('registration links to the full privacy policy', async ({ page }) => {
  await page.goto('/register');
  await page.getByRole('button', { name: 'политикой конфиденциальности.' }).click();
  const dialog = page.getByRole('dialog', { name: 'Политика конфиденциальности' });
  await expect(
    dialog.getByRole('heading', { name: '10. Отзыв согласия и управление данными' }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('heading', { name: '11. Изменение настоящей Политики' }),
  ).toBeVisible();
  await expect(dialog).toContainText('Дата публикации: 25.10.2026');
  await expect(dialog).not.toContainText('готовится');
});
