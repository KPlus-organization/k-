// Types of the fee calculator API; see docs/api.md, «Калькулятор пошлин».

export type FeeParameter = {
  id: string;
  question: string;
  type: 'number' | 'yesNo' | 'perClass';
  min?: number;
  max?: number;
};

export type FeeSurcharge = { label: string; parameter: string; over: number; amount: number };

export type Fee = {
  code: string;
  /** How to cite the item, e.g. «подпункт 2.4 приложения № 1 к Положению». */
  reference: string;
  group: string;
  name: string;
  wording: string;
  base: number;
  surcharges: FeeSurcharge[];
  /** Ids of the parameters to fill in, in display order. */
  parameters: string[];
};

export type FeeScheduleSummary = {
  id: string;
  title: string;
  basis: string;
  /** YYYY-MM-DD */
  effectiveFrom: string;
  reviewedBy: string | null;
  feesCount: number;
};

export type FeeSchedule = FeeScheduleSummary & {
  note: string | null;
  parameters: FeeParameter[];
  fees: Fee[];
};

export type FeeValues = Record<string, number | boolean | number[]>;

export type FeeLine = { label: string; units?: number; unitAmount?: number; amount: number };

export type FeeResult = {
  schedule: Pick<FeeScheduleSummary, 'id' | 'title' | 'basis' | 'effectiveFrom' | 'reviewedBy'>;
  fee: Pick<Fee, 'code' | 'reference' | 'name' | 'wording'>;
  total: number;
  lines: FeeLine[];
};

/** The parameter whose value sets how many «per class» values are entered. */
export const CLASS_COUNT_PARAMETER = 'классы';

const rubles = new Intl.NumberFormat('ru-RU');

export function formatRubles(amount: number) {
  return `${rubles.format(amount)} ₽`;
}

/** 2025-10-04 → 04.10.2025 without time zone shifts. */
export function formatDate(isoDate: string) {
  const [year, month, day] = isoDate.split('-');
  return `${day}.${month}.${year}`;
}
