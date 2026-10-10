import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { healthRoutes } from './routes/healthRoutes';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRoutes);

  // Must stay after all routes.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
