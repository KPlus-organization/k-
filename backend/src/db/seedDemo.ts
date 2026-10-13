import { closePool, withTransaction } from '../config/db';
import { env } from '../config/env';
import { hashPassword } from '../lib/password';
import { normalizeKey } from '../services/users';

// Demo user from the Figma mockup, for local development and CI only.
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
 * Creates or resets the demo user with demo favorites and history.
 * Requires synced content (favorites reference materials).
 */
export async function seedDemo(password: string, log: (message: string) => void = console.log): Promise<void> {
  const passwordHash = await hashPassword(password);

  await withTransaction(async (client) => {
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
        passwordHash,
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
  });
  log(`[seed:demo] demo user "${DEMO_USER.login}" / ${DEMO_USER.email} with favorites and history`);
}

if (require.main === module) {
  const password = process.env['SEED_DEMO_PASSWORD'];
  if (env.isProduction) {
    console.error('[seed:demo] refusing to run with NODE_ENV=production');
    process.exitCode = 1;
  } else if (!password || password.length < 8) {
    console.error('[seed:demo] set SEED_DEMO_PASSWORD (at least 8 characters) in backend/.env');
    process.exitCode = 1;
  } else {
    seedDemo(password)
      .catch((err: unknown) => {
        console.error('[seed:demo] failed:', err);
        process.exitCode = 1;
      })
      .finally(() => closePool());
  }
}
