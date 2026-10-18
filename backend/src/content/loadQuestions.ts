import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { env } from '../config/env';

export interface ContentQuestion {
  id: string;
  topic: string;
  question: string;
  answer: string;
  reference: string;
  materialId: string | null;
  source: string;
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
  }
  return data as ContentQuestion[];
}
