import content from './materials.json';

export type TextRun = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  href?: string;
  action?: string;
};
export type ContentBlock =
  | { type: 'paragraph' | 'heading' | 'note'; runs: TextRun[] }
  | { type: 'list'; ordered: boolean; items: TextRun[][] }
  | { type: 'table'; rows: TextRun[][][] }
  | { type: 'action'; text: string; action: string };
export type Material = {
  id: string;
  topic: string;
  title: string;
  pageTitle: string;
  description: string;
  kind: 'article' | 'checklist' | 'reference';
  href: string;
  sourceFile: string;
  download: string;
  related: string[];
  intro: ContentBlock[];
  sections: { id: string; title: string; toc: string; blocks: ContentBlock[] }[];
};

export const materials = content as Material[];
export const materialLabels = {
  article: 'Статья',
  checklist: 'Чек-лист',
  reference: 'Памятка',
} as const;

function blockText(block: ContentBlock): string {
  if ('runs' in block) return block.runs.map((run) => run.text).join('');
  if (block.type === 'list')
    return block.items
      .flat()
      .map((run) => run.text)
      .join(' ');
  if (block.type === 'table')
    return block.rows
      .flat(2)
      .map((run) => run.text)
      .join(' ');
  return block.text;
}

export const materialSearchText = Object.fromEntries(
  materials.map((material) => [
    material.id,
    [
      material.title,
      material.description,
      ...material.intro.map(blockText),
      ...material.sections.flatMap((section) => [section.title, ...section.blocks.map(blockText)]),
    ]
      .join(' ')
      .toLocaleLowerCase('ru'),
  ]),
);
