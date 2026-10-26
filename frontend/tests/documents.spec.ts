import { test, expect, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { API_URL, newCredentials, PASSWORD, signIn } from './helpers';

async function fillClaim(page: Page) {
  for (const [id, value] of Object.entries({
    applicantType: 'person',
    rightsBasis: 'author',
    contract: 'no',
    moneyType: 'fixed',
    violationAction: 'copy',
    comparison: 'fragments',
    stopAction: 'copy',
  })) {
    await page.locator(`#document-${id}`).selectOption(value);
  }
  for (const [id, value] of Object.entries({
    recipient: 'ООО Конкурент',
    recipientAddress: 'Москва, улица Примерная, 10',
    applicant: 'Иван Петров',
    applicantAddress: 'Москва, улица Тестовая, 1',
    email: 'ivan@example.test',
    phone: '+7 900 000-00-00',
    program: 'Сервис заказов',
    version: '2.1',
    createdPeriod: '2025–2026 годы',
    purpose: 'Обработка заказов',
    elements: 'Модуль orders.ts',
    rightsEvidence: 'Договоры, история коммитов, акты',
    discovered: '15 октября 2026 года',
    location: 'https://example.test/app',
    circumstances: 'Размещён модуль обработки заказов',
    matches: 'Совпали уникальные комментарии',
    violationEvidence: 'Протокол осмотра и сравнение фрагментов',
    stopLocations: 'https://example.test/app',
    fixedAmount: '45000',
    moneyEvidence: 'Продолжительность нарушения и объём использования',
    payee: 'Иван Петров',
    account: '40702810000000000001',
    bank: 'Тестовый банк',
    bik: '044525225',
    correspondent: '30101810000000000001',
    responseAddress: 'Москва, улица Тестовая, 1',
    date: '2026-10-18',
    signerName: 'Иван Петров',
  }))
    await page.locator(`#document-${id}`).fill(value);
}

test('every template field can be filled inside the document, with plain-language help and linked repetitions', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  const response = await request.get(`${API_URL}/api/document-templates/code-claim`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  const template = await response.json();
  await page.goto('/documents/claim/code');
  const paper = page.getByRole('article', { name: 'Заполнение документа' });
  await expect(paper.locator('#document-recipient')).toBeVisible();
  await expect(paper.locator('[contenteditable="true"]')).toHaveCount(0);
  const notice = page.locator('section', { hasText: 'Обратите внимание!' });
  await expect(notice.getByRole('button', { name: 'Найти юриста' })).toBeVisible();
  await expect(notice.getByRole('button', { name: 'Обсудить задачу с нами' })).toBeVisible();
  await expect(paper).toContainText(
    'Способы защиты исключительного права предусмотрены статьями 1250 и 1252 ГК РФ.',
  );
  await page.locator('#document-recipient').fill('ООО Первый адресат');
  await expect(paper.locator('[name="recipient"]').nth(1)).toHaveValue('ООО Первый адресат');
  await paper.locator('[name="recipient"]').nth(1).fill('ООО Новый адресат');
  await expect(page.locator('#document-recipient')).toHaveValue('ООО Новый адресат');
  const seen = new Set<string>();
  const collect = async () => {
    const controls = await paper
      .locator('input[name], select[name], textarea[name]')
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          name: node.getAttribute('name')!,
          hint:
            document.getElementById(node.getAttribute('aria-describedby')?.split(' ')[0] ?? '')
              ?.textContent ?? '',
        })),
      );
    for (const control of controls) {
      seen.add(control.name);
      const expected =
        template.fields.find((field: { id: string }) => field.id === control.name)?.hint ?? '';
      expect(control.hint, control.name).toBe(expected);
    }
  };
  await collect();
  for (const [id, value] of Object.entries({
    applicantType: 'person',
    rightsBasis: 'order',
    registered: 'yes',
    contract: 'yes',
    personalRights: 'yes',
    personalAction: 'distorted',
    physicalCopies: 'yes',
    disputedRights: 'yes',
  })) {
    await paper.locator(`#document-${id}`).selectOption(value);
  }
  for (const moneyType of ['losses', 'fixed', 'copies', 'license']) {
    await paper.locator('#document-moneyType').selectOption(moneyType);
    await collect();
  }
  await collect();
  await expect(paper.locator('[name^="attachment"], [name^="pages"]')).toHaveCount(0);
  const guidance = page.getByRole('complementary', { name: 'Что можно приложить к претензии' });
  await expect(guidance).toContainText('Документы о создании программы и принадлежности прав');
  await expect(guidance).toContainText('Материалы фиксации нарушения');
  await expect(guidance).toContainText('не попадёт в скачанный документ');
  await expect(guidance.locator('input, textarea, select')).toHaveCount(0);
  expect([...seen].sort()).toEqual(template.fields.map((field: { id: string }) => field.id).sort());
  for (const label of ['Телефон', 'Адрес получателя', 'Дата претензии']) {
    await expect(
      paper.getByRole('button', { name: `Подсказка: ${label}`, exact: true }),
    ).toHaveCount(0);
  }
  await paper.getByRole('button', { name: 'Подсказка: БИК', exact: true }).click();
  await expect(paper.getByRole('note', { name: 'Подсказка: БИК', exact: true })).toContainText(
    '9 цифр',
  );
  await expect(paper.getByRole('note', { name: 'Подсказка: БИК', exact: true })).toContainText(
    'Реквизиты счёта',
  );
  await paper.locator('#document-phone').focus();
  await expect(paper.getByRole('note')).toHaveCount(0);
  await expect(paper.locator('#document-phone')).not.toHaveAttribute('aria-describedby');
  await paper
    .getByRole('button', { name: 'Подсказка: Корреспондентский счёт', exact: true })
    .click();
  await expect(
    paper.getByRole('note', { name: 'Подсказка: Корреспондентский счёт', exact: true }),
  ).toContainText('счёт самого банка');
  await paper
    .locator('#document-circumstances')
    .fill('Подробное описание использования кода с датами и обстоятельствами. '.repeat(15));
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      paper
        .locator('#document-circumstances')
        .evaluate((node) => node.scrollHeight <= node.clientHeight + 2),
    )
    .toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('an open constructor refreshes an old template without losing entered values', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  const response = await request.get(`${API_URL}/api/document-templates/code-claim`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
  });
  const current = await response.json();
  expect(current.version).toBe(3);
  expect(current.attachmentGuidance.title).toBe('Что можно приложить к претензии');
  const old = structuredClone(current);
  old.version = 2;
  delete old.attachmentGuidance;
  old.paragraphs.push({ text: 'Приложения', heading: true, sourceParagraph: 57 });
  let updated = false;
  await page.route('**/api/document-templates/code-claim', (route) =>
    route.fulfill({ json: updated ? current : old }),
  );
  await page.goto('/documents/claim/code');
  const paper = page.getByRole('article', { name: 'Заполнение документа' });
  await expect(paper.getByText('Приложения', { exact: true })).toBeVisible();
  await page.locator('#document-recipient').fill('Адресат из незавершённой претензии');
  updated = true;
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await expect(
    page.getByRole('heading', { name: 'Что можно приложить к претензии' }),
  ).toBeVisible();
  await expect(paper.getByText('Приложения', { exact: true })).toHaveCount(0);
  await expect(page.locator('#document-recipient')).toHaveValue(
    'Адресат из незавершённой претензии',
  );
  const guidance = page.getByRole('complementary', { name: 'Что можно приложить к претензии' });
  await guidance.screenshot({ path: '../tmp/preview/claim-attachment-guidance.png' });
});

