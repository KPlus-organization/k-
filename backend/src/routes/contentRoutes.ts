import { Router } from 'express';

import {
  downloadMaterialFile,
  getMaterialById,
  getMaterials,
  getObjects,
  search,
} from '../controllers/contentController';

export const contentRoutes = Router();

contentRoutes.get('/objects', getObjects);
contentRoutes.get('/materials', getMaterials);
contentRoutes.get('/materials/:id', getMaterialById);
contentRoutes.get('/materials/:id/file', downloadMaterialFile);
contentRoutes.get('/search', search);
