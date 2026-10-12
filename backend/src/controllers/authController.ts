import type { Request, Response } from 'express';

import type { FieldIssue } from '../errors/HttpError';
import {
  bodyObject,
  EMAIL_RULE,
  LOGIN_RULE,
  PASSWORD_RULE,
  readString,
  throwIfIssues,
  type Fields,
} from '../lib/validation';
import * as auth from '../services/auth';

// Any non-empty value up to the longest possible login or email.
const IDENTIFIER_RULE = { min: 1, max: EMAIL_RULE.max };
const REFRESH_TOKEN_RULE = { min: 1, max: 200 };

export async function register(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const issues: FieldIssue[] = [];
  const login = readString(body, 'login', LOGIN_RULE, issues);
  const email = readString(body, 'email', EMAIL_RULE, issues);
  const password = readString(body, 'password', PASSWORD_RULE, issues);
  if (body['consent'] !== true) {
    issues.push({ field: 'consent', message: 'Consent to personal data processing is required' });
  }
  throwIfIssues(issues);

  const session = await auth.register({ login: login!, email: email!, password: password! });
  res.status(201).json(session);
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = bodyObject(req.body);
  const issues: FieldIssue[] = [];
  const identifier = readString(body, 'identifier', IDENTIFIER_RULE, issues);
  const password = readString(body, 'password', { min: 1, max: PASSWORD_RULE.max, trim: false }, issues);
  throwIfIssues(issues);

  res.status(200).json(await auth.login(identifier!, password!));
}

function readRefreshToken(body: Fields): string {
  const issues: FieldIssue[] = [];
  const token = readString(body, 'refreshToken', REFRESH_TOKEN_RULE, issues);
  throwIfIssues(issues);
  return token!;
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const token = readRefreshToken(bodyObject(req.body));
  res.status(200).json(await auth.refresh(token));
}

export async function logout(req: Request, res: Response): Promise<void> {
  const token = readRefreshToken(bodyObject(req.body));
  await auth.logout(token);
  res.status(204).end();
}
