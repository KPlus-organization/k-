import { HttpError, type FieldIssue } from '../errors/HttpError';

export type Fields = Record<string, unknown>;

/** The JSON request body as an object, or 400 if it is missing or not an object. */
export function bodyObject(body: unknown): Fields {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request body must be a JSON object');
  }
  return body as Fields;
}

export function throwIfIssues(issues: FieldIssue[]): void {
  if (issues.length > 0) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', { details: issues });
  }
}

interface StringRule {
  min: number;
  max: number;
  /** Passwords are compared as typed, everything else is trimmed. */
  trim?: boolean;
  pattern?: RegExp;
  patternMessage?: string;
}

/**
 * Reads `fields[name]` as a string checked against `rule`.
 * Records a problem in `issues` and returns undefined if it is invalid or missing.
 */
export function readString(fields: Fields, name: string, rule: StringRule, issues: FieldIssue[]): string | undefined {
  const raw = fields[name];
  if (raw === undefined || raw === null) {
    issues.push({ field: name, message: 'Field is required' });
    return undefined;
  }
  if (typeof raw !== 'string') {
    issues.push({ field: name, message: 'Must be a string' });
    return undefined;
  }
  const value = rule.trim === false ? raw : raw.trim();
  const length = [...value].length;
  if (length < rule.min || length > rule.max) {
    issues.push({ field: name, message: `Length must be between ${rule.min} and ${rule.max} characters` });
    return undefined;
  }
  if (rule.pattern && !rule.pattern.test(value)) {
    issues.push({ field: name, message: rule.patternMessage ?? 'Has an invalid format' });
    return undefined;
  }
  return value;
}

export const LOGIN_RULE: StringRule = {
  min: 3,
  max: 32,
  pattern: /^[\p{L}\p{N}._-]+$/u,
  patternMessage: 'May contain only letters, digits, ".", "_" and "-"',
};

export const EMAIL_RULE: StringRule = {
  min: 3,
  max: 254,
  pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
  patternMessage: 'Must be a valid email address',
};

export const NAME_RULE: StringRule = { min: 1, max: 100 };

export const PASSWORD_RULE: StringRule = { min: 8, max: 128, trim: false };
