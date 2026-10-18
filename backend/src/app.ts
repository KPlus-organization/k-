import cors from 'cors';
import express from 'express';

import { corsOptions } from './config/cors';
import { errorHandler } from './middlewares/errorHandler';
import { notFound } from './middlewares/notFound';
import { authRoutes } from './routes/authRoutes';
import { contentRoutes } from './routes/contentRoutes';
import { favoritesRoutes } from './routes/favoritesRoutes';
import { feesRoutes } from './routes/feesRoutes';
import { healthRoutes } from './routes/healthRoutes';
import { historyRoutes } from './routes/historyRoutes';
import { profileRoutes } from './routes/profileRoutes';
import { documentsRoutes, templateRoutes } from './routes/documentsRoutes';

export function createApp(): express.Express {
  const app = express();

  app.disable('x-powered-by');

  app.use(cors(corsOptions));
  app.use(express.json({ limit: '100kb' }));

  app.use(healthRoutes);
  app.use('/api', contentRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/profile', profileRoutes);
  app.use('/api/favorites', favoritesRoutes);
  app.use('/api/history', historyRoutes);
  app.use('/api/fees', feesRoutes);
  app.use('/api/document-templates', templateRoutes);
  app.use('/api/documents', documentsRoutes);

  // Must stay after all routes.
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
