import type { Request, Response } from 'express';

import { HttpError, type FieldIssue } from '../errors/HttpError';
import { authUserId } from '../middlewares/requireAuth';
import { bodyObject, EMAIL_RULE, LOGIN_RULE, NAME_RULE, readString, throwIfIssues } from '../lib/validation';
import { getUserById, updateUser, withdrawConsent } from '../services/users';

const EDITABLE_FIELDS = { name: NAME_RULE, login: LOGIN_RULE, email: EMAIL_RULE } as const;
type EditableField = keyof typeof EDITABLE_FIELDS;

export async function getProfile(req: Request, res: Response): Promise<void> {
  res.status(200).json({ user: await getUserById(authUserId(req)) });
}

export async function updateProfile(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const issues: FieldIssue[] = [];
  const changes: Partial<Record<EditableField, string>> = {};

  for (const field of Object.keys(body)) {
    if (!(field in EDITABLE_FIELDS)) {
      issues.push({ field, message: 'Field cannot be changed' });
    }
  }
  for (const [field, rule] of Object.entries(EDITABLE_FIELDS) as [EditableField, (typeof EDITABLE_FIELDS)[EditableField]][]) {
    if (body[field] !== undefined) {
      changes[field] = readString(body, field, rule, issues);
    }
  }
  throwIfIssues(issues);
  if (Object.keys(changes).length === 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'At least one of name, login, email must be provided');
  }

  res.status(200).json({ user: await updateUser(authUserId(req), changes) });
}

export async function withdrawProfileConsent(req: Request, res: Response): Promise<void> {
  await withdrawConsent(authUserId(req));
  res.status(204).end();
}
