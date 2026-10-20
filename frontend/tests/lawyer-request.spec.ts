import { test, expect } from '@playwright/test';
import { signIn } from './helpers';

test('request validates, closes the dialog and shows a frontend submission notification', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.method() === 'POST') requests.push(request.url());
  });
  const notice = page.getByRole('complementary', { name: 'Обратите внимание' });
  await expect(notice).toContainText(
    'Материал носит общий информационный характер и не заменяет консультации юриста.',
  );
  await expect(notice.getByRole('button', { name: 'Найти юриста' })).toBeVisible();
  await notice.getByRole('button', { name: 'Обсудить задачу с юристом' }).click();
  const dialog = page.getByRole('dialog');
  const submit = dialog.getByRole('button', { name: 'Отправить заявку' });
  await submit.click();
  await expect(dialog.getByRole('alert')).toHaveText('Заполните поле «Имя».');
  await dialog.getByLabel('Имя', { exact: true }).fill('Мария');
  await dialog.getByLabel('Логин', { exact: true }).fill('maria');
  await dialog.getByLabel('Коротко о задаче').fill('          ');
  await submit.click();
  await expect(dialog.getByRole('alert')).toContainText('Опишите задачу подробнее');
  await expect(dialog.getByLabel('Коротко о задаче')).toBeFocused();
  await dialog
    .getByLabel('Коротко о задаче')
    .fill('Наш программный код используют без разрешения.');
  await page.screenshot({ path: '../tmp/preview/lawyer-request-mobile.png' });
  await submit.click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole('status')).toHaveText('Заявка отправлена');
  await notice.getByRole('button', { name: 'Обсудить задачу с юристом' }).click();
  await expect(dialog.getByLabel('Коротко о задаче')).toHaveValue('');
  expect(requests).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('material notice has both actions and a request uses profile details', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  await page.goto('/articles/code-0');
  const notice = page
    .getByRole('article')
    .getByRole('complementary', { name: 'Обратите внимание' });
  await expect(notice).toContainText(
    'Материал носит общий характер и не заменяет консультацию юриста по вашему делу.',
  );
  await expect(notice).toContainText(
    'Правовые нормы сверены с актуальной редакцией, и данный материал актуален на 21.10.26.',
  );
  await notice.getByRole('button', { name: 'Найти юриста' }).click();
  await expect(page.getByRole('dialog', { name: 'Найти юриста' })).toBeVisible();
  await page.keyboard.press('Escape');
  await notice.getByRole('button', { name: 'Обсудить задачу с юристом' }).click();
  await expect(page.getByRole('dialog').getByLabel('Имя', { exact: true })).toHaveValue(user.login);
  await expect(page.getByRole('dialog').getByLabel('Логин', { exact: true })).toHaveValue(
    user.login,
  );
});
