import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { parse, YAMLParseError } from 'yaml';

import {
  calculateFee,
  CLASS_COUNT_PARAMETER,
  validateFeeValues,
  type Fee,
  type FeeParameter,
  type FeeParameterType,
  type FeeSchedule,
  type FeeSurcharge,
} from '../lib/fees';
import { isWebLink } from '../lib/webLinks';

// Reads content/fees/*.yaml. The files are edited by lawyers, so every message here
// is in Russian and points to the file and the item.

const PARAMETER_TYPES: Record<string, FeeParameterType> = {
  число: 'number',
  да_нет: 'yesNo',
  по_классам: 'perClass',
};
const SCHEDULE_KEYS = [
  'название',
  'порядок',
  'основание',
  'ссылка_на_основание',
  'действует_с',
  'ссылка_на_пункт',
  'проверил',
  'примечание',
  'параметры',
  'пошлины',
];
const PARAMETER_KEYS = ['вопрос', 'тип', 'от', 'до'];
const FEE_KEYS = ['пункт', 'раздел', 'название', 'формулировка', 'ссылка', 'сумма', 'доплаты', 'примеры'];
const SURCHARGE_KEYS = ['за', 'параметр', 'сверх', 'сумма'];

type Raw = Record<string, unknown>;

function isObject(value: unknown): value is Raw {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string | undefined {
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
}

class Problems {
  readonly list: string[] = [];
  add(where: string, message: string) {
    this.list.push(`${where}: ${message}`);
  }
  unknownKeys(where: string, raw: Raw, allowed: string[]) {
    for (const key of Object.keys(raw)) {
      if (!allowed.includes(key)) this.add(where, `неизвестное поле «${key}». Допустимые: ${allowed.join(', ')}`);
    }
  }
}

/** A sum in rubles: 18000 or "18 000". Reports letters that look like digits. */
function money(value: unknown, where: string, field: string, problems: Problems): number | undefined {
  if (value === undefined || value === null || value === '') {
    problems.add(where, `не заполнено поле «${field}»`);
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  if (typeof value === 'string' && /^\d{1,3}(?:[  ]?\d{3})*$/.test(value.trim())) {
    return Number(value.replace(/[  ]/g, ''));
  }
  const hint =
    typeof value === 'string' && /[оОoOзЗlбБ]/.test(value) ? ' (буква вместо цифры? например «о» вместо нуля)' : '';
  problems.add(where, `«${field}» должна быть целым числом рублей, сейчас: «${String(value ?? '')}»${hint}`);
  return undefined;
}

function wholeNumber(value: unknown, where: string, field: string, problems: Problems): number | undefined {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0) return value;
  problems.add(where, `«${field}» должно быть целым числом, сейчас: «${String(value ?? '')}»`);
  return undefined;
}

function parameters(raw: unknown, file: string, problems: Problems): FeeParameter[] {
  if (raw === undefined) return [];
  if (!isObject(raw)) {
    problems.add(file, '«параметры» должны быть списком вида «имя: { вопрос, тип, … }»');
    return [];
  }
  const result: FeeParameter[] = [];
  for (const [id, value] of Object.entries(raw)) {
    const where = `${file}, параметр «${id}»`;
    if (!isObject(value)) {
      problems.add(where, 'нужны поля «вопрос» и «тип»');
      continue;
    }
    problems.unknownKeys(where, value, PARAMETER_KEYS);
    const question = text(value['вопрос']);
    if (!question) problems.add(where, 'не заполнен «вопрос»');
    const type = PARAMETER_TYPES[String(value['тип'])];
    if (!type) problems.add(where, `«тип» должен быть одним из: ${Object.keys(PARAMETER_TYPES).join(', ')}`);
    const parameter: FeeParameter = { id, question: question ?? id, type: type ?? 'number' };
    if (type === 'number' || type === 'perClass') {
      parameter.min = wholeNumber(value['от'], where, 'от', problems);
      parameter.max = wholeNumber(value['до'], where, 'до', problems);
      if (parameter.min !== undefined && parameter.max !== undefined && parameter.min > parameter.max) {
        problems.add(where, '«от» больше, чем «до»');
      }
    }
    if (type === 'perClass' && !(CLASS_COUNT_PARAMETER in raw)) {
      problems.add(where, `для типа «по_классам» нужен параметр «${CLASS_COUNT_PARAMETER}» — сколько значений вводить`);
    }
    result.push(parameter);
  }
  return result;
}

function surcharges(raw: unknown, where: string, params: FeeParameter[], problems: Problems): FeeSurcharge[] {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) {
    problems.add(where, '«доплаты» должны быть списком, каждая доплата начинается с «- за:»');
    return [];
  }
  return raw.flatMap((item, index) => {
    const at = `${where}, доплата №${index + 1}`;
    if (!isObject(item)) {
      problems.add(at, 'нужны поля «за», «параметр», «сумма»');
      return [];
    }
    problems.unknownKeys(at, item, SURCHARGE_KEYS);
    const label = text(item['за']);
    if (!label) problems.add(at, 'не заполнено «за» — за что доплата');
    const parameterId = String(item['параметр'] ?? '');
    const parameter = params.find((p) => p.id === parameterId);
    if (!parameter) {
      problems.add(at, `неизвестный параметр «${parameterId}». Допустимые: ${params.map((p) => p.id).join(', ')}`);
    }
    if (parameter?.type === 'yesNo' && item['сверх'] !== undefined) {
      problems.add(at, '«сверх» не используется для параметров «да_нет»');
    }
    const over = item['сверх'] === undefined ? 0 : wholeNumber(item['сверх'], at, 'сверх', problems);
    const amount = money(item['сумма'], at, 'сумма', problems);
    if (amount === 0) problems.add(at, '«сумма» доплаты должна быть больше нуля');
    return [{ label: label ?? '', parameter: parameterId, over: over ?? 0, amount: amount ?? 0 }];
  });
}

