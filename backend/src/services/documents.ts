import { readFile } from "node:fs/promises";
import path from "node:path";
import { Document, Packer, Paragraph, TextRun } from "docx";
import { pool } from "../config/db";
import { env } from "../config/env";
import { HttpError, type FieldIssue } from "../errors/HttpError";
import { bodyObject, throwIfIssues } from "../lib/validation";

export type Condition = Record<string, string | string[]>;
export type Values = Record<string, string>;
export interface TemplateField {
  id: string;
  group: string;
  label: string;
  type:
    | "text"
    | "textarea"
    | "email"
    | "tel"
    | "date"
    | "select"
    | "number"
    | "money";
  required: boolean;
  maxLength: number;
  min?: number;
  max?: number;
  pattern?: string;
  hint?: string;
  defaultValue?: string;
  when?: Condition;
  options?: { value: string; label: string; text?: string }[];
}
export interface DocumentTemplate {
  id: string;
  version: number;
  kind: "claim" | "contract";
  object: string;
  title: string;
  description: string;
  groups: { id: string; title: string; description: string }[];
  fields: TemplateField[];
  paragraphs: {
    text: string;
    heading?: boolean;
    when?: Condition;
    unless?: Condition;
  }[];
}

export function matches(
  condition: Condition | undefined,
  fields: Values,
): boolean {
  return (
    !condition ||
    Object.entries(condition).every(([key, expected]) =>
      expected === "*"
        ? Boolean(fields[key]?.trim())
        : Array.isArray(expected)
          ? expected.includes(fields[key] ?? "")
          : fields[key] === expected,
    )
  );
}

export async function getTemplate(id: string): Promise<DocumentTemplate> {
  if (id !== "code-claim")
    throw new HttpError(
      404,
      "DOCUMENT_TEMPLATE_NOT_FOUND",
      "Template not found",
    );
  return JSON.parse(
    await readFile(
      path.join(env.contentDir, "templates", "code-claim.json"),
      "utf8",
    ),
  ) as DocumentTemplate;
}

export function validateValues(
  template: DocumentTemplate,
  input: unknown,
  requireComplete: boolean,
): Values {
  const raw = bodyObject(input);
  const issues: FieldIssue[] = [];
  const values: Values = {};
  const ids = new Set(template.fields.map((field) => field.id));
  for (const key of Object.keys(raw)) {
    if (!ids.has(key))
      issues.push({ field: key, message: "Неизвестное поле." });
    else if (typeof raw[key] !== "string")
      issues.push({ field: key, message: "Ожидается текстовое значение." });
    else values[key] = (raw[key] as string).trim();
  }
  // Conditions refer to earlier fields. Removing inactive values also prevents stale
  // alternatives (e.g. an old compensation amount) from leaking into a saved document.
  for (const field of template.fields) {
    if (!matches(field.when, values)) {
      delete values[field.id];
      continue;
    }
    const value = values[field.id] ?? "";
    const issue = (message: string) =>
      issues.push({ field: field.id, message });
    if (!value) {
      if (requireComplete && field.required) issue("Заполните поле.");
      continue;
    }
    if (value.length > field.maxLength)
      issue(`Не более ${field.maxLength} символов.`);
    if (/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value))
      issue("Недопустимые управляющие символы.");
    if (
      field.options &&
      !field.options.some((option) => option.value === value)
    )
      issue("Выберите значение из списка.");
    if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value))
      issue("Укажите корректную электронную почту.");
    if (
      field.type === "date" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    )
      issue("Укажите корректную дату.");
    if (field.pattern && !new RegExp(field.pattern).test(value))
      issue(field.hint ?? "Проверьте формат.");
    if (field.type === "money" || field.type === "number") {
      const pattern = field.type === "money" ? /^\d+(?:\.\d{1,2})?$/ : /^\d+$/;
      const number = Number(value);
      if (!pattern.test(value) || !Number.isFinite(number))
        issue("Укажите неотрицательное число в правильном формате.");
      else if (
        number < (field.min ?? 0) ||
        number > (field.max ?? 1000000000000)
      )
        issue(
          `Допустимо от ${field.min ?? 0} до ${field.max ?? 1000000000000}.`,
        );
    }
  }
  if (values.applicantType === "company" && values.rightsBasis === "author")
    issues.push({
      field: "rightsBasis",
      message:
        "Личное авторство относится к физическому лицу. Выберите основание прав организации.",
    });
  throwIfIssues(issues);
  return values;
}

function complete(template: DocumentTemplate, fields: Values): boolean {
  try {
    validateValues(template, fields, true);
    return true;
  } catch {
    return false;
  }
}

