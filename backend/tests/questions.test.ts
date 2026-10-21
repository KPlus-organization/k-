import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';

import { pool } from '../src/config/db';
import { api, registerUser, setupApi } from './helpers';

const visitors: string[] = [];
after(async () => {
  await pool.query('DELETE FROM material_readership WHERE reader_key = ANY($1)', [visitors.map((id) => `guest:${id}`)]);
});
setupApi();
const visitor = () => {
  const id = randomUUID();
  visitors.push(id);
  return id;
};

test('the supplied questions have answers and only published, complete material links', async () => {
  const result = await api('GET', '/api/questions');
  assert.equal(result.status, 200);
  assert.equal(result.headers.get('cache-control'), 'no-store');
  assert.equal(result.body.items.length, 8);
  assert.equal(result.body.total, 39);
  assert.equal(result.body.mode, 'popular');
  const all = (await api('GET', '/api/questions?limit=100')).body.items;
  assert.equal(new Set(all.map((item: { id: string }) => item.id)).size, 39);
  assert.equal(all.filter((item: { material: unknown }) => item.material).length, 23);
  for (const item of all) {
    assert.ok(item.question && item.answer && item.reference && item.topicTitle);
    assert.equal(item.source, undefined);
    if (item.material) {
      assert.ok(item.material.hasContent);
      assert.equal((await api('GET', `/api/materials/${item.material.id}`)).status, 200);
    }
  }
  assert.deepEqual((await api('GET', '/api/questions?offset=8')).body.items, all.slice(8, 16));
  assert.equal((await api('GET', '/api/questions?limit=-1')).status, 400);
  assert.equal((await api('GET', '/api/questions?offset=0.5')).status, 400);
  assert.equal((await api('GET', '/api/questions', { token: 'invalid' })).status, 401);
});

test('opening a material counts guests once per 30 minutes, including concurrent requests', async () => {
  const visitorId = visitor();
  const results = await Promise.all(
    Array.from({ length: 5 }, () => api('POST', '/api/materials/code-0/view', { body: { visitorId } })),
  );
  assert.ok(results.every((result) => result.status === 204));
  const count = async () =>
    (
      await pool.query('SELECT views FROM material_readership WHERE material_id = $1 AND reader_key = $2', [
        'code-0',
        `guest:${visitorId}`,
      ])
    ).rows[0].views;
  assert.equal(Number(await count()), 1);
  await api('GET', '/api/questions');
  await api('GET', '/api/materials/code-0');
  assert.equal(Number(await count()), 1, 'FAQ and content API reads do not count');
  await pool.query(
    "UPDATE material_readership SET last_viewed_at = now() - interval '31 minutes' WHERE reader_key = $1",
    [`guest:${visitorId}`],
  );
  await api('POST', '/api/materials/code-0/view', { body: { visitorId } });
  assert.equal(Number(await count()), 2);
  assert.equal((await api('POST', '/api/materials/missing/view', { body: { visitorId } })).status, 404);
  assert.equal((await api('POST', '/api/materials/application/view', { body: { visitorId } })).status, 404);
  assert.equal((await api('POST', '/api/materials/code-0/view', { body: { visitorId: 'bad' } })).status, 400);
});

test('popularity follows material openings and a new account receives the same ranking', async () => {
  const visitorId = visitor();
  await api('POST', '/api/materials/brand-claim/view', { body: { visitorId } });
  await pool.query('UPDATE material_readership SET views = 1000000 WHERE reader_key = $1', [`guest:${visitorId}`]);
  const popular = (await api('GET', '/api/questions')).body;
  assert.equal(popular.items[0].material.id, 'brand-claim');
  const user = await registerUser();
  const fresh = (await api('GET', '/api/questions', { token: user.accessToken })).body;
  assert.equal(fresh.mode, 'popular');
  assert.deepEqual(fresh.items, popular.items);
  const top = (await api('GET', '/api/questions?order=popular&limit=5')).body;
  assert.equal(top.mode, 'popular');
  assert.deepEqual(top.items, popular.items.slice(0, 5));
  assert.equal((await api('GET', '/api/questions?order=recent')).status, 400);
});

test('personal recommendations use only the account history and prioritize unread related materials', async () => {
  const user = await registerUser();
  const other = await registerUser();
  const token = user.accessToken;
  // Changing the supplied guest identity cannot duplicate authenticated views/history.
  for (let n = 0; n < 2; n++) {
    assert.equal(
      (await api('POST', '/api/materials/database-rights/view', { token, body: { visitorId: visitor() } })).status,
      204,
    );
  }
  const history = (await api('GET', '/api/history', { token })).body.items;
  assert.equal(history.length, 1);
  assert.equal(history[0].target, 'database-rights');
  assert.match(history[0].title, /^Статья: /);
  const personal = (await api('GET', '/api/questions', { token })).body;
  assert.equal(personal.mode, 'personalized');
  assert.equal(personal.items[0].material.topic, 'databases');
  assert.notEqual(personal.items[0].material.id, 'database-rights');
  assert.equal((await api('GET', '/api/questions?order=popular', { token })).body.mode, 'popular');
  assert.equal((await api('GET', '/api/questions', { token: other.accessToken })).body.mode, 'popular');
  assert.deepEqual((await api('GET', '/api/history', { token: other.accessToken })).body.items, []);
  // A previous history entry (before analytics existed) also enables recommendations.
  await api('POST', '/api/history', {
    token: other.accessToken,
    body: { type: 'material', target: 'code-0', title: 'Код' },
  });
  const legacy = (await api('GET', '/api/questions', { token: other.accessToken })).body;
  assert.equal(legacy.mode, 'personalized');
  assert.equal(legacy.items[0].material.topic, 'code');
  assert.notEqual(legacy.items[0].material.id, 'code-0');
});

test('unpublished linked articles are not exposed by the questions API', async () => {
  try {
    await pool.query("UPDATE materials SET is_published = false WHERE id = 'code-0'");
    const all = (await api('GET', '/api/questions?limit=100')).body.items;
    assert.equal(all.find((item: { id: string }) => item.id === 'code-03').material, null);
    assert.equal((await api('POST', '/api/materials/code-0/view', { body: { visitorId: visitor() } })).status, 404);
  } finally {
    await pool.query("UPDATE materials SET is_published = true WHERE id = 'code-0'");
  }
});
