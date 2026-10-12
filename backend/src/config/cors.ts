import type { CorsOptions } from 'cors';

import { env } from './env';

export const corsOptions: CorsOptions = {
  // Requests from origins not in the list get no Access-Control-Allow-Origin
  // header and are blocked by the browser.
  origin: env.frontendOrigins,
  // Authentication uses the Authorization header (JWT), not cookies,
  // so credentialed CORS is not needed.
  credentials: false,
  allowedHeaders: ['Content-Type', 'Authorization'],
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  maxAge: 600,
};
