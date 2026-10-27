import { pool } from '../config/db';
import { HttpError } from '../errors/HttpError';
import {
  calculateFee,
  feeParameters,
  feeReference,
  validateFeeValues,
  type Fee,
  type FeeLine,
  type FeeParameter,
  type FeeSchedule,
  type FeeSurcharge,
} from '../lib/fees';

export interface FeeScheduleSummary {
  id: string;
  title: string;
  basis: string;
  /** The legal act online (ConsultantPlus), or null. */
  basisUrl: string | null;
  effectiveFrom: string;
  reviewedBy: string | null;
  feesCount: number;
}

/** A fee as returned by the API: control examples are internal and left out. */
export interface PublicFee {
  code: string;
  /** How to cite the item, e.g. «подпункт 2.4 приложения № 1 к Положению». */
  reference: string;
  /** The item online (ConsultantPlus), or null. */
  referenceUrl: string | null;
  group: string;
  name: string;
  wording: string;
  base: number;
  surcharges: FeeSurcharge[];
  /** Ids of the parameters the user must fill in, in display order. */
  parameters: string[];
}

export interface PublicFeeSchedule extends FeeScheduleSummary {
  note: string | null;
  parameters: FeeParameter[];
  fees: PublicFee[];
}

export interface FeeResult {
  schedule: {
    id: string;
    title: string;
    basis: string;
    basisUrl: string | null;
    effectiveFrom: string;
    reviewedBy: string | null;
  };
  fee: { code: string; reference: string; referenceUrl: string | null; name: string; wording: string };
  total: number;
  lines: FeeLine[];
}

interface ScheduleRow {
  id: string;
  title: string;
  basis: string;
  basis_url: string | null;
  effective_from: string;
  reference: string;
  reviewed_by: string | null;
  note: string | null;
  parameters: FeeParameter[];
  fees: Fee[];
  sort_order: number;
}

// effective_from is a date: format it in SQL so that no time zone shifts it.
const COLUMNS = `id, title, basis, basis_url, to_char(effective_from, 'YYYY-MM-DD') AS effective_from, reference,
  reviewed_by, note, parameters, fees, sort_order`;

function toSchedule(row: ScheduleRow): FeeSchedule {
  return {
    id: row.id,
    title: row.title,
    order: row.sort_order,
    basis: row.basis,
    basisUrl: row.basis_url,
    effectiveFrom: row.effective_from,
    reference: row.reference,
    reviewedBy: row.reviewed_by,
    note: row.note,
    parameters: row.parameters,
    // Fees synced before links were added have no referenceUrl.
    fees: row.fees.map((fee) => ({ ...fee, referenceUrl: fee.referenceUrl ?? null })),
  };
}

function summary(schedule: FeeSchedule): FeeScheduleSummary {
  return {
    id: schedule.id,
    title: schedule.title,
    basis: schedule.basis,
    basisUrl: schedule.basisUrl,
    effectiveFrom: schedule.effectiveFrom,
    reviewedBy: schedule.reviewedBy,
    feesCount: schedule.fees.length,
  };
}

async function loadSchedule(id: string): Promise<FeeSchedule> {
  const { rows } = await pool.query<ScheduleRow>(
    `SELECT ${COLUMNS} FROM fee_schedules WHERE id = $1 AND is_published`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'FEE_SCHEDULE_NOT_FOUND', 'Fee schedule not found');
  return toSchedule(row);
}

export async function listFeeSchedules(): Promise<FeeScheduleSummary[]> {
  const { rows } = await pool.query<ScheduleRow>(
    `SELECT ${COLUMNS} FROM fee_schedules WHERE is_published ORDER BY sort_order, id`,
  );
  return rows.map((row) => summary(toSchedule(row)));
}

export async function getFeeSchedule(id: string): Promise<PublicFeeSchedule> {
  const schedule = await loadSchedule(id);
  return {
    ...summary(schedule),
    note: schedule.note,
    parameters: schedule.parameters,
    fees: schedule.fees.map((fee) => ({
      code: fee.code,
      reference: feeReference(schedule, fee),
      referenceUrl: fee.referenceUrl,
      group: fee.group,
      name: fee.name,
      wording: fee.wording,
      base: fee.base,
      surcharges: fee.surcharges,
      parameters: feeParameters(schedule, fee).map((parameter) => parameter.id),
    })),
  };
}

export async function calculate(scheduleId: string, code: unknown, rawValues: unknown): Promise<FeeResult> {
  const schedule = await loadSchedule(scheduleId);
  const fee = schedule.fees.find((item) => item.code === code);
  if (!fee) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [{ field: 'fee', message: 'Unknown fee code for this schedule' }],
    });
  }
  if (typeof rawValues !== 'object' || rawValues === null || Array.isArray(rawValues)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [{ field: 'values', message: 'Must be an object of parameter values' }],
    });
  }

  const { values, issues } = validateFeeValues(schedule, fee, rawValues as Record<string, unknown>);
  if (issues.length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: issues.map((issue) => ({ field: `values.${issue.field}`, message: issue.en })),
    });
  }

  const { total, lines } = calculateFee(schedule, fee, values);
  return {
    schedule: {
      id: schedule.id,
      title: schedule.title,
      basis: schedule.basis,
      basisUrl: schedule.basisUrl,
      effectiveFrom: schedule.effectiveFrom,
      reviewedBy: schedule.reviewedBy,
    },
    fee: {
      code: fee.code,
      reference: feeReference(schedule, fee),
      referenceUrl: fee.referenceUrl,
      name: fee.name,
      wording: fee.wording,
    },
    total,
    lines,
  };
}