test('three home actions, overview checklist and updated profile illustration', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await expect(
    page.getByRole('region', { name: 'С чего начать' }).locator(':scope > *'),
  ).toHaveCount(3);
  await expect(page.getByRole('button', { name: /Рассчитать риски/ })).toHaveCount(0);
  await page.getByRole('link', { name: /Оформить права/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Как оформить права на сайт или приложение',
  );
  await expect(page.getByTestId('guide-step')).toHaveCount(5);
  await expect(page.getByRole('checkbox')).toHaveCount(0);
  const download = await request.get(`${API_URL}/api/materials/ownership-overview/file`);
  expect(await download.body()).toEqual(await readFile('../content/files/ownership-overview.docx'));
  await page
    .getByTestId('object-card')
    .getByRole('link', { name: 'Базы данных', exact: true })
    .click();
  await expect(page).toHaveURL('/ownership/databases');
  await page.goto('/login');
  await expect(page.locator('img[src="/images/digital-rights.svg"]')).toBeVisible();
});

test('constructor routes include both document types and honest missing templates', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/');
  await expect(page.locator('header a[href="/profile"]')).toBeVisible();
  await page.getByRole('button', { name: /Конструктор документов/ }).click();
  await page.getByRole('link', { name: /^Договор/ }).click();
  await expect(page.getByRole('main').getByRole('link', { name: /Шаблон готовится/ })).toHaveCount(
    7,
  );
  await page.getByRole('link', { name: /^Базы данных/ }).click();
  await expect(page.getByRole('heading', { name: 'Этот шаблон готовится' })).toBeVisible();
  await page.getByRole('link', { name: 'Открыть претензию по коду' }).click();
  await expect(page.getByLabel('Название для избранного')).toBeVisible();
  await page.getByRole('button', { name: 'Скачать DOCX', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('Проверьте отмеченные поля');
  await expect(page.locator('#document-applicantType')).toBeFocused();
});

test('all constructor routes require login and preserve the destination without requesting templates', async ({
  page,
  request,
}) => {
  const templateRequests: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/document-templates')) templateRequests.push(req.url());
  });
  for (const path of [
    '/documents',
    '/documents/claim',
    '/documents/contract/databases',
    '/documents/saved/00000000-0000-4000-8000-000000000000',
    '/documents/claim/code?from=test#document-preview',
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(`/login?next=${encodeURIComponent(path)}`);
    await expect(page.locator('#document-recipient')).toHaveCount(0);
  }
  expect(templateRequests).toEqual([]);
  const user = await signIn(page, request);
  // Use the real login form, rather than the helper's stored session.
  await page.evaluate(() => localStorage.clear());
  await page.goto('/documents/claim');
  await page.getByLabel('Электронная почта или логин', { exact: true }).fill(user.login);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Войти в профиль', exact: true }).click();
  await expect(page).toHaveURL('/documents/claim');
  await expect(page.getByRole('link', { name: /^Программный код/ })).toBeVisible();
});

