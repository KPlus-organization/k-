import { test, expect } from '@playwright/test';

test('step by step: trademark examination fee with classes and goods per class', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Калькулятор госпошлины/ }).click();
  await expect(page).toHaveURL(/\/tools\/calculator$/);
  await expect(page.getByRole('heading', { name: 'Калькулятор пошлин', level: 1 })).toBeVisible();

  const step1 = page.getByRole('region', { name: 'Шаг 1. Для чего нужна пошлина?' });
  await expect(
    step1.getByRole('button', {
      name: /Товарные знаки Название, логотип, знак обслуживания · 42 вида пошлин/,
    }),
  ).toBeVisible();
  await step1.getByRole('button', { name: /Товарные знаки/ }).click();

  // The next step takes focus, so keyboard users continue from there.
  await expect(page.getByRole('heading', { name: 'Шаг 2. Выберите раздел' })).toBeFocused();
  await page.getByRole('button', { name: /Подача заявки и экспертиза/ }).click();
  await page.getByRole('button', { name: /Экспертиза обозначения, заявленного/ }).click();
  await expect(page).toHaveURL(/schedule=trademarks.*fee=2\.4/);

  const step4 = page.getByRole('region', { name: 'Шаг 4. Укажите параметры' });
  await expect(step4).toContainText(
    'Как считается: 13 000 ₽ + 2 500 ₽ за каждый класс МКТУ сверх первого + 500 ₽ за каждый товар или услугу сверх десяти в одном классе.',
  );
  await step4.getByLabel('Количество классов МКТУ').selectOption('3');
  await expect(step4.getByRole('spinbutton')).toHaveCount(3);
  await step4.getByLabel('Класс 1').fill('15');
  await step4.getByLabel('Класс 2').fill('10');
  await step4.getByLabel('Класс 3').fill('4');
  await step4.getByRole('button', { name: 'Рассчитать' }).click();

  const result = page.getByRole('region', { name: '20 500 ₽' });
  await expect(result.getByRole('heading', { name: '20 500 ₽' })).toBeFocused();
  await expect(
    result.getByRole('row', { name: /За каждый класс МКТУ сверх первого/ }),
  ).toContainText('2 × 2 500 ₽');
  await expect(result).toContainText('Основание: подпункт 2.4 приложения № 1 к Положению');
  await expect(result).toContainText('Действует с 04.10.2025');

  // «Изменить выбор» returns to the list of actions; the browser's Back goes one step back.
  const step3 = page.getByRole('region', { name: 'Шаг 3. Выберите действие' });
  await step3.getByRole('button', { name: 'Изменить выбор' }).click();
  await expect(step3.getByRole('button', { name: /Подача заявки на товарный знак/ })).toBeVisible();
  await expect(page.getByRole('region', { name: /Шаг 4/ })).toHaveCount(0);
  await page.goBack();
  await expect(page.getByRole('region', { name: 'Шаг 4. Укажите параметры' })).toBeVisible();
});

test('calculator checks values in Russian before calculating', async ({ page }) => {
  await page.goto('/tools/calculator?schedule=trademarks&fee=2.4');
  const alert = page.getByRole('alert');
  await page.getByLabel('Класс 1').fill('0');
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(alert).toHaveText('Товары и услуги в классе 1: не меньше 1.');
  await expect(page.getByLabel('Класс 1')).toBeFocused();

  await page.goto('/tools/calculator?schedule=programs&fee=2');
  const objects = page.getByLabel('Количество программ для ЭВМ и баз данных', { exact: true });
  await objects.fill('');
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(alert).toHaveText('Заполните поле «Количество программ для ЭВМ и баз данных».');
  await objects.fill('1001');
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(alert).toHaveText('Количество программ для ЭВМ и баз данных: не больше 1000.');
});

test('programs and databases: buttons change the number of programs', async ({ page }) => {
  await page.goto('/tools/calculator');
  await page.getByRole('button', { name: /Программы для ЭВМ и базы данных/ }).click();
  await page.getByRole('button', { name: /Распоряжение исключительным правом/ }).click();
  await page.getByRole('button', { name: /Регистрация отчуждения или залога/ }).click();

  const objects = page.getByLabel('Количество программ для ЭВМ и баз данных', { exact: true });
  await expect(objects).toHaveValue('1');
  await expect(page.getByRole('button', { name: /^Уменьшить/ })).toBeDisabled();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /^Увеличить/ }).click();
  await expect(objects).toHaveValue('4');
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  const result = page.getByRole('region', { name: '14 000 ₽' });
  await expect(result).toContainText('подпункт 3 пункта 1 статьи 333.30 НК РФ');

  // A fee that depends only on the chosen action is shown at once: no parameters, no button.
  await page.goto('/tools/calculator?schedule=programs&group=Регистрация');
  await page.getByRole('button', { name: /Регистрация программы для ЭВМ или базы данных/ }).click();
  const fixed = page.getByRole('region', { name: '5 000 ₽' });
  await expect(fixed.getByRole('heading', { name: '5 000 ₽' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Рассчитать' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /Шаг 4/ })).toHaveCount(0);
  await expect(fixed.getByRole('table')).toHaveCount(0);
  await expect(fixed).toContainText('Основание: подпункт 1 пункта 1 статьи 333.30 НК РФ');
  await fixed.getByText('Текст нормы: подпункт 1 пункта 1 статьи 333.30 НК РФ').click();
  await expect(
    fixed.getByText(/^за рассмотрение заявки на государственную регистрацию/),
  ).toBeVisible();
});

test('fixed trademark fees appear right after choosing the action', async ({ page }) => {
  await page.goto('/tools/calculator?schedule=trademarks');
  await page.getByRole('button', { name: /Общеизвестные знаки и прекращение охраны/ }).click();
  await page.getByRole('button', { name: /Признание товарного знака общеизвестным/ }).click();
  await expect(page.getByRole('region', { name: '45 000 ₽' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Рассчитать' })).toHaveCount(0);

  // Choosing another action replaces the result.
  const step3 = page.getByRole('region', { name: 'Шаг 3. Выберите действие' });
  await step3.getByRole('button', { name: 'Изменить выбор' }).click();
  await expect(page.getByRole('region', { name: '45 000 ₽' })).toHaveCount(0);
  await step3.getByRole('button', { name: /Публикация решения суда/ }).click();
  await expect(page.getByRole('region', { name: '4 000 ₽' })).toBeVisible();
});

test('calculator screenshots', async ({ page }) => {
  await page.goto('/tools/calculator');
  await page.screenshot({ path: '../tmp/preview/calculator-start.png', fullPage: true });
  await page.goto('/tools/calculator?schedule=trademarks&fee=2.22');
  await page.getByLabel('Количество классов МКТУ').selectOption('7');
  await page.getByLabel('Класс 1').fill('14');
  await page.getByRole('checkbox', { name: 'Нужно свидетельство на бумаге' }).check();
  await page.getByRole('button', { name: 'Рассчитать' }).click();
  await expect(page.getByRole('region', { name: '31 000 ₽' })).toBeVisible();
  await page.screenshot({ path: '../tmp/preview/calculator.png', fullPage: true });
});
