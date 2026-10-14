import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { after, test } from 'node:test';

import { env } from '../src/config/env';
import type { ContentMaterial } from '../src/content/loadContent';
import { syncContent } from '../src/db/seed';
import { api, registerUser, setupApi } from './helpers';

const quiet = () => undefined;
const tempDirs: string[] = [];

// Whatever happens in the tests, leave the database with the real content.
// Registered before setupApi(), so it runs before the pool is closed.
after(async () => {
  await syncContent({ log: quiet });
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })));
});

setupApi();

/** A copy of content/ with materials.json changed by `edit`. */
async function contentCopy(edit: (materials: ContentMaterial[]) => ContentMaterial[]): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'content-'));
  tempDirs.push(dir);
  await cp(env.contentDir, dir, { recursive: true });
  const file = path.join(dir, 'materials.json');
  const materials = JSON.parse(await readFile(file, 'utf8')) as ContentMaterial[];
  await writeFile(file, JSON.stringify(edit(materials)));
  return dir;
}

const ids = (items: { id: string }[]) => items.map((item) => item.id);

test('a material removed from content/ is unpublished, and favorites come back when it returns', async () => {
  const { accessToken: token } = await registerUser();
  assert.equal((await api('PUT', '/api/favorites/code-1', { token })).status, 204);

  const withoutCode1 = await contentCopy((materials) =>
    materials
      .filter((material) => material.id !== 'code-1')
      .map((material) => ({ ...material, related: material.related?.filter((id) => id !== 'code-1') })),
  );
  const messages: string[] = [];
  await syncContent({ contentDir: withoutCode1, log: (message) => messages.push(message) });
  assert.ok(messages.some((message) => message.includes('unpublished "code-1"')));

  assert.equal((await api('GET', '/api/materials/code-1')).status, 404);
  assert.equal((await api('GET', '/api/materials/code-1/file')).status, 404);
  assert.ok(!ids((await api('GET', '/api/materials')).body.items).includes('code-1'));
  const code = (await api('GET', '/api/objects')).body.items.find((item: { id: string }) => item.id === 'code');
  assert.equal(code.materialsCount, 5);
  assert.deepEqual((await api('GET', '/api/favorites', { token })).body.items, []);
  assert.equal((await api('PUT', '/api/favorites/code-1', { token })).status, 404);
  const search = await api('GET', `/api/search?q=${encodeURIComponent('компенсация')}`);
  assert.ok(!ids(search.body.materials).includes('code-1'));

  // Restoring the real content publishes the material again with the same favorite.
  await syncContent({ log: quiet });
  assert.equal((await api('GET', '/api/materials/code-1')).status, 200);
  assert.deepEqual(
    (await api('GET', '/api/favorites', { token })).body.items.map((item: { material: { id: string } }) => item.material.id),
    ['code-1'],
  );
});

test('"published": false hides a material that stays in content/', async () => {
  const hidden = await contentCopy((materials) =>
    materials.map((material) => (material.id === 'classes' ? { ...material, published: false } : material)),
  );
  await syncContent({ contentDir: hidden, log: quiet });
  assert.equal((await api('GET', '/api/materials/classes')).status, 404);

  await syncContent({ log: quiet });
  assert.equal((await api('GET', '/api/materials/classes')).status, 200);
});

test('invalid content is rejected as a whole and leaves the database unchanged', async () => {
  const broken = await contentCopy((materials) => [
    ...materials.map((material) => (material.id === 'code-0' ? { ...material, topic: 'no-such-object' } : material)),
    { ...materials[0]!, id: 'Bad Id' },
    { ...materials[1]!, id: 'with-missing-file', file: { path: 'missing.docx', name: 'x.docx' } },
  ]);

  await assert.rejects(syncContent({ contentDir: broken, log: quiet }), (err: Error) => {
    assert.match(err.message, /topic "no-such-object" is not in objects\.json/);
    assert.match(err.message, /id must be lowercase/);
    assert.match(err.message, /content\/files\/missing\.docx does not exist/);
    return true;
  });
  assert.equal((await api('GET', '/api/materials/code-0')).body.topic, 'code');
});
