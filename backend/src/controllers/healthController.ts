import type { Request, Response } from 'express';

import { checkDatabaseConnection } from '../config/db';
import { HttpError } from '../errors/HttpError';

export function getRoot(_req: Request, res: Response): void {
  res.status(200).json({ status: 'ok', message: 'Backend is running' });
}

export async function getHealth(_req: Request, res: Response): Promise<void> {
  res.set('Cache-Control', 'no-store');

  try {
    await checkDatabaseConnection();
  } catch (err) {
    throw new HttpError(503, 'DATABASE_UNAVAILABLE', 'Database is unavailable', { cause: err });
  }

  res.status(200).json({ status: 'ok', database: 'up' });
}
