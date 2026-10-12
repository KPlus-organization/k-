import { Router } from 'express';

import { getMaterialById, getMaterials, getObjects, search } from '../controllers/contentController';

export const contentRoutes = Router();

contentRoutes.get('/objects', getObjects);
contentRoutes.get('/materials', getMaterials);
contentRoutes.get('/materials/:id', getMaterialById);
contentRoutes.get('/search', search);
