import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { Request, Response } from 'express';

import { sampleDiscogsCandidates } from './discogs-candidates.js';
import {
  createDiscogsProvider,
  type FetchImplementation,
  type OAuthEnvironment,
} from './discogs-provider.js';
import { fetchSearchSample } from './discogs-search.js';

const cookieName = 'discogs_oauth_state';
const stateTtlMs = 5 * 60 * 1000;
const maxStates = 100;

type PendingState = {
  browser: string;
  secret: string;
  expiresAt: number;
  validation: boolean;
};
type OAuthOptions = {
  env: OAuthEnvironment;
  fetchImpl: FetchImplementation;
  wait?: (milliseconds: number) => Promise<void>;
};

function cookieValue(request: Request): string | undefined {
  const header = request.headers.cookie;
  if (!header) return undefined;
  const item = header
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${cookieName}=`));
  return item?.slice(cookieName.length + 1);
}

function equalSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createDiscogsOAuth({ env: environment, fetchImpl, wait }: OAuthOptions) {
  const provider = createDiscogsProvider({ environment, fetchImpl });
  const pendingStates = new Map<string, PendingState>();
  let inFlightConnections = 0;

  function removeExpiredStates(now: number): void {
    for (const [token, state] of pendingStates) {
      if (state.expiresAt <= now) pendingStates.delete(token);
    }
  }

  return {
    async connect(request: Request, response: Response): Promise<void> {
      if (!provider.configured) {
        response.status(503).json({ error: 'Discogs OAuth is not configured' });
        return;
      }

      const configuredEndpoints = provider.getEndpoints();
      const now = Date.now();
      removeExpiredStates(now);

      if (pendingStates.size + inFlightConnections >= maxStates) {
        response.status(503).json({ error: 'OAuth connection capacity reached' });
        return;
      }
      inFlightConnections += 1;

      try {
        const temporaryToken = await provider.requestToken(configuredEndpoints);

        if (!temporaryToken) {
          response.status(502).json({ error: 'Discogs OAuth request failed' });
          return;
        }

        const browser = randomBytes(32).toString('hex');
        pendingStates.set(temporaryToken.token, {
          browser,
          secret: temporaryToken.secret,
          expiresAt: now + stateTtlMs,
          validation: request.query.validation === 'candidates',
        });

        response.cookie(cookieName, browser, {
          httpOnly: true,
          sameSite: 'lax',
          secure: false,
          path: '/api/discogs',
          maxAge: stateTtlMs,
        });

        response.redirect(
          302,
          provider.authorizationUrl(configuredEndpoints, temporaryToken.token),
        );
      } finally {
        inFlightConnections -= 1;
      }
    },

    async callback(request: Request, response: Response): Promise<void> {
      const token =
        typeof request.query.oauth_token === 'string' ? request.query.oauth_token : '';

      const verifier =
        typeof request.query.oauth_verifier === 'string'
          ? request.query.oauth_verifier
          : '';

      const state = pendingStates.get(token);
      const browserCookie = cookieValue(request);

      if (state) pendingStates.delete(token);

      response.clearCookie(cookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: false,
        path: '/api/discogs',
      });

      const hasRequiredQuery = Boolean(token && verifier && !request.query.denied);
      const hasActiveState = Boolean(state && state.expiresAt > Date.now());
      const matchesBrowser = Boolean(
        hasActiveState &&
        state &&
        browserCookie &&
        equalSecret(browserCookie, state.browser),
      );
      const isValidCallback = hasRequiredQuery && hasActiveState && matchesBrowser;

      if (!provider.configured || !state || !isValidCallback) {
        response.status(400).json({ error: 'OAuth callback rejected' });
        return;
      }

      const configuredEndpoints = provider.getEndpoints();
      const accessCredentials = await provider.exchangeToken(
        configuredEndpoints,
        { key: token, secret: state.secret },
        verifier,
      );

      if (!accessCredentials) {
        response.status(502).json({ error: 'Discogs OAuth exchange failed' });
        return;
      }

      if (state.validation) {
        const report = await sampleDiscogsCandidates(
          fetchImpl,
          provider.client(),
          accessCredentials,
          wait,
        );
        response.json({ connected: true, validation: report });
        return;
      }

      const sample = await fetchSearchSample(
        fetchImpl,
        provider.client(),
        accessCredentials,
      );

      if (!sample) {
        response.status(502).json({ error: 'Discogs authenticated read failed' });
        return;
      }

      response.json({ connected: true, sample });
    },
  };
}
