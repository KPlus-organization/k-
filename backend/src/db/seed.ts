import { closePool, withTransaction } from '../config/db';
import { env } from '../config/env';
import { loadContent, type ContentBlock, type ContentMaterial } from '../content/loadContent';
import { toSearchText } from '../services/content';

// Serializes concurrent syncs (e.g. two deploys at once). Differs from the migration lock.
const LOCK_ID = 7_310_250_002;

// Same text extraction as the search on the site: everything a reader can see.
function blockText(block: ContentBlock): string {
  if ('runs' in block) return block.runs.map((run) => run.text).join('');
  if (block.type === 'list') return block.items.flat().map((run) => run.text).join(' ');
  if (block.type === 'table') return block.rows.flat(2).map((run) => run.text).join(' ');
  return block.text;
}

function materialSearchText(material: ContentMaterial): string {
  return toSearchText(
    material.title,
    material.description,
    ...(material.intro ?? []).map(blockText),
    ...(material.sections ?? []).flatMap((section) => [section.title, ...section.blocks.map(blockText)]),
  );
}

/**
 * Makes the database content match the repository's content/ directory:
 * entries present there are inserted or updated, entries missing there are
 * unpublished (never deleted, so users' favorites are kept). Safe to run on every deploy.
 */
export async function syncContent(
  options: { contentDir?: string; log?: (message: string) => void } = {},
): Promise<void> {
  const log = options.log ?? console.log;
  const { objects, materials } = await loadContent(options.contentDir ?? env.contentDir);

  await withTransaction(async (client) => {
    await client.query('SELECT pg_advisory_xact_lock($1)', [LOCK_ID]);

    for (const [index, object] of objects.entries()) {
      await client.query(
        `INSERT INTO protection_objects (id, title, description, sort_order, search_text, is_published)
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (id) DO UPDATE SET title = $2, description = $3, sort_order = $4, search_text = $5,
           is_published = $6`,
        [
          object.id,
          object.title,
          object.description,
          index,
          toSearchText(object.title, object.description),
          object.published !== false,
        ],
      );
    }
    const objectIds = objects.map((object) => object.id);
    const hiddenObjects = await client.query(
      'UPDATE protection_objects SET is_published = false WHERE id <> ALL($1) AND is_published RETURNING id',
      [objectIds],
    );

    for (const [index, material] of materials.entries()) {
      const intro = material.intro ?? [];
      const sections = material.sections ?? [];
      await client.query(
        `INSERT INTO materials (id, topic, kind, title, page_title, description, file_name, file_path,
           intro, sections, has_content, sort_order, search_text, is_published)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
         ON CONFLICT (id) DO UPDATE SET topic = $2, kind = $3, title = $4, page_title = $5, description = $6,
           file_name = $7, file_path = $8, intro = $9, sections = $10, has_content = $11,
           sort_order = $12, search_text = $13, is_published = $14`,
        [
          material.id,
          material.topic,
          material.kind,
          material.title,
          material.pageTitle ?? material.title,
          material.description,
          material.file?.name ?? null,
          material.file?.path ?? null,
          JSON.stringify(intro),
          JSON.stringify(sections),
          intro.length > 0 || sections.length > 0,
          index,
          materialSearchText(material),
          material.published !== false,
        ],
      );
    }
    const materialIds = materials.map((material) => material.id);
    const hiddenMaterials = await client.query(
      'UPDATE materials SET is_published = false WHERE id <> ALL($1) AND is_published RETURNING id',
      [materialIds],
    );

    // Relations are fully defined by content/, so they are rebuilt from scratch.
    await client.query('DELETE FROM material_relations');
    for (const material of materials) {
      for (const [position, relatedId] of (material.related ?? []).entries()) {
        await client.query('INSERT INTO material_relations (material_id, related_id, position) VALUES ($1, $2, $3)', [
          material.id,
          relatedId,
          position,
        ]);
      }
    }

    const published = (items: { published?: boolean }[]) => items.filter((item) => item.published !== false).length;
    log(
      `[seed] content synced: ${published(objects)}/${objects.length} objects and ` +
        `${published(materials)}/${materials.length} materials published`,
    );
    for (const row of [...hiddenObjects.rows, ...hiddenMaterials.rows]) {
      log(`[seed] unpublished "${row.id}": no longer in content/`);
    }
  });
}

if (require.main === module) {
  syncContent()
    .catch((err: unknown) => {
      console.error('[seed] failed:', err instanceof Error ? err.message : err);
      process.exitCode = 1;
    })
    .finally(() => closePool());
}
