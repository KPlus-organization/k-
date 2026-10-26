import { Router } from 'express';

import { getProfile, updateProfile, withdrawProfileConsent } from '../controllers/profileController';
import { requireAuth } from '../middlewares/requireAuth';

export const profileRoutes = Router();

profileRoutes.use(requireAuth);
profileRoutes.get('/', getProfile);
profileRoutes.patch('/', updateProfile);
profileRoutes.post('/consent/withdraw', withdrawProfileConsent);
