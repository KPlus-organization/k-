import { readFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';
import { API_URL } from './helpers';

// Every published material with content, as the API lists it: new content needs no new test.
// The list is checked in parts, so that parallel workers share it.
const PARTS = 4;

for (let part = 0; part < PARTS; part++) {
  test(`every published material reads on a phone and downloads its original file (part ${part + 1} of ${PARTS})`, async ({
    page,
    request,
  }) => {
    const sources = new Map<string, string>(
      (
        JSON.parse(await readFile('../content/materials.json', 'utf8')) as {
          id: string;
          file?: { path: string };
        }[]
      ).flatMap((item) => (item.file ? [[item.id, item.file.path]] : [])),
    );
    const materials = (await (await request.get(`${API_URL}/api/materials`)).json()).items as {
      id: string;
      hasContent: boolean;
    }[];
    const published = materials.filter((item) => item.hasContent);
    expect(published.length).toBeGreaterThan(PARTS);
    const today = new Date().toLocaleDateString('ru-RU');
    // «…актуален на 27.10.26» or «…на 27.10.2026»: always today's date.
    const relevance = new RegExp(
      `актуален на ${today.slice(0, 6).replaceAll('.', '\\.')}(?:${today.slice(6)}|${today.slice(8)})\\b`,
    );

    await page.setViewportSize({ width: 390, height: 844 });
    for (const { id } of published.filter((_, index) => index % PARTS === part)) {
      await page.goto(`/articles/${id}`);
      const article = page.getByRole('article');
      await expect(article, id).toBeVisible();
      await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('color', 'rgb(0, 134, 91)');
      // Checklists are read, not ticked off.
      await expect(page.getByRole('checkbox'), id).toHaveCount(0);
      // Editorial notes and link placeholders from the source files are not published.
      await expect(article, id).not.toContainText(
        /СЦЕНАРИЙ:|ОФОРМИТЬ ПРАВА ->|☐|Просчитать риски|можно ли здесь|здесь можно сделать|возможно стоит|если возможно|\(ссылка\)|\[ссылка\]|right\d/,
      );
      const notice = page.getByRole('complementary', { name: 'Обратите внимание' });
      await expect(notice.getByRole('button'), id).toHaveCount(2);
      await expect(notice, id).toContainText(relevance);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth),
        id,
      ).toBeLessThanOrEqual(390);

      const source = sources.get(id);
      if (!source) continue;
      const download = await request.get(`${API_URL}/api/materials/${id}/file`);
      expect(download.status(), id).toBe(200);
      expect(await download.body(), id).toEqual(await readFile(`../content/files/${source}`));
    }
  });
}
