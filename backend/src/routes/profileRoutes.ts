import { Router } from 'express';

import { getProfile, updateProfile } from '../controllers/profileController';
import { requireAuth } from '../middlewares/requireAuth';

export const profileRoutes = Router();

profileRoutes.use(requireAuth);
profileRoutes.get('/', getProfile);
profileRoutes.patch('/', updateProfile);
