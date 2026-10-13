import assert from 'node:assert/strict';
import test from 'node:test';
import { ESLint } from 'eslint';

const eslint = new ESLint();
async function architectureMessages(filePath, source) {
  const [result] = await eslint.lintText(source, { filePath });
  return result.messages.filter((message) => message.ruleId?.startsWith('boundaries/'));
}

test('FSD allows a page to import an entity public API', async () => {
  assert.deepEqual(
    await architectureMessages(
      'src/pages/home/ui/Home.tsx',
      "import { materialLabels } from '@/entities/material'; console.log(materialLabels);",
    ),
    [],
  );
});

test('FSD blocks upward dependencies, including relative paths', async () => {
  for (const target of ['@/pages/home', '../../../pages/home']) {
    assert.ok(
      (
        await architectureMessages(
          'src/entities/profile/model/profile.ts',
          `import { Home } from '${target}'; console.log(Home);`,
        )
      ).length > 0,
    );
  }
});

test('FSD blocks imports between sibling slices', async () => {
  assert.ok(
    (
      await architectureMessages(
        'src/features/session/model/use-session.ts',
        "import { useFavorites } from '@/features/favorites'; console.log(useFavorites);",
      )
    ).length > 0,
  );
});

test('FSD blocks access to another slice internals', async () => {
  assert.ok(
    (
      await architectureMessages(
        'src/pages/home/ui/Home.tsx',
        "import { profileFieldHints } from '@/entities/profile/model/types'; console.log(profileFieldHints);",
      )
    ).length > 0,
  );
});

test('FSD allows relative imports within a slice', async () => {
  assert.deepEqual(
    await architectureMessages(
      'src/entities/material/ui/ArticleButton.tsx',
      "import { materialHref } from '../model/routes'; console.log(materialHref);",
    ),
    [],
  );
});
