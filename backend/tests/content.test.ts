import assert from 'node:assert/strict';
import { test } from 'node:test';

import { api, apiUrl, setupApi } from './helpers';

setupApi();

test('GET / and GET /api/health report a working server and database', async () => {
  assert.deepEqual((await api('GET', '/')).body, { status: 'ok', message: 'Backend is running' });
  const health = await api('GET', '/api/health');
  assert.equal(health.status, 200);
  assert.deepEqual(health.body, { status: 'ok', database: 'up' });
});

test('GET /api/objects lists the seven protection objects in order', async () => {
  const res = await api('GET', '/api/objects');
  assert.equal(res.status, 200);
  assert.deepEqual(
    res.body.items.map((item: { id: string }) => item.id),
    ['code', 'algorithms', 'design', 'databases', 'brand', 'visuals', 'fonts'],
  );
  const code = res.body.items[0];
  assert.equal(code.title, 'Программный код');
  assert.equal(code.materialsCount, 4);
});

test('GET /api/materials lists summaries and filters by topic', async () => {
  const all = await api('GET', '/api/materials');
  assert.equal(all.status, 200);
  assert.equal(all.body.items.length, 11);
  assert.deepEqual(Object.keys(all.body.items[0]).sort(), [
    'description',
    'hasContent',
    'id',
    'kind',
    'stepsCount',
    'title',
    'topic',
  ]);

  const brand = await api('GET', '/api/materials?topic=brand');
  assert.deepEqual(
    brand.body.items.map((item: { id: string }) => item.id),
    ['brand-article', 'brand-protection', 'application', 'deadlines', 'classes'],
  );
  const placeholder = brand.body.items.find((item: { id: string }) => item.id === 'classes');
  assert.equal(placeholder.hasContent, false);

  assert.deepEqual((await api('GET', '/api/materials?topic=unknown')).body, { items: [] });
});

test('GET /api/materials/:id returns full content with related summaries', async () => {
  const res = await api('GET', '/api/materials/checklist');
  assert.equal(res.status, 200);
  assert.equal(res.body.kind, 'checklist');
  assert.equal(res.body.sections.length, 8);
  assert.equal(res.body.stepsCount, 8);
  assert.deepEqual(res.body.download, {
    fileName: 'Чек-лист программный год - защита прав.docx',
    url: '/api/materials/checklist/file',
  });
  assert.deepEqual(
    res.body.related.map((item: { id: string }) => item.id),
    ['code-0', 'code-1', 'code-expert'],
  );
  assert.ok(Array.isArray(res.body.sections[0].blocks));
});

test('GET /api/materials/:id/file downloads the source DOCX under its original name', async () => {
  const res = await fetch(apiUrl('/api/materials/checklist/file'));
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-disposition') ?? '', /^attachment;.*filename\*=UTF-8''/);
  assert.match(
    decodeURIComponent(res.headers.get('content-disposition') ?? ''),
    /Чек-лист программный год - защита прав\.docx/,
  );
  assert.equal(Buffer.from(await res.arrayBuffer()).subarray(0, 2).toString(), 'PK');

  // A placeholder without a file and an unknown material.
  assert.equal((await api('GET', '/api/materials/classes/file')).status, 404);
  assert.equal((await api('GET', '/api/materials/nope/file')).status, 404);
  assert.equal((await api('GET', '/api/materials/classes')).body.download, null);
});

test('GET /api/materials/:id answers 404 for an unknown material', async () => {
  const res = await api('GET', '/api/materials/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(res.body, { error: { code: 'MATERIAL_NOT_FOUND', message: 'Material not found' } });
});

test('GET /api/search finds objects and materials case-insensitively', async () => {
  const res = await api('GET', `/api/search?q=${encodeURIComponent('  МКТУ ')}`);
  assert.equal(res.status, 200);
  assert.equal(res.body.query, 'МКТУ');
  assert.deepEqual(res.body.objects, []);
  assert.deepEqual(
    res.body.materials.map((item: { id: string }) => item.id),
    ['classes'],
  );

  const code = await api('GET', `/api/search?q=${encodeURIComponent('Код')}`);
  assert.deepEqual(
    code.body.objects.map((item: { id: string }) => item.id),
    ['code'],
  );
  assert.ok(code.body.materials.length > 0);
});

test('GET /api/search handles empty and too long queries', async () => {
  assert.deepEqual((await api('GET', '/api/search')).body, { query: '', objects: [], materials: [] });
  const tooLong = await api('GET', `/api/search?q=${'a'.repeat(201)}`);
  assert.equal(tooLong.status, 400);
  assert.equal(tooLong.body.error.code, 'VALIDATION_ERROR');
  assert.equal(tooLong.body.error.details[0].field, 'q');
});

test('CORS allows configured origins only and permits the Authorization header', async () => {
  const preflight = await api('OPTIONS', '/api/profile', {
    headers: {
      Origin: 'http://127.0.0.1:3000',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization',
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get('access-control-allow-origin'), 'http://127.0.0.1:3000');
  assert.match(preflight.headers.get('access-control-allow-headers') ?? '', /Authorization/);
  assert.equal(preflight.headers.get('access-control-allow-credentials'), null);

  const foreign = await api('GET', '/', { headers: { Origin: 'http://evil.example' } });
  assert.equal(foreign.headers.get('access-control-allow-origin'), null);
});
