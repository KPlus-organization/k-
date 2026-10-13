import { pool } from '../config/db';
import { HttpError } from '../errors/HttpError';
import { materialExists, SUMMARY_COLUMNS, toSummary, type MaterialSummary } from './content';

export interface Favorite {
  material: MaterialSummary;
  addedAt: string;
}

/**
 * Only published materials are listed. Favorites of unpublished materials stay in
 * the database and reappear if the material is published again.
 */
export async function listFavorites(userId: string): Promise<Favorite[]> {
  const { rows } = await pool.query(
    `SELECT ${SUMMARY_COLUMNS}, f.created_at
     FROM favorites f JOIN materials m ON m.id = f.material_id
     WHERE f.user_id = $1 AND m.is_published
     ORDER BY f.created_at DESC, m.sort_order`,
    [userId],
  );
  return rows.map((row) => ({ material: toSummary(row), addedAt: (row.created_at as Date).toISOString() }));
}

/** Idempotent: adding an existing favorite changes nothing. */
export async function addFavorite(userId: string, materialId: string): Promise<void> {
  if (!(await materialExists(materialId))) {
    throw new HttpError(404, 'MATERIAL_NOT_FOUND', 'Material not found');
  }
  await pool.query(
    'INSERT INTO favorites (user_id, material_id) VALUES ($1, $2) ON CONFLICT (user_id, material_id) DO NOTHING',
    [userId, materialId],
  );
}

/** Idempotent: removing a missing favorite changes nothing. */
export async function removeFavorite(userId: string, materialId: string): Promise<void> {
  await pool.query('DELETE FROM favorites WHERE user_id = $1 AND material_id = $2', [userId, materialId]);
}
