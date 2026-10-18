// Types of the content API; see docs/api.md, "Типы данных".

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

export type ProtectionObject = {
  id: string;
  title: string;
  description: string;
  materialsCount: number;
};

export type MaterialKind = 'article' | 'checklist' | 'reference';

export type MaterialSummary = {
  id: string;
  topic: string | null;
  kind: MaterialKind;
  title: string;
  description: string;
  /** False for announced materials whose full text is not published yet. */
  hasContent: boolean;
  stepsCount: number;
};

export type Material = MaterialSummary & {
  pageTitle: string;
  /** `url` is relative to the API base URL. */
  download: { fileName: string; url: string } | null;
  related: MaterialSummary[];
  intro: ContentBlock[];
  sections: { id: string; title: string; toc: string; blocks: ContentBlock[] }[];
};

export type SearchResult = {
  query: string;
  objects: ProtectionObject[];
  materials: MaterialSummary[];
};

export const materialLabels = {
  article: 'Статья',
  checklist: 'Чек-лист',
  reference: 'Памятка',
} as const;
