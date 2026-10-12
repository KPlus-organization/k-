import { Router } from 'express';

import { getHistory, postHistory } from '../controllers/historyController';
import { requireAuth } from '../middlewares/requireAuth';

export const historyRoutes = Router();

historyRoutes.use(requireAuth);
historyRoutes.get('/', getHistory);
historyRoutes.post('/', postHistory);
