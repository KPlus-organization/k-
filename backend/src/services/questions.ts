import { pool, withTransaction } from '../config/db';
import { loadQuestions, QUESTION_TOPICS } from '../content/loadQuestions';
import { HttpError } from '../errors/HttpError';
import { listMaterials, type MaterialKind } from './content';

/** Count the visible article/checklist, never an FAQ expansion or a catalog/API fetch. */
export async function recordMaterialView(materialId: string, visitorId: string, userId?: string): Promise<void> {
  await withTransaction(async (client) => {
    const material = await client.query<{ title: string; kind: MaterialKind }>(
      'SELECT title, kind FROM materials WHERE id = $1 AND is_published AND has_content',
      [materialId],
    );
    if (!material.rows[0]) throw new HttpError(404, 'MATERIAL_NOT_FOUND', 'Material not found');
    const counted = await client.query(
      `INSERT INTO material_readership (material_id, reader_key, user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (material_id, reader_key) DO UPDATE
         SET views = material_readership.views + 1, last_viewed_at = now()
         WHERE material_readership.last_viewed_at <= now() - interval '30 minutes'
       RETURNING material_id`,
      [materialId, userId ? `user:${userId}` : `guest:${visitorId}`, userId ?? null],
    );
    if (userId && counted.rowCount) {
      const labels: Record<MaterialKind, string> = { article: 'Статья', checklist: 'Чек-лист', reference: 'Памятка' };
      await client.query(`INSERT INTO history_entries (user_id, type, target, title) VALUES ($1, 'material', $2, $3)`, [
        userId,
        materialId,
        `${labels[material.rows[0].kind]}: ${material.rows[0].title}`,
      ]);
    }
  });
}

export async function listQuestions(userId?: string) {
  const [questions, allMaterials, popularity, history, relations] = await Promise.all([
    loadQuestions(),
    listMaterials(),
    pool.query<{ material_id: string; views: string }>(
      'SELECT material_id, sum(views)::text AS views FROM material_readership GROUP BY material_id',
    ),
    pool.query<{ target: string }>(
      `SELECT h.target FROM history_entries h JOIN materials m ON m.id = h.target
       WHERE h.user_id = $1 AND h.type = 'material' AND m.is_published AND m.has_content
       GROUP BY h.target ORDER BY max(h.visited_at) DESC LIMIT 50`,
      [userId ?? null],
    ),
    pool.query<{ material_id: string; related_id: string }>('SELECT material_id, related_id FROM material_relations'),
  ]);
  const materials = new Map(allMaterials.filter((item) => item.hasContent).map((item) => [item.id, item]));
  const views = new Map(popularity.rows.map((row) => [row.material_id, Number(row.views)]));
  const read = new Set(history.rows.map((row) => row.target));
  const topicWeights = new Map<string, number>();
  const relatedWeights = new Map<string, number>();
  history.rows.forEach(({ target }, index) => {
    const weight = 1 / (index + 1);
    const topic = materials.get(target)?.topic;
    if (topic) topicWeights.set(topic, (topicWeights.get(topic) ?? 0) + weight);
    for (const relation of relations.rows) {
      const neighbor =
        relation.material_id === target
          ? relation.related_id
          : relation.related_id === target
            ? relation.material_id
            : null;
      if (neighbor) relatedWeights.set(neighbor, (relatedWeights.get(neighbor) ?? 0) + weight);
    }
  });
  const ranked = questions.map(({ source: _source, materialId, ...question }, order) => {
    const material = materialId ? (materials.get(materialId) ?? null) : null;
    // Prefer unread neighboring materials; topic affinity and explicit article links
    // determine relevance. Popularity resolves equal relevance, never replaces it.
    const affinity = material
      ? (topicWeights.get(material.topic ?? '') ?? 0) + (relatedWeights.get(material.id) ?? 0)
      : 0;
    const relevance = affinity > 0 ? (read.has(material!.id) ? 1 : 2) + affinity / (1 + affinity) : 0;
    return {
      item: { ...question, topicTitle: QUESTION_TOPICS[question.topic], material },
      relevance,
      views: material ? (views.get(material.id) ?? 0) : 0,
      order,
    };
  });
  const personalized = ranked.some((row) => row.relevance > 0);
  ranked.sort(
    (a, b) =>
      b.relevance - a.relevance ||
      b.views - a.views ||
      Number(Boolean(b.item.material)) - Number(Boolean(a.item.material)) ||
      a.order - b.order,
  );
  return {
    mode: personalized ? 'personalized' : 'popular',
    hasPopularity: ranked.some((row) => row.views > 0),
    items: ranked.map((row) => row.item),
  };
}
