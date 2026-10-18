import type { Request, Response } from 'express';

import { bodyObject } from '../lib/validation';
import { calculate, getFeeSchedule, listFeeSchedules } from '../services/fees';

export async function getFeeSchedules(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ items: await listFeeSchedules() });
}

export async function getFeeScheduleById(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.status(200).json(await getFeeSchedule(req.params.id));
}

export async function calculateFee(req: Request<{ id: string }>, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  res.status(200).json(await calculate(req.params.id, body['fee'], body['values'] ?? {}));
}
