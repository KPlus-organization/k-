import { expect, test } from '@playwright/test';
import { API_URL, PASSWORD, signIn } from './helpers';

test('withdrawing consent signs out, keeps the profile and asks for consent at the next sign-in', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Политика конфиденциальности' }).click();
  await expect(page.getByRole('dialog', { name: 'Политика конфиденциальности' })).toBeVisible();
  await page.getByRole('button', { name: 'Понятно' }).click();

  await page.getByRole('button', { name: 'Настройки' }).click();
  let settings = page.getByRole('dialog', { name: 'Настройки профиля' });
  await settings
    .getByRole('button', { name: 'согласие на обработку персональных данных', exact: true })
    .click();
  const consent = page.getByRole('dialog', { name: 'Согласие на обработку персональных данных' });
  await expect(consent).toContainText('25.10.2026');
  await consent.getByRole('button', { name: 'Вернуться к настройкам' }).click();

  settings = page.getByRole('dialog', { name: 'Настройки профиля' });
  await settings.getByRole('button', { name: 'Отозвать', exact: true }).click();
  await settings.getByRole('button', { name: 'Отмена' }).click();
  await settings.getByRole('button', { name: 'Отозвать', exact: true }).click();
  await settings.getByRole('button', { name: 'Подтвердить отзыв' }).click();
  await expect(page).toHaveURL('/login');
  await expect(page.getByRole('dialog')).toHaveCount(0);

  // Tokens issued before the withdrawal no longer open the profile.
  const profile = await request.get(`${API_URL}/api/profile`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  expect(profile.status()).toBe(401);

  await page.getByLabel('Электронная почта или логин').fill(user.login);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('Чтобы войти, дайте согласие снова');
  const checkbox = page.getByRole('checkbox');
  await expect(checkbox).not.toBeChecked();
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page.getByRole('alert')).toHaveText(
    'Подтвердите согласие на обработку персональных данных.',
  );
  await checkbox.check();
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page).toHaveURL('/profile');
  await expect(page.getByText(user.email)).toBeVisible();
});
