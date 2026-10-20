import type { Request, Response } from 'express';

import { HttpError } from '../errors/HttpError';
import { getMaterial, getMaterialFile, listMaterials, listObjects } from '../services/content';

const MAX_QUERY_LENGTH = 200;

function singleQueryParam(req: Request, name: string): string | undefined {
  const value = req.query[name];
  if (value === undefined) return undefined;
  if (typeof value !== 'string') {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [{ field: name, message: 'Must be a single string value' }],
    });
  }
  return value;
}

export async function getObjects(_req: Request, res: Response): Promise<void> {
  res.status(200).json({ items: await listObjects() });
}

export async function getMaterials(req: Request, res: Response): Promise<void> {
  const topic = singleQueryParam(req, 'topic')?.trim() || undefined;
  res.status(200).json({ items: await listMaterials({ topic }) });
}

export async function getMaterialById(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.status(200).json(await getMaterial(req.params.id));
}

export async function downloadMaterialFile(req: Request<{ id: string }>, res: Response): Promise<void> {
  const file = await getMaterialFile(req.params.id);
  // Sets Content-Disposition: attachment with the original (UTF-8) file name.
  await new Promise<void>((resolve, reject) => {
    res.download(file.path, file.name, (err) => (err ? reject(err) : resolve()));
  });
}

export async function search(req: Request, res: Response): Promise<void> {
  const query = singleQueryParam(req, 'q')?.trim() ?? '';
  if (query.length > MAX_QUERY_LENGTH) {
    throw new HttpError(400, 'VALIDATION_ERROR', 'Request validation failed', {
      details: [{ field: 'q', message: `Must be at most ${MAX_QUERY_LENGTH} characters` }],
    });
  }
  if (!query) {
    res.status(200).json({ query, objects: [], materials: [] });
    return;
  }

  const [objects, materials] = await Promise.all([listObjects(query), listMaterials({ query })]);
  res.status(200).json({ query, objects, materials });
}
