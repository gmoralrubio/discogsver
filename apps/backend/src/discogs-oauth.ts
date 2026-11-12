import { randomBytes, timingSafeEqual } from 'node:crypto';

import type { Request, Response } from 'express';

import { sampleDiscogsCandidates } from './discogs-candidates.js';
import {
  createDiscogsProvider,
  type FetchImplementation,
  type OAuthCredentials,
  type OAuthEnvironment,
} from './discogs-provider.js';
import { fetchSearchSample } from './discogs-search.js';

const cookieName = 'discogs_oauth_state';
const sessionCookieName = 'discogs_session';
const stateTtlMs = 5 * 60 * 1000;
const idleTtlMs = 30 * 60 * 1000;
const absoluteTtlMs = 8 * 60 * 60 * 1000;
const maxStates = 100;
const maxSessions = 100;

type PendingState = {
  browser: string;
  secret: string;
  expiresAt: number;
  validation: boolean;
  session: boolean;
  cancelled: boolean;
  processing: boolean;
};
type Session = {
  credentials: OAuthCredentials;
  createdAt: number;
  lastActivity: number;
  timer?: ReturnType<typeof setTimeout>;
};
type OAuthOptions = {
  env: OAuthEnvironment;
  fetchImpl: FetchImplementation;
  wait?: (milliseconds: number) => Promise<void>;
  now?: () => number;
};

