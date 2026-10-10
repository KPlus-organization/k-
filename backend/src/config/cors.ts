import type { CorsOptions } from 'cors';

import { env } from './env';

export const corsOptions: CorsOptions = {
  // A single allowed origin; requests from other origins get no matching
  // Access-Control-Allow-Origin header and are blocked by the browser.
  origin: env.frontendOrigin,
  credentials: true,
};
