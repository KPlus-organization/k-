import { Router } from 'express';
import type { NextFunction, Request, Response } from 'express';

import { HttpError, type FieldIssue } from '../errors/HttpError';
import { bodyObject, readString, throwIfIssues } from '../lib/validation';
import { requireAuth } from '../middlewares/requireAuth';
import { listQuestions, recordMaterialView } from '../services/questions';

export const questionsRoutes = Router();

async function optionalAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  res.set('Cache-Control', 'no-store');
  if (req.get('Authorization')) await requireAuth(req, res, next);
  else next();
}

questionsRoutes.get('/questions', optionalAuth, async (req, res) => {
  const rawLimit = req.query['limit'];
  const limit = rawLimit === undefined ? 8 : Number(rawLimit);
  const rawOffset = req.query['offset'];
  const offset = rawOffset === undefined ? 0 : Number(rawOffset);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100 || !Number.isInteger(offset) || offset < 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid pagination');
  }
  // order=popular ranks by openings only, the same for everyone (e.g. the site menu).
  const order = req.query['order'];
  if (order !== undefined && order !== 'popular') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Invalid order');
  }
  const result = await listQuestions(order === 'popular' ? undefined : req.userId);
  res.json({ ...result, total: result.items.length, items: result.items.slice(offset, offset + limit) });
});

questionsRoutes.post('/materials/:id/view', optionalAuth, async (req, res) => {
  const body = bodyObject(req.body);
  const issues: FieldIssue[] = [];
  const visitorId = readString(
    body,
    'visitorId',
    {
      min: 36,
      max: 36,
      pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i,
    },
    issues,
  );
  throwIfIssues(issues);
  await recordMaterialView(String(req.params['id']), visitorId!, req.userId);
  res.status(204).end();
});
