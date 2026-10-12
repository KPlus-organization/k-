import type { Request, Response } from 'express';

import { authUserId } from '../middlewares/requireAuth';
import { addFavorite, listFavorites, removeFavorite } from '../services/favorites';

export async function getFavorites(req: Request, res: Response): Promise<void> {
  res.status(200).json({ items: await listFavorites(authUserId(req)) });
}

export async function putFavorite(req: Request<{ materialId: string }>, res: Response): Promise<void> {
  await addFavorite(authUserId(req), req.params.materialId);
  res.status(204).end();
}

export async function deleteFavorite(req: Request<{ materialId: string }>, res: Response): Promise<void> {
  await removeFavorite(authUserId(req), req.params.materialId);
  res.status(204).end();
}