test('clear resets hidden values, errors, title and session draft; saved copy changes only after saving', async ({
  page,
  request,
}) => {
  const user = await signIn(page, request);
  await page.goto('/documents/claim/code');
  await fillClaim(page);
  await page.getByLabel('Название для избранного').fill('Моя претензия');
  await page.locator('#document-contract').selectOption('yes');
  await page.locator('#document-contractNumber').fill('SECRET-123');
  await page.locator('#document-contract').selectOption('no');
  await page.locator('#document-moneyType').selectOption('none');
  await page.locator('#document-email').fill('invalid-email');
  await page.getByRole('button', { name: 'Скачать DOCX', exact: true }).first().click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button', { name: 'Очистить форму', exact: true }).first().click();
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(page.locator('#document-recipient')).toHaveValue('');
  await expect(page.locator('#document-title')).not.toHaveValue('Моя претензия');
  await expect(page.locator('#document-applicantType')).toHaveValue('');
  await page.locator('#document-contract').selectOption('yes');
  await expect(page.locator('#document-contractNumber')).toHaveValue('');
  await page.locator('#document-moneyType').selectOption('fixed');
  await expect(page.locator('#document-fixedAmount')).toHaveValue('');
  await page.getByRole('button', { name: 'Очистить форму', exact: true }).last().click();
  await page.reload();
  await expect(page.locator('#document-recipient')).toHaveValue('');
  await expect(page.locator('#document-contract')).toHaveValue('');
  await expect(page.locator('#document-registered')).toHaveValue('no');
  await page.locator('#document-recipient').fill('Сохранённый адресат');
  await page.getByRole('button', { name: 'Сохранить в избранное', exact: true }).first().click();
  await expect(page).toHaveURL(/\/documents\/saved\//);
  const id = new URL(page.url()).pathname.split('/').at(-1);
  await page.getByRole('button', { name: 'Очистить форму', exact: true }).first().click();
  await expect(page.locator('#document-recipient')).toHaveValue('');
  const getSaved = () =>
    request
      .get(`${API_URL}/api/documents/${id}`, {
        headers: { Authorization: `Bearer ${user.accessToken}` },
      })
      .then((response) => response.json());
  expect((await getSaved()).fields.recipient).toBe('Сохранённый адресат');
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Черновик сохранён' })).toBeVisible();
  expect((await getSaved()).fields.recipient ?? '').toBe('');
  await page.reload();
  await expect(page.locator('#document-recipient')).toHaveValue('');
});

test('source article reference opens the published article without losing form data', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/documents/claim/code');
  await page.locator('#document-recipient').fill('Мой адресат');
  const reference = page.getByRole('link', {
    name: /Убытки или компенсация: что требовать при копировании программы/,
  });
  await expect(reference).toHaveAttribute('href', '/articles/code-1');
  const popupEvent = page.waitForEvent('popup');
  await reference.click();
  const article = await popupEvent;
  await expect(article.getByRole('heading', { level: 1 })).toContainText(
    'что требовать при копировании программы',
  );
  await article.close();
  const calculation = page.getByRole('link', {
    name: 'Как рассчитывается компенсация ↗',
    exact: true,
  });
  await expect(calculation).toHaveAttribute('href', '/articles/code-1#compensation-calculation');
  const calculationPopup = page.waitForEvent('popup');
  await calculation.click();
  const calculationArticle = await calculationPopup;
  await expect(calculationArticle.locator('#compensation-calculation')).toHaveText(
    '3. Взыскание компенсации',
  );
  await expect(calculationArticle.locator('#compensation-calculation')).toBeInViewport();
  await calculationArticle.close();
  await expect(page.locator('#document-recipient')).toHaveValue('Мой адресат');
});

