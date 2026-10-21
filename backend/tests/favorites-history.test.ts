import assert from 'node:assert/strict';
import { test } from 'node:test';

import { api, registerUser, setupApi } from './helpers';

setupApi();

test('favorites: add, list, remove; both operations are idempotent', async () => {
  const { accessToken: token } = await registerUser();

  assert.deepEqual((await api('GET', '/api/favorites', { token })).body, { items: [] });

  assert.equal((await api('PUT', '/api/favorites/checklist', { token })).status, 204);
  assert.equal((await api('PUT', '/api/favorites/checklist', { token })).status, 204);
  assert.equal((await api('PUT', '/api/favorites/classes', { token })).status, 204);

  const list = await api('GET', '/api/favorites', { token });
  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.items.map((item: { material: { id: string } }) => item.material.id).sort(),
    ['checklist', 'classes'],
  );
  assert.ok(Date.parse(list.body.items[0].addedAt));
  assert.equal(list.body.items.find((i: { material: { id: string } }) => i.material.id === 'classes').material.hasContent, false);

  assert.equal((await api('DELETE', '/api/favorites/checklist', { token })).status, 204);
  assert.equal((await api('DELETE', '/api/favorites/checklist', { token })).status, 204);
  assert.deepEqual(
    (await api('GET', '/api/favorites', { token })).body.items.map((i: { material: { id: string } }) => i.material.id),
    ['classes'],
  );
});

test('favorites: unknown material is 404 and other users see only their own list', async () => {
  const first = await registerUser();
  const second = await registerUser();

  const unknown = await api('PUT', '/api/favorites/nope', { token: first.accessToken });
  assert.equal(unknown.status, 404);
  assert.equal(unknown.body.error.code, 'MATERIAL_NOT_FOUND');

  await api('PUT', '/api/favorites/code-0', { token: first.accessToken });
  assert.deepEqual((await api('GET', '/api/favorites', { token: second.accessToken })).body.items, []);
  assert.equal((await api('GET', '/api/favorites')).status, 401);
});

test('history: entries are returned newest first and validated', async () => {
  const { accessToken: token } = await registerUser();

  const created = await api('POST', '/api/history', {
    token,
    body: { type: 'material', target: 'checklist', title: 'Чек-лист: Защитить программный код' },
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.type, 'material');
  assert.ok(Date.parse(created.body.visitedAt));

  const search = { type: 'search', target: 'МКТУ', title: 'Поиск: МКТУ' };
  const first = await api('POST', '/api/history', { token, body: search });
  assert.equal(first.status, 201);
  // A reload of the results or a second tab: still one entry, returned as is.
  const [again, parallel] = await Promise.all([
    api('POST', '/api/history', { token, body: search }),
    api('POST', '/api/history', { token, body: search }),
  ]);
  assert.deepEqual([again.status, parallel.status], [200, 200]);
  assert.equal(again.body.id, first.body.id);
  await api('POST', '/api/history', { token, body: { type: 'tool', target: 'calculator', title: 'Калькулятор пошлин' } });

  const list = await api('GET', '/api/history?limit=2', { token });
  assert.equal(list.status, 200);
  assert.deepEqual(
    list.body.items.map((item: { type: string }) => item.type),
    ['tool', 'search'],
  );
  const all = (await api('GET', '/api/history?limit=50', { token })).body.items;
  assert.equal(all.filter((item: { target: string }) => item.target === 'МКТУ').length, 1);

  const invalid = await api('POST', '/api/history', { token, body: { type: 'video', target: '', title: 'x' } });
  assert.equal(invalid.status, 400);
  assert.deepEqual(
    invalid.body.error.details.map((d: { field: string }) => d.field).sort(),
    ['target', 'type'],
  );

  const unknownMaterial = await api('POST', '/api/history', {
    token,
    body: { type: 'material', target: 'nope', title: 'Nope' },
  });
  assert.equal(unknownMaterial.status, 400);

  assert.equal((await api('GET', '/api/history?limit=0', { token })).status, 400);
  assert.equal((await api('GET', '/api/history')).status, 401);
});

test('non-object JSON bodies return 400 in the common error format', async () => {
  const notObject = await api('POST', '/api/auth/login', { body: ['identifier'] });
  assert.equal(notObject.status, 400);
  assert.equal(notObject.body.error.code, 'VALIDATION_ERROR');
});
