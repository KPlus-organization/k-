import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

/** Formats of content/objects.json and content/materials.json; see content/README.md. */
export interface ContentObject {
  id: string;
  title: string;
  description: string;
  published?: boolean;
}

type Run = { text: string };
export type ContentBlock =
  | { type: 'paragraph' | 'heading' | 'note'; runs: Run[]; anchor?: string }
  | { type: 'list'; items: Run[][] }
  | { type: 'table'; rows: Run[][][] }
  | { type: 'action'; text: string };

export interface ContentMaterial {
  id: string;
  topic: string | null;
  kind: 'article' | 'checklist' | 'reference';
  title: string;
  pageTitle?: string;
  description: string;
  /** `path` is relative to content/files/, `name` is offered to the user on download. */
  file?: { path: string; name: string };
  related?: string[];
  intro?: ContentBlock[];
  sections?: { id: string; title: string; toc: string; blocks: ContentBlock[] }[];
  published?: boolean;
}

export interface Content {
  objects: ContentObject[];
  materials: ContentMaterial[];
}

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const KINDS = ['article', 'checklist', 'reference'];
const FILE_NAME_PATTERN = /^[\w.-]+$/;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

async function readJsonArray(file: string): Promise<unknown[]> {
  const data: unknown = JSON.parse(await readFile(file, 'utf8'));
  if (!Array.isArray(data)) throw new Error(`${file} must contain a JSON array`);
  return data;
}

/**
 * Reads and validates the repository content. Throws one error listing every
 * problem, so that broken content fails the deploy or CI instead of being skipped.
 */
export async function loadContent(dir: string): Promise<Content> {
  const objects = (await readJsonArray(path.join(dir, 'objects.json'))) as ContentObject[];
  const materials = (await readJsonArray(path.join(dir, 'materials.json'))) as ContentMaterial[];
  const problems: string[] = [];

  const objectIds = new Set<string>();
  const publishedObjects = new Set<string>();
  objects.forEach((object, index) => {
    const where = `objects.json[${index}]`;
    if (!isNonEmptyString(object.id) || !ID_PATTERN.test(object.id)) {
      problems.push(`${where}: id must be lowercase latin letters, digits and "-"`);
    } else if (objectIds.has(object.id)) {
      problems.push(`${where}: duplicate id "${object.id}"`);
    }
    objectIds.add(object.id);
    if (object.published !== false) publishedObjects.add(object.id);
    if (!isNonEmptyString(object.title)) problems.push(`${where}: title is required`);
    if (!isNonEmptyString(object.description)) problems.push(`${where}: description is required`);
  });

  const materialIds = new Set(materials.map((material) => material.id));
  const seenMaterials = new Set<string>();
  materials.forEach((material, index) => {
    const where = `materials.json[${index}] "${material.id}"`;
    if (!isNonEmptyString(material.id) || !ID_PATTERN.test(material.id)) {
      problems.push(`${where}: id must be lowercase latin letters, digits and "-"`);
    } else if (seenMaterials.has(material.id)) {
      problems.push(`${where}: duplicate id`);
    }
    seenMaterials.add(material.id);

    if (material.topic !== null && !objectIds.has(material.topic)) {
      problems.push(`${where}: topic "${material.topic}" is not in objects.json`);
    } else if (material.topic !== null && material.published !== false && !publishedObjects.has(material.topic)) {
      problems.push(`${where}: published material belongs to unpublished object "${material.topic}"`);
    }
    if (!KINDS.includes(material.kind)) problems.push(`${where}: kind must be one of ${KINDS.join(', ')}`);
    if (!isNonEmptyString(material.title)) problems.push(`${where}: title is required`);
    if (!isNonEmptyString(material.description)) problems.push(`${where}: description is required`);

    for (const related of material.related ?? []) {
      if (!materialIds.has(related)) problems.push(`${where}: related material "${related}" does not exist`);
      if (related === material.id) problems.push(`${where}: a material cannot be related to itself`);
    }

    if (material.file !== undefined) {
      const { path: filePath, name } = material.file;
      if (!isNonEmptyString(filePath) || !FILE_NAME_PATTERN.test(filePath)) {
        problems.push(`${where}: file.path must be a plain file name inside content/files/`);
      } else if (!existsSync(path.join(dir, 'files', filePath))) {
        problems.push(`${where}: file content/files/${filePath} does not exist`);
      }
      if (!isNonEmptyString(name)) problems.push(`${where}: file.name is required`);
    }

    const sectionIds = new Set<string>();
    for (const section of material.sections ?? []) {
      if (!isNonEmptyString(section.id) || sectionIds.has(section.id)) {
        problems.push(`${where}: section ids must be present and unique`);
      }
      sectionIds.add(section.id);
    }
  });

  if (problems.length > 0) {
    throw new Error(`Invalid content in ${dir}:\n  - ${problems.join('\n  - ')}`);
  }
  return { objects, materials };
}