export function renderDocument(
  template: DocumentTemplate,
  fields: Values,
): { text: string; heading?: boolean }[] {
  const amount = (value: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 2 }).format(value);
  const textFor = (id: string): string => {
    if (id === "totalAmount") {
      const cents = (key: string) => Math.round(Number(fields[key] ?? 0) * 100);
      const total =
        fields.moneyType === "losses"
          ? cents("damage") + cents("lostProfit")
          : fields.moneyType === "copies"
            ? cents("copiesCost") * 2
            : cents("licenseCost") * 2;
      return amount(total / 100);
    }
    const field = template.fields.find((item) => item.id === id);
    const value = fields[id];
    if (!value) return `[${field?.label ?? id}]`;
    const option = field?.options?.find((item) => item.value === value);
    if (option) return option.text ?? option.label;
    if (field?.type === "date") return value.split("-").reverse().join(".");
    if (field?.type === "money") return amount(Number(value));
    return value;
  };
  return template.paragraphs
    .filter(
      (p) =>
        matches(p.when, fields) && (!p.unless || !matches(p.unless, fields)),
    )
    .map((p) => ({
      text: p.text.replace(/\{\{([\w]+)\}\}/g, (_, id: string) => textFor(id)),
      ...(p.heading ? { heading: true } : {}),
    }));
}

export async function createDocx(
  template: DocumentTemplate,
  input: unknown,
): Promise<Buffer> {
  const fields = validateValues(template, input, true);
  const paragraphs = renderDocument(template, fields);
  return Packer.toBuffer(
    new Document({
      creator: "МоёПраво",
      title: template.title,
      styles: {
        default: {
          document: {
            run: { font: "Times New Roman", size: 24 },
            paragraph: { spacing: { after: 120, line: 276 } },
          },
        },
      },
      sections: [
        {
          properties: {
            page: {
              margin: { top: 1134, bottom: 1134, left: 1417, right: 1134 },
            },
          },
          children: paragraphs.map(
            (p) =>
              new Paragraph({
                keepNext: p.heading,
                children: p.text
                  .split("\n")
                  .map(
                    (line, index) =>
                      new TextRun({
                        text: line,
                        bold: Boolean(p.heading),
                        ...(index ? { break: 1 } : {}),
                      }),
                  ),
              }),
          ),
        },
      ],
    }),
  );
}

interface SavedRow {
  id: string;
  title: string;
  template_id: string;
  template_version: number;
  template: DocumentTemplate;
  fields: Values;
  complete: boolean;
  created_at: Date;
  updated_at: Date;
}
const toSummary = (row: SavedRow) => ({
  id: row.id,
  title: row.title,
  templateId: row.template_id,
  templateVersion: row.template_version,
  complete: row.complete,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
const uuid = (id: string) => {
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      id,
    )
  )
    throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found");
};
export async function listDocuments(userId: string) {
  const { rows } = await pool.query<SavedRow>(
    "SELECT id, title, template_id, template_version, complete, created_at, updated_at FROM saved_documents WHERE user_id=$1 ORDER BY updated_at DESC",
    [userId],
  );
  return rows.map(toSummary);
}
export async function getDocument(userId: string, id: string) {
  uuid(id);
  const { rows } = await pool.query<SavedRow>(
    "SELECT * FROM saved_documents WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  if (!rows[0])
    throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  return {
    ...toSummary(rows[0]),
    fields: rows[0].fields,
    template: rows[0].template,
  };
}
export async function saveDocument(userId: string, id: string, input: unknown) {
  uuid(id);
  const body = bodyObject(input);
  if (body.templateId !== "code-claim")
    throw new HttpError(
      404,
      "DOCUMENT_TEMPLATE_NOT_FOUND",
      "Template not found",
    );
  const existing = await pool.query<SavedRow>(
    "SELECT * FROM saved_documents WHERE id=$1 AND user_id=$2",
    [id, userId],
  );
  const template =
    existing.rows[0]?.template ?? (await getTemplate(body.templateId));
  if (body.templateVersion !== template.version)
    throw new HttpError(
      409,
      "DOCUMENT_VERSION_CHANGED",
      "Template version changed",
    );
  if (
    typeof body.title !== "string" ||
    !body.title.trim() ||
    body.title.trim().length > 160
  )
    throw new HttpError(400, "VALIDATION_ERROR", "Invalid title", {
      details: [
        {
          field: "title",
          message: "Название должно содержать от 1 до 160 символов.",
        },
      ],
    });
  const fields = validateValues(template, body.fields, false);
  const { rows } = await pool.query<SavedRow>(
    `INSERT INTO saved_documents (id,user_id,title,template_id,template_version,template,fields,complete)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     ON CONFLICT (id) DO UPDATE SET title=EXCLUDED.title, fields=EXCLUDED.fields, complete=EXCLUDED.complete, updated_at=now()
     WHERE saved_documents.user_id=EXCLUDED.user_id RETURNING *`,
    [
      id,
      userId,
      body.title.trim(),
      template.id,
      template.version,
      JSON.stringify(template),
      JSON.stringify(fields),
      complete(template, fields),
    ],
  );
  if (!rows[0])
    throw new HttpError(404, "DOCUMENT_NOT_FOUND", "Document not found");
  return {
    ...toSummary(rows[0]),
    fields: rows[0].fields,
    template: rows[0].template,
  };
}
export async function removeDocument(userId: string, id: string) {
  uuid(id);
  await pool.query("DELETE FROM saved_documents WHERE id=$1 AND user_id=$2", [
    id,
    userId,
  ]);
}