/** Example values as written in YAML: "да"/"нет" for yes/no parameters. */
function exampleValues(raw: Raw, params: FeeParameter[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (key === 'итог') continue;
    const parameter = params.find((p) => p.id === key);
    values[key] = parameter?.type === 'yesNo' && (value === 'да' || value === 'нет') ? value === 'да' : value;
  }
  return values;
}

/** An optional link to a legal act: an http(s) address. */
function legalLink(value: unknown, where: string, field: string, problems: Problems): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (isWebLink(value)) return value;
  problems.add(where, `«${field}» — адрес страницы, начинается с https://; сейчас: «${String(value)}»`);
  return null;
}

function formatRubles(amount: number) {
  return `${amount.toLocaleString('ru-RU').replace(/ /g, ' ')} ₽`;
}

function scheduleFrom(id: string, file: string, raw: unknown): { schedule?: FeeSchedule; problems: string[] } {
  const problems = new Problems();
  if (!isObject(raw)) return { problems: [`${file}: файл должен начинаться с полей «название», «основание», …`] };
  problems.unknownKeys(file, raw, SCHEDULE_KEYS);

  const title = text(raw['название']);
  if (!title) problems.add(file, 'не заполнено «название»');
  const basis = text(raw['основание']);
  if (!basis) problems.add(file, 'не заполнено «основание» — нормативный акт, из которого взяты суммы');
  const basisUrl = legalLink(raw['ссылка_на_основание'], file, 'ссылка_на_основание', problems);
  const effectiveFrom = text(raw['действует_с']);
  if (!effectiveFrom || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom) || Number.isNaN(Date.parse(effectiveFrom))) {
    problems.add(file, `«действует_с» — дата в виде ГГГГ-ММ-ДД, например 2025-10-04; сейчас: «${effectiveFrom ?? ''}»`);
  }
  const reference = text(raw['ссылка_на_пункт']) ?? 'пункт {пункт}';
  if (!reference.includes('{пункт}')) {
    problems.add(file, '«ссылка_на_пункт» должна содержать {пункт} — туда подставится номер, например: подпункт {пункт} приложения № 1');
  }
  const order = raw['порядок'] === undefined ? 100 : wholeNumber(raw['порядок'], file, 'порядок', problems);

  const params = parameters(raw['параметры'], file, problems);
  const rawFees = raw['пошлины'];
  const fees: Fee[] = [];
  if (!Array.isArray(rawFees) || rawFees.length === 0) {
    problems.add(file, '«пошлины» должны быть непустым списком, каждая пошлина начинается с «- пункт:»');
  } else {
    const codes = new Set<string>();
    rawFees.forEach((item, index) => {
      if (!isObject(item)) {
        problems.add(`${file}, пошлина №${index + 1}`, 'ожидается пошлина с полями «пункт», «название», «сумма», …');
        return;
      }
      const code = text(item['пункт']);
      const where = `${file}, пункт «${code ?? `№${index + 1}`}»`;
      problems.unknownKeys(where, item, FEE_KEYS);
      if (!code) problems.add(where, 'не заполнен «пункт»');
      else if (codes.has(code)) problems.add(where, 'такой «пункт» уже есть в файле');
      if (code) codes.add(code);

      const fee: Fee = {
        code: code ?? '',
        group: text(item['раздел']) ?? '',
        name: text(item['название']) ?? '',
        wording: text(item['формулировка']) ?? '',
        referenceUrl: legalLink(item['ссылка'], where, 'ссылка', problems),
        base: money(item['сумма'], where, 'сумма', problems) ?? 0,
        surcharges: surcharges(item['доплаты'], where, params, problems),
        examples: [],
      };
      if (!fee.group) problems.add(where, 'не заполнен «раздел»');
      if (!fee.name) problems.add(where, 'не заполнено «название»');
      if (!fee.wording) problems.add(where, 'не заполнена «формулировка» — текст пункта из нормативного акта');

      const rawExamples = item['примеры'];
      if (rawExamples !== undefined && !Array.isArray(rawExamples)) problems.add(where, '«примеры» должны быть списком');
      (Array.isArray(rawExamples) ? rawExamples : []).forEach((example, n) => {
        const at = `${where}, пример №${n + 1}`;
        if (!isObject(example)) {
          problems.add(at, 'пример записывается так: { классы: 3, итог: 6 000 }');
          return;
        }
        const total = money(example['итог'], at, 'итог', problems);
        fee.examples.push({ values: exampleValues(example, params) as never, total: total ?? 0 });
      });
      fees.push(fee);
    });
  }

  if (problems.list.length > 0) return { problems: problems.list };

  const schedule: FeeSchedule = {
    id,
    title: title!,
    order: order ?? 100,
    basis: basis!,
    basisUrl,
    effectiveFrom: effectiveFrom!,
    reference,
    reviewedBy: text(raw['проверил']) ?? null,
    note: text(raw['примечание']) ?? null,
    parameters: params,
    fees,
  };

  // Control examples: the formula must give exactly the stated total.
  for (const fee of fees) {
    fee.examples.forEach((example, n) => {
      const at = `${file}, пункт «${fee.code}», пример №${n + 1}`;
      const { values, issues } = validateFeeValues(schedule, fee, example.values as Record<string, unknown>);
      for (const issue of issues) problems.add(at, issue.ru);
      if (issues.length > 0) return;
      example.values = values;
      const { total } = calculateFee(schedule, fee, values);
      if (total !== example.total) {
        problems.add(at, `по формуле получается ${formatRubles(total)}, а в «итог» указано ${formatRubles(example.total)}`);
      }
    });
  }
  return problems.list.length > 0 ? { problems: problems.list } : { schedule, problems: [] };
}

