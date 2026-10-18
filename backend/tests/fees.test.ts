import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { env } from '../src/config/env';
import { loadFeeSchedules } from '../src/content/loadFees';
import { api, setupApi } from './helpers';

setupApi();

const tempDirs: string[] = [];
after(() => Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true }))));

/** A copy of content/ with one fees file changed by `edit`. */
async function feesCopy(file: string, edit: (text: string) => string): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'fees-'));
  tempDirs.push(dir);
  await cp(env.contentDir, dir, { recursive: true });
  const target = path.join(dir, 'fees', file);
  await writeFile(target, edit(await readFile(target, 'utf8')));
  return dir;
}

const calc = (schedule: string, fee: string, values: Record<string, unknown>) =>
  api('POST', `/api/fees/${schedule}/calculate`, { body: { fee, values } });

test('GET /api/fees lists schedules in order', async () => {
  const res = await api('GET', '/api/fees');
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.items.map((item: { id: string; feesCount: number }) => [item.id, item.feesCount]),
    [
      ['trademarks', 42],
      ['programs', 4],
    ],
  );
  assert.equal(res.body.items[0].effectiveFrom, '2025-10-04');
  assert.match(res.body.items[1].basis, /статья 333\.30/);
});

test('GET /api/fees/:id returns parameters and the parameters each fee asks for', async () => {
  const res = await api('GET', '/api/fees/trademarks');
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.parameters.map((parameter: { id: string; type: string }) => [parameter.id, parameter.type]),
    [
      ['классы', 'number'],
      ['товары_в_классе', 'perClass'],
      ['бумажное_свидетельство', 'yesNo'],
      ['месяцы_продления', 'number'],
      ['изменения', 'number'],
    ],
  );
  const byCode = (code: string) => res.body.fees.find((fee: { code: string }) => fee.code === code);
  assert.deepEqual(byCode('2.4').parameters, ['классы', 'товары_в_классе']);
  assert.deepEqual(byCode('2.15').parameters, ['бумажное_свидетельство']);
  assert.deepEqual(byCode('2.29').parameters, []);
  assert.match(byCode('2.4').wording, /^Проведение экспертизы обозначения/);
  assert.equal(byCode('2.4').reference, 'подпункт 2.4 приложения № 1 к Положению');
  assert.ok(!('examples' in byCode('2.4')));

  assert.equal((await api('GET', '/api/fees/nope')).status, 404);
  assert.equal((await api('GET', '/api/fees/nope')).body.error.code, 'FEE_SCHEDULE_NOT_FOUND');
});

test('calculation returns the total with a breakdown', async () => {
  const res = await calc('trademarks', '2.4', { классы: 3, товары_в_классе: [15, 10, 4] });
  assert.equal(res.status, 200);
  assert.equal(res.body.total, 20_500);
  assert.deepEqual(res.body.lines, [
    { label: 'Основная пошлина', amount: 13_000 },
    { label: 'За каждый класс МКТУ сверх первого', units: 2, unitAmount: 2500, amount: 5000 },
    { label: 'За каждый товар или услугу сверх десяти в одном классе', units: 5, unitAmount: 500, amount: 2500 },
  ]);
  assert.equal(res.body.fee.code, '2.4');
  assert.equal(res.body.schedule.effectiveFrom, '2025-10-04');

  const programs = await calc('programs', '3', { объекты: 4 });
  assert.equal(programs.body.total, 14_000);
  assert.equal(programs.body.fee.reference, 'подпункт 3 пункта 1 статьи 333.30 НК РФ');
  const fixed = await calc('trademarks', '2.29', {});
  assert.equal(fixed.body.total, 45_000);
  const renewal = await calc('trademarks', '2.22', { классы: 1, товары_в_классе: [3], бумажное_свидетельство: true });
  assert.equal(renewal.body.total, 25_000);
});

test('every control example from content/fees gives its total through the API', async () => {
  const schedules = await loadFeeSchedules(env.contentDir);
  let checked = 0;
  for (const schedule of schedules) {
    for (const fee of schedule.fees) {
      for (const example of fee.examples) {
        const res = await calc(schedule.id, fee.code, example.values);
        assert.equal(res.status, 200, `${schedule.id} ${fee.code}`);
        assert.equal(res.body.total, example.total, `${schedule.id} ${fee.code} ${JSON.stringify(example.values)}`);
        checked++;
      }
    }
  }
  assert.ok(checked >= 28);
});

test('calculation validates the fee code and every value', async () => {
  const fields = async (fee: string, values: Record<string, unknown>) => {
    const res = await calc('trademarks', fee, values);
    assert.equal(res.status, 400);
    assert.equal(res.body.error.code, 'VALIDATION_ERROR');
    return res.body.error.details.map((issue: { field: string }) => issue.field).sort();
  };
  assert.deepEqual(await fields('9.99', {}), ['fee']);
  assert.deepEqual(await fields('2.4', {}), ['values.классы', 'values.товары_в_классе']);
  assert.deepEqual(await fields('2.11', { классы: 46 }), ['values.классы']);
  assert.deepEqual(await fields('2.11', { классы: 2.5 }), ['values.классы']);
  assert.deepEqual(await fields('2.4', { классы: 2, товары_в_классе: [3] }), ['values.товары_в_классе']);
  assert.deepEqual(await fields('2.15', { бумажное_свидетельство: 'да' }), ['values.бумажное_свидетельство']);
  assert.deepEqual(await fields('2.29', { классы: 1 }), ['values.классы']);
  assert.deepEqual(await fields('2.7.1', { месяцы_продления: 7 }), ['values.месяцы_продления']);
  assert.equal((await api('POST', '/api/fees/nope/calculate', { body: { fee: '1', values: {} } })).status, 404);
});

test('mistakes in the YAML files are reported in Russian with their place', async () => {
  const check = async (file: string, edit: (text: string) => string, expected: RegExp[]) => {
    await assert.rejects(loadFeeSchedules(await feesCopy(file, edit)), (err: Error) => {
      for (const pattern of expected) assert.match(err.message, pattern);
      return true;
    });
  };
  await check('trademarks.yaml', (t) => t.replace('сумма: 18 000', 'сумма: 18 ооо'), [
    /trademarks\.yaml, пункт «2\.11»: «сумма» должна быть целым числом рублей, сейчас: «18 ооо» \(буква вместо цифры/,
  ]);
  await check('trademarks.yaml', (t) => t.replace('параметр: классы', 'параметр: класы'), [
    /пункт «2\.1», доплата №1: неизвестный параметр «класы»\. Допустимые: классы,/,
  ]);
  await check('trademarks.yaml', (t) => t.replace('итог: 20 500', 'итог: 20 000'), [
    /пункт «2\.4», пример №2: по формуле получается 20 500 ₽, а в «итог» указано 20 000 ₽/,
  ]);
  await check('trademarks.yaml', (t) => t.replace('название: "Изменение заявки: передача', 'название: Изменение заявки: передача'), [
    /trademarks\.yaml, строка \d+: в тексте есть двоеточие с пробелом/,
  ]);
  await check('programs.yaml', (t) => t.replace('действует_с: 2025-01-01', 'действует_с: 01.01.2025').replace('    сумма: 5 000', '    суммa: 5 000'), [
    /programs\.yaml: «действует_с» — дата в виде ГГГГ-ММ-ДД/,
    /programs\.yaml, пункт «1»: неизвестное поле «суммa»/,
    /programs\.yaml, пункт «1»: не заполнено поле «сумма»/,
  ]);
});
