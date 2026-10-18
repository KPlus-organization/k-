import path from 'node:path';

import { pool } from '../config/db';
import { env } from '../config/env';
import { HttpError } from '../errors/HttpError';

export interface ProtectionObject {
  id: string;
  title: string;
  description: string;
  materialsCount: number;
}

export type MaterialKind = 'article' | 'checklist' | 'reference';

export interface MaterialSummary {
  id: string;
  topic: string | null;
  kind: MaterialKind;
  title: string;
  description: string;
  hasContent: boolean;
  stepsCount: number;
}

export interface Material extends MaterialSummary {
  pageTitle: string;
  /** `url` is relative to the API base URL. */
  download: { fileName: string; url: string } | null;
  related: MaterialSummary[];
  intro: unknown[];
  sections: unknown[];
}

interface SummaryRow {
  id: string;
  topic: string | null;
  kind: MaterialKind;
  title: string;
  description: string;
  has_content: boolean;
  steps_count: number;
}

// Unpublished content is never returned by the API.
export const SUMMARY_COLUMNS = `m.id, m.topic, m.kind, m.title, m.description, m.has_content,
  jsonb_array_length(m.sections) AS steps_count`;

export function toSummary(row: SummaryRow): MaterialSummary {
  return {
    id: row.id,
    topic: row.topic,
    kind: row.kind,
    title: row.title,
    description: row.description,
    hasContent: row.has_content,
    stepsCount: row.steps_count,
  };
}

/** Lower-cases text the same way for stored search_text and for queries. */
export function toSearchText(...parts: string[]): string {
  return parts.join(' ').toLocaleLowerCase('ru');
}

const NOT_FOUND = () => new HttpError(404, 'MATERIAL_NOT_FOUND', 'Material not found');

export async function listObjects(query?: string): Promise<ProtectionObject[]> {
  const { rows } = await pool.query<{ id: string; title: string; description: string; materials_count: number }>(
    `SELECT o.id, o.title, o.description,
       (SELECT count(*)::int FROM materials m WHERE m.topic = o.id AND m.is_published) AS materials_count
     FROM protection_objects o
     WHERE o.is_published AND ($1::text IS NULL OR strpos(o.search_text, $1) > 0)
     ORDER BY o.sort_order`,
    [query ?? null],
  );
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    materialsCount: row.materials_count,
  }));
}

export async function listMaterials(filter: { topic?: string; query?: string } = {}): Promise<MaterialSummary[]> {
  const { rows } = await pool.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM materials m
     WHERE m.is_published
       AND ($1::text IS NULL OR m.topic = $1)
       AND ($2::text IS NULL OR strpos(m.search_text, $2) > 0)
     ORDER BY m.sort_order`,
    [filter.topic ?? null, filter.query ?? null],
  );
  return rows.map(toSummary);
}

export async function getMaterial(id: string): Promise<Material> {
  const { rows } = await pool.query<
    SummaryRow & { page_title: string; file_name: string | null; file_path: string | null; intro: unknown[]; sections: unknown[] }
  >(
    `SELECT ${SUMMARY_COLUMNS}, m.page_title, m.file_name, m.file_path, m.intro, m.sections
     FROM materials m WHERE m.id = $1 AND m.is_published`,
    [id],
  );
  const row = rows[0];
  if (!row) throw NOT_FOUND();

  const related = await pool.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM material_relations r
     JOIN materials m ON m.id = r.related_id
     WHERE r.material_id = $1 AND m.is_published
     ORDER BY r.position`,
    [id],
  );

  return {
    ...toSummary(row),
    pageTitle: row.page_title,
    download:
      row.file_path && row.file_name
        ? { fileName: row.file_name, url: `/api/materials/${encodeURIComponent(row.id)}/file` }
        : null,
    related: related.rows.map(toSummary),
    intro: row.intro,
    sections: row.sections,
  };
}

/** Absolute path and download name of a published material's source file. */
export async function getMaterialFile(id: string): Promise<{ path: string; name: string }> {
  const { rows } = await pool.query<{ file_name: string | null; file_path: string | null }>(
    'SELECT file_name, file_path FROM materials WHERE id = $1 AND is_published',
    [id],
  );
  const row = rows[0];
  if (!row?.file_path || !row.file_name) throw NOT_FOUND();

  const filesDir = path.join(env.contentDir, 'files');
  const filePath = path.resolve(filesDir, row.file_path);
  // file_path is validated during content sync; this guards against anything else.
  if (path.dirname(filePath) !== filesDir) throw NOT_FOUND();
  return { path: filePath, name: row.file_name };
}

export async function materialExists(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM materials WHERE id = $1 AND is_published', [id]);
  return rowCount === 1;
}