function describeYamlError(file: string, error: YAMLParseError): string {
  const line = error.linePos?.[0]?.line;
  const at = line ? `${file}, строка ${line}` : file;
  if (error.code === 'BLOCK_AS_IMPLICIT_KEY' || error.code === 'MULTILINE_IMPLICIT_KEY') {
    return `${at}: в тексте есть двоеточие с пробелом («: »). Заключите весь текст после имени поля в кавычки, например: название: "Изменение заявки: передача права"`;
  }
  if (error.code === 'BAD_INDENT' || error.code === 'MISSING_CHAR') {
    return `${at}: нарушены отступы. Поля одной пошлины должны начинаться с одинакового количества пробелов`;
  }
  if (error.code === 'TAB_AS_INDENT') return `${at}: для отступов используются пробелы, а не табуляция`;
  if (error.code === 'DUPLICATE_KEY') return `${at}: одно и то же поле указано дважды`;
  return `${at}: файл не удалось прочитать (${error.code}). Проверьте отступы и кавычки в этом месте`;
}

/**
 * Reads and checks every content/fees/*.yaml. The schedule id is the file name.
 * Throws one error listing all problems in all files.
 */
export async function loadFeeSchedules(contentDir: string): Promise<FeeSchedule[]> {
  const dir = path.join(contentDir, 'fees');
  const files = (await readdir(dir).catch(() => [] as string[])).filter((name) => name.endsWith('.yaml')).sort();
  const schedules: FeeSchedule[] = [];
  const problems: string[] = [];

  for (const name of files) {
    const file = `content/fees/${name}`;
    const id = name.replace(/\.yaml$/, '');
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) {
      problems.push(`${file}: имя файла — латиница в нижнем регистре, цифры и «-», например trademarks.yaml`);
      continue;
    }
    let raw: unknown;
    try {
      raw = parse(await readFile(path.join(dir, name), 'utf8'));
    } catch (error) {
      problems.push(error instanceof YAMLParseError ? describeYamlError(file, error) : `${file}: ${String(error)}`);
      continue;
    }
    const result = scheduleFrom(id, file, raw);
    problems.push(...result.problems);
    if (result.schedule) schedules.push(result.schedule);
  }

  if (problems.length > 0) {
    throw new Error(`Ошибки в файлах пошлин:\n  - ${problems.join('\n  - ')}`);
  }
  return schedules.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}