function cookieValue(request: Request, name: string): string | undefined {
  return request.headers.cookie
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function equalSecret(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return (
    leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function createDiscogsOAuth({
  env: environment,
  fetchImpl,
  wait,
  now = () => Date.now(),
}: OAuthOptions) {
  const provider = createDiscogsProvider({ environment, fetchImpl });
  const pendingStates = new Map<string, PendingState>();
  const sessions = new Map<string, Session>();
  let inFlightConnections = 0;

  function secureCookie(): boolean {
    return environment.NODE_ENV === 'production';
  }

  function removeSession(id: string): void {
    const session = sessions.get(id);
    if (!session) return;
    if (session.timer) clearTimeout(session.timer);
    session.credentials.key = '';
    session.credentials.secret = '';
    sessions.delete(id);
  }

  function expireSessions(time = now()): void {
    for (const [id, session] of sessions) {
      if (
        session.lastActivity + idleTtlMs <= time ||
        session.createdAt + absoluteTtlMs <= time
      ) {
        removeSession(id);
      }
    }
  }

  function scheduleExpiry(id: string, session: Session): void {
    if (session.timer) clearTimeout(session.timer);
    const expiry = Math.min(
      session.lastActivity + idleTtlMs,
      session.createdAt + absoluteTtlMs,
    );
    session.timer = setTimeout(
      () => {
        if (sessions.get(id) !== session) return;
        if (expiry <= now()) removeSession(id);
        else scheduleExpiry(id, session);
      },
      Math.max(1, expiry - now()),
    );
    session.timer.unref?.();
  }

  function sameOrigin(request: Request, allowTopNavigation = false): boolean {
    const origin = request.headers.origin;
    const fetchSite = request.headers['sec-fetch-site'];
    if (fetchSite === 'cross-site') return false;
    if (!origin)
      return allowTopNavigation && (fetchSite === 'none' || fetchSite === 'same-origin');
    try {
      const parsed = new URL(origin);
      if (parsed.origin !== origin) return false;
      if (secureCookie())
        return request.secure && origin === `https://${request.headers.host}`;
      return (
        origin === `http://${request.headers.host}` ||
        origin === 'http://127.0.0.1:5173' ||
        origin === 'http://127.0.0.1:3100'
      );
    } catch {
      return false;
    }
  }

  function removeExpiredStates(time: number): void {
    for (const [token, state] of pendingStates) {
      if (state.expiresAt <= time && !state.processing) pendingStates.delete(token);
    }
  }

  function clearPendingCookie(response: Response): void {
    response.clearCookie(cookieName, {
      httpOnly: true,
      sameSite: 'lax',
      secure: secureCookie(),
      path: '/api/discogs',
    });
  }

  function cancelBrowserWork(browser: string | undefined): void {
    if (!browser) return;
    for (const state of pendingStates.values()) {
      if (equalSecret(state.browser, browser)) state.cancelled = true;
    }
  }

  return {
    async connect(request: Request, response: Response): Promise<void> {
      const sessionMode = request.query.session === '1';
      const validationMode = request.query.validation === 'candidates';
      if (
        (sessionMode && secureCookie() && !request.secure) ||
        (sessionMode && (!sameOrigin(request, true) || validationMode)) ||
        (validationMode &&
          request.query.session !== undefined &&
          request.query.session !== '0')
      ) {
        response.status(403).json({ error: 'Request rejected' });
        return;
      }
      if (!provider.configured) {
        response.status(503).json({ error: 'Discogs OAuth is not configured' });
        return;
      }

      const configuredEndpoints = provider.getEndpoints();
      const startedAt = now();
      removeExpiredStates(startedAt);
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
          expiresAt: startedAt + stateTtlMs,
          validation: validationMode,
          session: sessionMode,
          cancelled: false,
          processing: false,
        });
        response.cookie(cookieName, browser, {
          httpOnly: true,
          sameSite: 'lax',
          secure: secureCookie(),
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
      const browser = cookieValue(request, cookieName);
      const matchesBrowser = Boolean(
        state && browser && equalSecret(browser, state.browser),
      );
      if (state?.session && secureCookie() && !request.secure) {
        response.status(403).json({ error: 'Request rejected' });
        return;
      }
      const valid = Boolean(
        token &&
        verifier &&
        !request.query.denied &&
        state &&
        state.expiresAt > now() &&
        !state.processing &&
        matchesBrowser,
      );
      if (state?.processing) {
        if (state.session && matchesBrowser) state.cancelled = true;
      } else if (state && !valid) {
        state.secret = '';
        pendingStates.delete(token);
      }
      clearPendingCookie(response);
      if (!provider.configured || !state || !valid) {
        response.status(400).json({ error: 'OAuth callback rejected' });
        return;
      }

      state.processing = true;
      try {
        const accessCredentials = await provider.exchangeToken(
          provider.getEndpoints(),
          { key: token, secret: state.secret },
          verifier,
        );
        if (!accessCredentials) {
          response.status(502).json({ error: 'Discogs OAuth exchange failed' });
          return;
        }
        if (state.cancelled || pendingStates.get(token) !== state) {
          accessCredentials.key = '';
          accessCredentials.secret = '';
          response.status(400).json({ error: 'OAuth callback rejected' });
          return;
        }

        if (state.session) {
          expireSessions();
          const oldId = cookieValue(request, sessionCookieName);
          const ownedSession = oldId ? sessions.get(oldId) : undefined;
          if (sessions.size - (ownedSession ? 1 : 0) >= maxSessions) {
            accessCredentials.key = '';
            accessCredentials.secret = '';
            response.status(503).json({ error: 'Session capacity reached' });
            return;
          }
          if (oldId) removeSession(oldId);
          const id = randomBytes(32).toString('hex');
          const time = now();
          const session: Session = {
            credentials: accessCredentials,
            createdAt: time,
            lastActivity: time,
          };
          sessions.set(id, session);
          scheduleExpiry(id, session);
          response.cookie(sessionCookieName, id, {
            httpOnly: true,
            sameSite: 'lax',
            secure: secureCookie(),
            path: '/api/discogs',
            maxAge: absoluteTtlMs,
          });
          response.json({ connected: true });
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
      } finally {
        state.secret = '';
        pendingStates.delete(token);
      }
    },

    sessionStatus(request: Request, response: Response): void {
      response.setHeader('Cache-Control', 'no-store');
      if (
        (secureCookie() && !request.secure) ||
        request.headers['sec-fetch-site'] === 'cross-site' ||
        (request.headers.origin && !sameOrigin(request))
      ) {
        response.status(403).json({ error: 'Request rejected' });
        return;
      }
      expireSessions();
      const id = cookieValue(request, sessionCookieName);
      const session = id ? sessions.get(id) : undefined;
      const time = now();
      if (
        !session ||
        session.lastActivity + idleTtlMs <= time ||
        session.createdAt + absoluteTtlMs <= time
      ) {
        if (id) removeSession(id);
        response.json({ connected: false });
        return;
      }
      session.lastActivity = time;
      scheduleExpiry(id!, session);
      response.json({ connected: true });
    },

    disconnect(request: Request, response: Response): void {
      if (!sameOrigin(request)) {
        response.status(403).json({ error: 'Request rejected' });
        return;
      }
      const sessionId = cookieValue(request, sessionCookieName);
      const pendingBrowser = cookieValue(request, cookieName);
      if (sessionId) removeSession(sessionId);
      cancelBrowserWork(pendingBrowser);
      clearPendingCookie(response);
      response.clearCookie(sessionCookieName, {
        httpOnly: true,
        sameSite: 'lax',
        secure: secureCookie(),
        path: '/api/discogs',
      });
      response.json({ connected: false });
    },
  };
}
