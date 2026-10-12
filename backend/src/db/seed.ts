import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { closePool, withTransaction } from '../config/db';
import { env } from '../config/env';
import { PROJECT_ROOT } from '../config/paths';
import { hashPassword } from '../lib/password';
import { toSearchText } from '../services/content';
import { normalizeKey } from '../services/users';

const SEED_DIR = path.join(PROJECT_ROOT, 'db/seed-data');

interface SeedObject {
  id: string;
  title: string;
  description: string;
}

type Run = { text: string };
type Block =
  | { type: 'paragraph' | 'heading' | 'note'; runs: Run[] }
  | { type: 'list'; items: Run[][] }
  | { type: 'table'; rows: Run[][][] }
  | { type: 'action'; text: string };

interface SeedMaterial {
  id: string;
  topic: string;
  kind: 'article' | 'checklist' | 'reference';
  title: string;
  pageTitle?: string;
  description: string;
  sourceFile?: string;
  download?: string;
  related?: string[];
  intro?: Block[];
  sections?: { id: string; title: string; toc: string; blocks: Block[] }[];
}

// Same text extraction as the frontend's client-side search.
function blockText(block: Block): string {
  if ('runs' in block) return block.runs.map((run) => run.text).join('');
  if (block.type === 'list') return block.items.flat().map((run) => run.text).join(' ');
  if (block.type === 'table') return block.rows.flat(2).map((run) => run.text).join(' ');
  return block.text;
}

function materialSearchText(material: SeedMaterial): string {
  return toSearchText(
    material.title,
    material.description,
    ...(material.intro ?? []).map(blockText),
    ...(material.sections ?? []).flatMap((section) => [section.title, ...section.blocks.map(blockText)]),
  );
}

async function readJson<T>(file: string): Promise<T> {
  return JSON.parse(await readFile(path.join(SEED_DIR, file), 'utf8')) as T;
}

const DEMO_USER = {
  login: 'anna_kuznetsova',
  email: 'anna@example.com',
  name: 'Анна Кузнецова',
  registeredAt: '2023-10-12T00:00:00Z',
  favorites: ['application', 'deadlines', 'classes'],
  // [type, target, title, minutes ago]
  history: [
    ['tool', 'calculator', 'Калькулятор пошлин', 60],
    ['material', 'checklist', 'Чек-лист: Защитить программный код', 65],
    ['tool', 'documents', 'Конструктор документов: заявка на регистрацию товарного знака', 70],
    ['tool', 'trademark', 'Проверка товарных знаков', 30 * 24 * 60],
    ['material', 'classes', 'Статья: Что такое МКТУ и как правильно выбрать классы', 30 * 24 * 60 + 5],
    ['search', 'МКТУ', 'Поиск: что такое МКТУ?', 30 * 24 * 60 + 10],
  ] as const,
};

/**
 * Upserts content (protection objects, materials, relations) and, if a password
 * is given, the demo user with demo favorites and history. Safe to run repeatedly.
 */
export async function seed(options: { demoPassword?: string; log?: (message: string) => void } = {}): Promise<void> {
  const log = options.log ?? console.log;
  const objects = await readJson<SeedObject[]>('objects.json');
  const materials = await readJson<SeedMaterial[]>('materials.json');
  const demoPasswordHash = options.demoPassword ? await hashPassword(options.demoPassword) : undefined;

  await withTransaction(async (client) => {
    for (const [index, object] of objects.entries()) {
      await client.query(
        `INSERT INTO protection_objects (id, title, description, sort_order, search_text)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (id) DO UPDATE SET title = $2, description = $3, sort_order = $4, search_text = $5`,
        [object.id, object.title, object.description, index, toSearchText(object.title, object.description)],
      );
    }

    for (const [index, material] of materials.entries()) {
      const intro = material.intro ?? [];
      const sections = material.sections ?? [];
      await client.query(
        `INSERT INTO materials (id, topic, kind, title, page_title, description, source_file, download_path,
           intro, sections, has_content, sort_order, search_text)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET topic = $2, kind = $3, title = $4, page_title = $5, description = $6,
           source_file = $7, download_path = $8, intro = $9, sections = $10, has_content = $11,
           sort_order = $12, search_text = $13`,
        [
          material.id,
          material.topic,
          material.kind,
          material.title,
          material.pageTitle ?? material.title,
          material.description,
          material.sourceFile ?? null,
          material.download ?? null,
          JSON.stringify(intro),
          JSON.stringify(sections),
          intro.length > 0 || sections.length > 0,
          index,
          materialSearchText(material),
        ],
      );
    }

    // Relations are inserted after all materials exist, because of foreign keys.
    const ids = materials.map((material) => material.id);
    await client.query('DELETE FROM material_relations WHERE material_id = ANY($1)', [ids]);
    for (const material of materials) {
      for (const [position, relatedId] of (material.related ?? []).entries()) {
        // Skip links to materials that are missing from the seed data.
        if (!ids.includes(relatedId)) {
          log(`[seed] skipped relation ${material.id} -> ${relatedId}: no such material`);
          continue;
        }
        await client.query('INSERT INTO material_relations (material_id, related_id, position) VALUES ($1, $2, $3)', [
          material.id,
          relatedId,
          position,
        ]);
      }
    }
    log(`[seed] ${objects.length} protection objects, ${materials.length} materials`);

    if (!demoPasswordHash) return;

    const { rows } = await client.query<{ id: string }>(
      `INSERT INTO users (login, login_key, email, email_key, name, password_hash, consent_given_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
       ON CONFLICT (login_key) DO UPDATE SET email = $3, email_key = $4, name = $5, password_hash = $6,
         updated_at = now()
       RETURNING id`,
      [
        DEMO_USER.login,
        normalizeKey(DEMO_USER.login),
        DEMO_USER.email,
        normalizeKey(DEMO_USER.email),
        DEMO_USER.name,
        demoPasswordHash,
        DEMO_USER.registeredAt,
      ],
    );
    const userId = rows[0]!.id;

    await client.query('DELETE FROM favorites WHERE user_id = $1', [userId]);
    for (const materialId of DEMO_USER.favorites) {
      await client.query('INSERT INTO favorites (user_id, material_id) VALUES ($1, $2)', [userId, materialId]);
    }
    await client.query('DELETE FROM history_entries WHERE user_id = $1', [userId]);
    for (const [type, target, title, minutesAgo] of DEMO_USER.history) {
      await client.query(
        `INSERT INTO history_entries (user_id, type, target, title, visited_at)
         VALUES ($1, $2, $3, $4, now() - make_interval(mins => $5))`,
        [userId, type, target, title, minutesAgo],
      );
    }
    log(`[seed] demo user "${DEMO_USER.login}" with favorites and history`);
  });
}

if (require.main === module) {
  const demoPassword = process.env['SEED_DEMO_PASSWORD'] || undefined;
  if (demoPassword && env.isProduction) {
    console.error('[seed] refusing to create the demo user with NODE_ENV=production');
    process.exitCode = 1;
  } else {
    if (!demoPassword) console.log('[seed] SEED_DEMO_PASSWORD is not set: demo user is skipped');
    seed({ demoPassword })
      .catch((err: unknown) => {
        console.error('[seed] failed:', err);
        process.exitCode = 1;
      })
      .finally(() => closePool());
  }
}
