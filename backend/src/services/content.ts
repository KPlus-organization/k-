import { pool } from '../config/db';
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
  topic: string;
  kind: MaterialKind;
  title: string;
  description: string;
  hasContent: boolean;
  stepsCount: number;
}

export interface Material extends MaterialSummary {
  pageTitle: string;
  sourceFile: string | null;
  downloadPath: string | null;
  related: MaterialSummary[];
  intro: unknown[];
  sections: unknown[];
}

interface SummaryRow {
  id: string;
  topic: string;
  kind: MaterialKind;
  title: string;
  description: string;
  has_content: boolean;
  steps_count: number;
}

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

export async function listObjects(query?: string): Promise<ProtectionObject[]> {
  const { rows } = await pool.query<{ id: string; title: string; description: string; materials_count: number }>(
    `SELECT o.id, o.title, o.description,
       (SELECT count(*)::int FROM materials m WHERE m.topic = o.id) AS materials_count
     FROM protection_objects o
     WHERE $1::text IS NULL OR strpos(o.search_text, $1) > 0
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
     WHERE ($1::text IS NULL OR m.topic = $1)
       AND ($2::text IS NULL OR strpos(m.search_text, $2) > 0)
     ORDER BY m.sort_order`,
    [filter.topic ?? null, filter.query ?? null],
  );
  return rows.map(toSummary);
}

export async function getMaterial(id: string): Promise<Material> {
  const { rows } = await pool.query<
    SummaryRow & {
      page_title: string;
      source_file: string | null;
      download_path: string | null;
      intro: unknown[];
      sections: unknown[];
    }
  >(
    `SELECT ${SUMMARY_COLUMNS}, m.page_title, m.source_file, m.download_path, m.intro, m.sections
     FROM materials m WHERE m.id = $1`,
    [id],
  );
  const row = rows[0];
  if (!row) throw new HttpError(404, 'MATERIAL_NOT_FOUND', 'Material not found');

  const related = await pool.query<SummaryRow>(
    `SELECT ${SUMMARY_COLUMNS} FROM material_relations r
     JOIN materials m ON m.id = r.related_id
     WHERE r.material_id = $1
     ORDER BY r.position`,
    [id],
  );

  return {
    ...toSummary(row),
    pageTitle: row.page_title,
    sourceFile: row.source_file,
    downloadPath: row.download_path,
    related: related.rows.map(toSummary),
    intro: row.intro,
    sections: row.sections,
  };
}

export async function materialExists(id: string): Promise<boolean> {
  const { rowCount } = await pool.query('SELECT 1 FROM materials WHERE id = $1', [id]);
  return rowCount === 1;
}
