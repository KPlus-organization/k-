import { Router } from 'express';

import { calculateFee, getFeeScheduleById, getFeeSchedules } from '../controllers/feesController';

export const feesRoutes = Router();

feesRoutes.get('/', getFeeSchedules);
feesRoutes.get('/:id', getFeeScheduleById);
feesRoutes.post('/:id/calculate', calculateFee);
