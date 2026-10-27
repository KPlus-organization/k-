import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';
import { isWebLink } from '../lib/webLinks';

export interface ContentQuestion {
  id: string;
  topic: string;
  question: string;
  answer: string;
  /** Parts of the answer that link to legal acts, in the order they occur in it. */
  answerLinks: AnswerLink[];
  reference: string;
  materialId: string | null;
  source: string;
}

export interface AnswerLink {
  text: string;
  href: string;
}

/** Each link is an http(s) address and its text occurs in the answer after the previous one. */
function answerLinks(id: string, answer: string, raw: unknown): AnswerLink[] {
  if (raw === undefined) return [];
  if (!Array.isArray(raw)) throw new Error(`questions.json: ${id}: answerLinks must be an array`);
  let from = 0;
  return raw.map((link: unknown, index) => {
    const { text, href } = (link ?? {}) as Record<string, unknown>;
    const at = typeof text === 'string' && text.trim() !== '' ? answer.indexOf(text, from) : -1;
    if (at < 0) throw new Error(`questions.json: ${id}: answerLinks[${index}].text is not found in the answer after the previous link`);
    if (!isWebLink(href)) throw new Error(`questions.json: ${id}: answerLinks[${index}].href must be an http(s) address`);
    from = at + (text as string).length;
    return { text: text as string, href };
  });
}

export const QUESTION_TOPICS: Record<string, string> = {
  code: 'Программный код',
  algorithms: 'Алгоритмы',
  design: 'Дизайн интерфейса',
  brand: 'Обозначения бренда',
  visuals: 'Визуальный контент',
  databases: 'Базы данных',
  texts: 'Тексты для сайта',
};

/** References may be pending; a missing or unpublished material never becomes a link. */
export async function loadQuestions(): Promise<ContentQuestion[]> {
  const data: unknown = JSON.parse(await readFile(path.join(env.contentDir, 'questions.json'), 'utf8'));
  if (!Array.isArray(data)) throw new Error('questions.json must contain an array');
  const ids = new Set<string>();
  for (const item of data) {
    if (
      !item ||
      typeof item !== 'object' ||
      !['id', 'topic', 'question', 'answer', 'reference', 'source'].every(
        (key) => typeof item[key] === 'string' && item[key].trim().length > 0,
      ) ||
      !/^[a-z0-9-]+$/.test(item.id) ||
      !Object.hasOwn(QUESTION_TOPICS, item.topic) ||
      (item.materialId !== null && (typeof item.materialId !== 'string' || !/^[a-z0-9-]+$/.test(item.materialId))) ||
      ids.has(item.id)
    ) {
      throw new Error('Invalid or duplicate entry in questions.json');
    }
    ids.add(item.id);
    item.answerLinks = answerLinks(item.id, item.answer, item.answerLinks);
  }
  return data as ContentQuestion[];
}
