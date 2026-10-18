export type Condition = Record<string, string | string[]>;
export type DocumentValues = Record<string, string>;
export type TemplateField = {
  id: string;
  group: string;
  label: string;
  type: 'text' | 'textarea' | 'email' | 'tel' | 'date' | 'select' | 'number' | 'money';
  required: boolean;
  maxLength: number;
  min?: number;
  max?: number;
  pattern?: string;
  hint?: string;
  defaultValue?: string;
  when?: Condition;
  options?: { value: string; label: string; text?: string }[];
};
export type TemplateSummary = {
  id: string;
  title: string;
  kind: 'claim' | 'contract';
  object: string;
  version: number;
};
export type DocumentTemplate = TemplateSummary & {
  description: string;
  groups: { id: string; title: string; description: string }[];
  fields: TemplateField[];
  paragraphs: { text: string; heading?: boolean; when?: Condition; unless?: Condition }[];
};
export type SavedDocumentSummary = {
  id: string;
  title: string;
  templateId: string;
  templateVersion: number;
  complete: boolean;
  createdAt: string;
  updatedAt: string;
};
export type SavedDocument = SavedDocumentSummary & {
  fields: DocumentValues;
  template: DocumentTemplate;
};
