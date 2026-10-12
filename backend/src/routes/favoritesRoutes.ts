import { Router } from 'express';

import { deleteFavorite, getFavorites, putFavorite } from '../controllers/favoritesController';
import { requireAuth } from '../middlewares/requireAuth';

export const favoritesRoutes = Router();

favoritesRoutes.use(requireAuth);
favoritesRoutes.get('/', getFavorites);
favoritesRoutes.put('/:materialId', putFavorite);
favoritesRoutes.delete('/:materialId', deleteFavorite);
