// Fee calculation: a fee is a base amount plus surcharges of "amount per unit of a
// parameter above a threshold". Pure functions shared by the content loader (to check
// the examples in content/fees) and the API.

export type FeeParameterType = 'number' | 'yesNo' | 'perClass';

export interface FeeParameter {
  id: string;
  question: string;
  type: FeeParameterType;
  /** Bounds for 'number', and for each value of 'perClass'. */
  min?: number;
  max?: number;
}

export interface FeeSurcharge {
  /** What the surcharge is for, e.g. «каждый класс МКТУ сверх первого». */
  label: string;
  parameter: string;
  /** Units up to this value are free. Not used for 'yesNo'. */
  over: number;
  amount: number;
}

export interface FeeExample {
  values: FeeValues;
  total: number;
}

export interface Fee {
  code: string;
  group: string;
  name: string;
  wording: string;
  /** The item online (ConsultantPlus), or null when no link is given. */
  referenceUrl: string | null;
  base: number;
  surcharges: FeeSurcharge[];
  examples: FeeExample[];
}

export interface FeeSchedule {
  id: string;
  title: string;
  order: number;
  basis: string;
  /** The legal act online (ConsultantPlus), or null when no link is given. */
  basisUrl: string | null;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  /** How to cite an item, with {пункт} for its code, e.g. «подпункт {пункт} приложения № 1». */
  reference: string;
  reviewedBy: string | null;
  note: string | null;
  parameters: FeeParameter[];
  fees: Fee[];
}

export function feeReference(schedule: FeeSchedule, fee: Fee): string {
  return schedule.reference.replaceAll('{пункт}', fee.code);
}

export type FeeValue = number | boolean | number[];
export type FeeValues = Record<string, FeeValue>;

export interface FeeLine {
  label: string;
  units?: number;
  unitAmount?: number;
  amount: number;
}

export interface FeeCalculation {
  total: number;
  lines: FeeLine[];
}

/** «Per class» values are entered for each class; their count is this parameter. */
export const CLASS_COUNT_PARAMETER = 'классы';

/** A problem with an input value: Russian text for content authors, English for the API. */
export interface FeeInputIssue {
  field: string;
  ru: string;
  en: string;
}

/** Parameters a fee asks for, in the order of the schedule's parameter list. */
export function feeParameters(schedule: FeeSchedule, fee: Fee): FeeParameter[] {
  const used = new Set(fee.surcharges.map((surcharge) => surcharge.parameter));
  // Values per class need the number of classes even if it has no surcharge of its own.
  if (schedule.parameters.some((p) => used.has(p.id) && p.type === 'perClass')) used.add(CLASS_COUNT_PARAMETER);
  return schedule.parameters.filter((parameter) => used.has(parameter.id));
}

function isWholeNumber(value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/** Checks that `raw` has exactly the values the fee needs, of the right types and ranges. */
export function validateFeeValues(
  schedule: FeeSchedule,
  fee: Fee,
  raw: Record<string, unknown>,
): { values: FeeValues; issues: FeeInputIssue[] } {
  const issues: FeeInputIssue[] = [];
  const values: FeeValues = {};
  const parameters = feeParameters(schedule, fee);

  for (const field of Object.keys(raw)) {
    if (!parameters.some((parameter) => parameter.id === field)) {
      issues.push({ field, ru: `пункт ${fee.code} не использует параметр «${field}»`, en: 'Not used by this fee' });
    }
  }

  for (const parameter of parameters) {
    const value = raw[parameter.id];
    const { id: field } = parameter;
    const min = parameter.min ?? 0;
    const max = parameter.max ?? Number.MAX_SAFE_INTEGER;
    if (value === undefined || value === null) {
      issues.push({ field, ru: `не указан параметр «${field}»`, en: 'Field is required' });
    } else if (parameter.type === 'yesNo') {
      if (typeof value === 'boolean') values[field] = value;
      else issues.push({ field, ru: `«${field}»: нужно «да» или «нет»`, en: 'Must be a boolean' });
    } else if (parameter.type === 'number') {
      if (isWholeNumber(value, min, max)) values[field] = value;
      else issues.push({ field, ru: `«${field}»: нужно целое число от ${min} до ${max}`, en: `Must be an integer between ${min} and ${max}` });
    } else {
      if (Array.isArray(value) && value.every((item) => isWholeNumber(item, min, max))) values[field] = value as number[];
      else issues.push({ field, ru: `«${field}»: нужен список целых чисел от ${min} до ${max}`, en: `Must be an array of integers between ${min} and ${max}` });
    }
  }

  // One value per class.
  const classes = values[CLASS_COUNT_PARAMETER];
  for (const parameter of parameters) {
    const list = values[parameter.id];
    if (parameter.type === 'perClass' && Array.isArray(list) && typeof classes === 'number' && list.length !== classes) {
      issues.push({
        field: parameter.id,
        ru: `«${parameter.id}»: нужно ${classes} знач. — по одному на каждый класс, указано ${list.length}`,
        en: `Must contain one value per class (${classes})`,
      });
    }
  }
  return { values, issues };
}

/** Total and its breakdown. `values` must have passed validateFeeValues. */
export function calculateFee(schedule: FeeSchedule, fee: Fee, values: FeeValues): FeeCalculation {
  const lines: FeeLine[] = [];
  if (fee.base > 0) lines.push({ label: 'Основная пошлина', amount: fee.base });

  for (const surcharge of fee.surcharges) {
    const parameter = schedule.parameters.find((p) => p.id === surcharge.parameter)!;
    const value = values[surcharge.parameter];
    const units =
      parameter.type === 'yesNo'
        ? value === true
          ? 1
          : 0
        : parameter.type === 'perClass'
          ? (value as number[]).reduce((sum, item) => sum + Math.max(0, item - surcharge.over), 0)
          : Math.max(0, (value as number) - surcharge.over);
    if (units > 0) {
      lines.push({
        // Labels in content/fees continue the word «за»: «каждый класс МКТУ сверх первого».
        label: `За ${surcharge.label}`,
        units,
        unitAmount: surcharge.amount,
        amount: units * surcharge.amount,
      });
    }
  }
  return { total: lines.reduce((sum, line) => sum + line.amount, 0), lines };
}