test('guest signs up before entering the template, then saves, edits, downloads and removes a document', async ({
  page,
}) => {
  await page.goto('/documents/claim/code');
  await expect(page).toHaveURL(/\/login\?next=/);
  await expect(page.getByLabel('Название для избранного')).toHaveCount(0);
  await expect(
    page.getByText('Чтобы пользоваться конструктором документов', { exact: false }),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Вход и регистрация' })
    .getByRole('link', { name: 'Создать профиль' })
    .click();
  const credentials = newCredentials();
  await page.getByLabel('Логин', { exact: true }).fill(credentials.login);
  await page.getByLabel('Электронная почта', { exact: true }).fill(credentials.email);
  await page.getByLabel('Пароль', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Подтверждение пароля', { exact: true }).fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Создать профиль', exact: true }).click();
  await expect(page).toHaveURL('/documents/claim/code');
  await page.getByLabel('Название для избранного').fill('Претензия по заказам');
  await page.locator('#document-recipient').fill('ООО Адресат');
  await page.getByRole('button', { name: 'Сохранить в избранное', exact: true }).first().click();
  await expect(page).toHaveURL(/\/documents\/saved\/[\w-]+$/);
  await expect(page.locator('#document-recipient')).toHaveValue('ООО Адресат');
  await page.reload();
  await expect(page.getByLabel('Название для избранного')).toHaveValue('Претензия по заказам');
  await fillClaim(page);
  await page.getByRole('button', { name: 'Сохранить изменения', exact: true }).first().click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Документ сохранён в избранном.' }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Скачать DOCX', exact: true }).first().click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe('Претензия — программный код.docx');
  expect((await readFile((await download.path())!)).subarray(0, 2).toString()).toBe('PK');
  await page.getByRole('link', { name: 'В избранные документы →' }).click();
  const favorites = page.getByRole('region', { name: 'Избранные документы' });
  await expect(
    favorites.getByRole('link', { name: 'Претензия по заказам', exact: true }),
  ).toBeVisible();
  await favorites.getByRole('link', { name: 'Претензия по заказам', exact: true }).click();
  await expect(page.locator('#document-fixedAmount')).toHaveValue('45000');
  await page.goto('/documents/claim/code');
  await expect(page.locator('#document-recipient')).toHaveValue('');
  await page.goto('/profile');
  await favorites.getByRole('button', { name: 'Удалить документ: Претензия по заказам' }).click();
  await favorites.getByRole('button', { name: 'Подтвердить удаление' }).click();
  await expect(
    favorites.getByRole('link', { name: 'Претензия по заказам', exact: true }),
  ).toHaveCount(0);
});

test('inline fields replace alternatives; network failures preserve input', async ({
  page,
  request,
}) => {
  await signIn(page, request);
  await page.goto('/documents/claim/code');
  await fillClaim(page);
  const preview = page.getByRole('article', { name: 'Заполнение документа' });
  await expect(preview.locator('#document-fixedAmount')).toHaveValue('45000');
  await expect(page.getByRole('complementary', { name: 'Предпросмотр документа' })).toHaveCount(0);
  await page.locator('#document-moneyType').selectOption('losses');
  await expect(page.locator('#document-fixedAmount')).toHaveCount(0);
  await page.locator('#document-damage').fill('1000.10');
  await page.locator('#document-lostProfit').fill('2000.20');
  await expect(preview).toContainText('3 000,3');
  await expect(preview).not.toContainText('45 000');
  await page.locator('#document-moneyType').selectOption('none');
  await expect(page.locator('#document-account')).toHaveCount(0);
  await expect(preview).not.toContainText('Денежное требование');
  await page.locator('#document-contract').selectOption('yes');
  await expect(page.locator('#document-contractNumber')).toBeVisible();
  await page.locator('#document-contractNumber').fill('123');
  await page.locator('#document-contract').selectOption('no');
  await expect(preview).not.toContainText('Договор № 123');
  await page.route('**/api/documents/*', (route) =>
    route.request().method() === 'PUT' ? route.abort('connectionfailed') : route.continue(),
  );
  await page.getByRole('button', { name: 'Сохранить в избранное', exact: true }).first().click();
  await expect(page.getByRole('alert')).toContainText('Сервер недоступен');
  await expect(page.locator('#document-recipient')).toHaveValue('ООО Конкурент');
  await page.unroute('**/api/documents/*');
  await page.getByRole('button', { name: 'Сохранить в избранное', exact: true }).first().click();
  await expect(page).toHaveURL(/\/documents\/saved\//);
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('#document-recipient')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.screenshot({ path: '../tmp/preview/document-editor-mobile.png', fullPage: true });
});
