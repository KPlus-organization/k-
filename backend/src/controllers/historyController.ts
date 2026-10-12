import type { Request, Response } from 'express';

import { HttpError, type FieldIssue } from '../errors/HttpError';
import { authUserId } from '../middlewares/requireAuth';
import { bodyObject, readString, throwIfIssues } from '../lib/validation';
import { materialExists } from '../services/content';
import { addHistoryEntry, HISTORY_TYPES, listHistory, type HistoryType } from '../services/history';

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;

export async function getHistory(req: Request, res: Response): Promise<void> {
  const rawLimit = req.query['limit'];
  const limit = rawLimit === undefined ? DEFAULT_LIMIT : Number(rawLimit);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [{ field: 'limit', message: `Must be an integer between 1 and ${MAX_LIMIT}` }],
    });
  }
  res.status(200).json({ items: await listHistory(authUserId(req), limit) });
}

export async function postHistory(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const issues: FieldIssue[] = [];

  const type = body['type'];
  if (!HISTORY_TYPES.includes(type as HistoryType)) {
    issues.push({ field: 'type', message: `Must be one of: ${HISTORY_TYPES.join(', ')}` });
  }
  const target = readString(body, 'target', { min: 1, max: 500 }, issues);
  const title = readString(body, 'title', { min: 1, max: 300 }, issues);
  if (type === 'material' && target !== undefined && !(await materialExists(target))) {
    issues.push({ field: 'target', message: 'Material not found' });
  }
  throwIfIssues(issues);

  const entry = await addHistoryEntry(authUserId(req), { type: type as HistoryType, target: target!, title: title! });
  res.status(201).json(entry);
}
