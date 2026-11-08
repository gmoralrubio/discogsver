import express, { type Request, type Response } from 'express';

import { createDiscogsOAuth } from './discogs-oauth.js';
import type { FetchImplementation, OAuthEnvironment } from './discogs-provider.js';

type AppOptions = { env?: OAuthEnvironment; fetchImpl?: FetchImplementation };

export function createApp(options: AppOptions = {}) {
  const app = express();
  const oauth = createDiscogsOAuth({
    env: options.env ?? process.env,
    fetchImpl: options.fetchImpl ?? fetch,
  });

  app.get('/api/health', (_request: Request, response: Response) => {
    response.json({ status: 'ok' });
  });

  app.get('/api/discogs/connect', (request: Request, response: Response) => {
    oauth
      .connect(request, response)
      .catch(() => response.status(502).json({ error: 'Discogs OAuth request failed' }));
  });

  app.get('/api/discogs/callback', (request: Request, response: Response) => {
    oauth
      .callback(request, response)
      .catch(() => response.status(502).json({ error: 'Discogs OAuth request failed' }));
  });

  return app;
}
