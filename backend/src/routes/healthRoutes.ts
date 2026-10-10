import { Router } from 'express';

import { getHealth, getRoot } from '../controllers/healthController';

export const healthRoutes = Router();

healthRoutes.get('/', getRoot);
healthRoutes.get('/api/health', getHealth);
