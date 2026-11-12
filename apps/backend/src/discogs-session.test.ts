import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import type { IncomingHttpHeaders } from 'node:http';
import { createServer as createHttpsServer, request as httpsRequest } from 'node:https';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { environment, requestUrl, startApp, stopServer } from './app-test-support.js';
import { createApp } from './app.js';

const requestToken =
  'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true';

function tlsRequest(
  url: string,
  options: { method?: string; headers?: Record<string, string> } = {},
): Promise<{ status: number; headers: IncomingHttpHeaders; body: string }> {
  return new Promise((resolve, reject) => {
    const request = httpsRequest(
      url,
      { ...options, rejectUnauthorized: false },
      (response) => {
        let body = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (body += chunk));
        response.on('end', () =>
          resolve({ status: response.statusCode ?? 0, headers: response.headers, body }),
        );
      },
    );
    request.on('error', reject);
    request.end();
  });
}

function provider() {
  return vi.fn(async (input: URL | RequestInfo) => {
    const url = requestUrl(input);
    if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
    if (url.endsWith('/oauth/access_token'))
      return new Response('oauth_token=access-token&oauth_token_secret=access-secret');
    return Response.json({ results: [] });
  });
}

describe('Discogs browser session HTTP contract', () => {
  afterEach(() => vi.useRealTimers());

  it('creates an opaque session on opt-in callback; status and disconnect are browser-bound', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      expect(callback.status).toBe(200);
      expect(await callback.json()).toEqual({ connected: true });
      const cookieHeader = callback.headers.get('set-cookie')!;
      expect(cookieHeader).toContain('discogs_session=');
      expect(cookieHeader).toContain('HttpOnly');
      expect(cookieHeader).toContain('SameSite=Lax');
      expect(cookieHeader).toContain('Path=/api/discogs');
      expect(cookieHeader).not.toContain('Secure');
      expect(cookieHeader).not.toContain('access-token');
      const sessionCookie = cookieHeader.match(/discogs_session=[a-f0-9]{64}/)?.[0] ?? '';
      const status = await fetch(`${baseUrl}/api/discogs/session`, {
        headers: { cookie: sessionCookie },
      });
      expect(await status.json()).toEqual({ connected: true });
      expect(status.headers.get('cache-control')).toBe('no-store');
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: 'discogs_session=other' },
          })
        ).json(),
      ).toEqual({ connected: false });
      const rejected = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { cookie: sessionCookie, origin: 'https://attacker.invalid' },
      });
      expect(rejected.status).toBe(403);
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      const removed = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { cookie: sessionCookie, origin: baseUrl },
      });
      expect(removed.status).toBe(200);
      expect(await removed.json()).toEqual({ connected: false });
      const repeated = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { cookie: sessionCookie, origin: baseUrl },
      });
      expect(repeated.status).toBe(200);
      expect(await repeated.json()).toEqual({ connected: false });
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(server);
    }
  });

  it('rejects cross-site and conflicting session connect modes before provider requests', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const crossSite = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
      });
      expect(crossSite.status).toBe(403);
      expect(await crossSite.json()).toEqual({ error: 'Request rejected' });
      const conflicting = await fetch(
        `${baseUrl}/api/discogs/connect?session=1&validation=candidates`,
        {
          redirect: 'manual',
          headers: { origin: baseUrl },
        },
      );
      expect(conflicting.status).toBe(403);
      expect(await conflicting.json()).toEqual({ error: 'Request rejected' });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it.each([
    ['default proof', '', 'sample'],
    ['candidate proof', '?validation=candidates', 'validation'],
  ] as const)(
    'keeps the original %s callback successful after a same-browser replay',
    async (mode, query, resultKey) => {
      let resolveExchange!: (response: Response) => void;
      const calls: string[] = [];
      const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
        const url = requestUrl(input);
        calls.push(url);
        if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
        if (url.endsWith('/oauth/access_token'))
          return new Promise<Response>((resolve) => {
            resolveExchange = resolve;
          });
        if (url.includes('/database/search'))
          return Response.json({ results: [{ id: 42 }] });
        if (url.includes('/releases/'))
          return Response.json({ tracklist: [], videos: [] });
        return Response.json({ results: [] });
      });
      const { baseUrl, server } = await startApp(fetchImpl, undefined, async () => {});

      try {
        const begin = await fetch(`${baseUrl}/api/discogs/connect${query}`, {
          redirect: 'manual',
        });
        const state = new URL(begin.headers.get('location')!).searchParams.get(
          'oauth_token',
        );
        const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
        const callbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`;
        const callbackRequest = fetch(callbackUrl, {
          headers: { cookie: pendingCookie },
        });
        await vi.waitFor(() => expect(resolveExchange).toBeTypeOf('function'));
        const replay = await fetch(callbackUrl, { headers: { cookie: pendingCookie } });
        expect(replay.status).toBe(400);
        expect(await replay.json()).toEqual({ error: 'OAuth callback rejected' });
        expect(replay.headers.get('set-cookie')).toContain('discogs_oauth_state=;');
        expect(calls).toHaveLength(2);
        resolveExchange(
          new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
        );
        const callback = await callbackRequest;
        expect(callback.status).toBe(200);
        const result = await callback.json();
        expect(result.connected).toBe(true);
        expect(result[resultKey]).toBeDefined();
        if (mode === 'default proof') {
          expect(result).toEqual({
            connected: true,
            sample: { resultCount: 1, firstReleaseId: 42 },
          });
          expect(calls).toHaveLength(3);
        } else {
          expect(result.validation).toMatchObject({
            dataRequests: 6,
            categories: [{ name: 'Reggae' }, { name: 'Techno' }, { name: 'Punk' }],
          });
          expect(calls).toHaveLength(8);
        }
        expect(callback.headers.get('set-cookie')).not.toContain('discogs_session=');
        expect(JSON.stringify(result)).not.toContain('access-secret');
        expect(JSON.stringify(result)).not.toContain('access-token');
      } finally {
        if (resolveExchange)
          resolveExchange(
            new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
          );
        await stopServer(server);
      }
    },
  );

  it('does not restore a session after replay clears the pending browser cookie', async () => {
    let resolveExchange!: (response: Response) => void;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
      if (url.endsWith('/oauth/access_token'))
        return new Promise<Response>((resolve) => {
          resolveExchange = resolve;
        });
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      let cookieJar = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`;
      const callbackRequest = fetch(callbackUrl, { headers: { cookie: cookieJar } });
      await vi.waitFor(() => expect(resolveExchange).toBeTypeOf('function'));
      const replay = await fetch(callbackUrl, { headers: { cookie: cookieJar } });
      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual({ error: 'OAuth callback rejected' });
      if (replay.headers.get('set-cookie')?.startsWith('discogs_oauth_state=;'))
        cookieJar = '';
      const disconnected = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: baseUrl, ...(cookieJar ? { cookie: cookieJar } : {}) },
      });
      expect(disconnected.status).toBe(200);
      expect(await disconnected.json()).toEqual({ connected: false });
      resolveExchange(
        new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
      );
      const callback = await callbackRequest;
      expect(callback.status).toBe(400);
      expect(await callback.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(callback.headers.get('set-cookie')).not.toContain('discogs_session=');
      expect(await (await fetch(`${baseUrl}/api/discogs/session`)).json()).toEqual({
        connected: false,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(server);
    }
  });

  it('consumes a rejected default OAuth callback so its token cannot be retried', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const originalCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`;
      const rejected = await fetch(callbackUrl, {
        headers: { cookie: 'discogs_oauth_state=wrong', 'sec-fetch-site': 'cross-site' },
      });
      expect(rejected.status).toBe(400);
      expect(await rejected.json()).toEqual({ error: 'OAuth callback rejected' });
      const retry = await fetch(callbackUrl, { headers: { cookie: originalCookie } });
      expect(retry.status).toBe(400);
      expect(await retry.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server);
    }
  });

  it('does not restore a session when disconnect races the access-token exchange', async () => {
    let resolveExchange!: (response: Response) => void;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
      if (url.endsWith('/oauth/access_token'))
        return new Promise<Response>((resolve) => {
          resolveExchange = resolve;
        });
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callbackRequest = fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      await vi.waitFor(() => expect(resolveExchange).toBeTypeOf('function'));
      const disconnected = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: baseUrl, cookie: pendingCookie },
      });
      expect(disconnected.status).toBe(200);
      resolveExchange(
        new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
      );
      const callback = await callbackRequest;
      expect(callback.status).toBe(400);
      expect(await callback.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(await (await fetch(`${baseUrl}/api/discogs/session`)).json()).toEqual({
        connected: false,
      });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(server);
    }
  });

  it('serializes concurrent session creation at the 100-session limit', async () => {
    let nextToken = 0;
    let exchangesStarted = 0;
    const resolveExchanges: Array<(response: Response) => void> = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) {
        nextToken += 1;
        return new Response(
          `oauth_token=request-${nextToken}&oauth_token_secret=secret-${nextToken}&oauth_callback_confirmed=true`,
        );
      }
      if (url.endsWith('/oauth/access_token')) {
        exchangesStarted += 1;
        return new Promise<Response>((resolve) => resolveExchanges.push(resolve));
      }
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const starts = await Promise.all(
        Array.from({ length: 100 }, async () => {
          const response = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
            redirect: 'manual',
            headers: { origin: baseUrl },
          });
          return {
            state: new URL(response.headers.get('location')!).searchParams.get(
              'oauth_token',
            )!,
            cookie: response.headers.get('set-cookie')!.split(';')[0]!,
          };
        }),
      );
      const callbacks = starts.map(({ state, cookie }) =>
        fetch(
          `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
          {
            headers: { cookie },
          },
        ),
      );
      await vi.waitFor(() => expect(exchangesStarted).toBe(100));
      for (const resolve of resolveExchanges) {
        resolve(
          new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
        );
      }
      const responses = await Promise.all(callbacks);
      expect(responses.every((response) => response.status === 200)).toBe(true);
      const cookies = responses.map(
        (response) =>
          response.headers
            .get('set-cookie')!
            .match(/discogs_session=[a-f0-9]{64}/)?.[0] ?? '',
      );
      const statuses = await Promise.all(
        cookies.map((cookie) =>
          fetch(`${baseUrl}/api/discogs/session`, { headers: { cookie } }),
        ),
      );
      expect(
        (await Promise.all(statuses.map((response) => response.json()))).every(
          (body) => JSON.stringify(body) === '{"connected":true}',
        ),
      ).toBe(true);
      expect(fetchImpl).toHaveBeenCalledTimes(200);
    } finally {
      await stopServer(server);
    }
  });

  it('does not let a cross-origin disconnect cancel an in-flight callback', async () => {
    let resolveExchange!: (response: Response) => void;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
      if (url.endsWith('/oauth/access_token'))
        return new Promise<Response>((resolve) => {
          resolveExchange = resolve;
        });
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callbackRequest = fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      await vi.waitFor(() => expect(resolveExchange).toBeTypeOf('function'));
      const rejected = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: 'https://attacker.invalid', cookie: pendingCookie },
      });
      expect(rejected.status).toBe(403);
      resolveExchange(
        new Response('oauth_token=access-token&oauth_token_secret=access-secret'),
      );
      const callback = await callbackRequest;
      expect(callback.status).toBe(200);
      expect(await callback.json()).toEqual({ connected: true });
      expect(callback.headers.get('set-cookie')).toContain('discogs_session=');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(server);
    }
  });

  it('caps active sessions at 100 and recovers capacity after disconnect', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl);

    async function connect(
      previousCookie = '',
    ): Promise<{ callback: Response; cookie: string }> {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: {
          origin: baseUrl,
          ...(previousCookie ? { cookie: previousCookie } : {}),
        },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        {
          headers: {
            cookie: [pendingCookie, previousCookie].filter(Boolean).join('; '),
          },
        },
      );
      const cookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      return { callback, cookie };
    }

    try {
      const sessions: string[] = [];
      for (let index = 0; index < 100; index += 1) {
        const { callback, cookie } = await connect();
        expect(callback.status).toBe(200);
        sessions.push(cookie);
      }
      const replaced = await connect(sessions[0]!);
      expect(replaced.callback.status).toBe(200);
      expect(replaced.cookie).not.toBe(sessions[0]);
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: sessions[0]! },
          })
        ).json(),
      ).toEqual({ connected: false });
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: replaced.cookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      const full = await connect();
      expect(full.callback.status).toBe(503);
      expect(await full.callback.json()).toEqual({ error: 'Session capacity reached' });
      const disconnected = await fetch(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: baseUrl, cookie: sessions[1]! },
      });
      expect(disconnected.status).toBe(200);
      const recovered = await connect();
      expect(recovered.callback.status).toBe(200);
      expect(recovered.cookie).not.toBe(sessions[1]);
    } finally {
      await stopServer(server);
    }
  });

  it('loses the session cookie when a new app instance starts', async () => {
    const fetchImpl = provider();
    const first = await startApp(fetchImpl);
    const second = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${first.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: first.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${first.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      expect(
        await (
          await fetch(`${first.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      expect(
        await (
          await fetch(`${second.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
    } finally {
      await stopServer(first.server);
      await stopServer(second.server);
    }
  });

  it('binds session mode to connect state and rejects callback replay', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved&session=1`;
      const callback = await fetch(callbackUrl, { headers: { cookie: pendingCookie } });
      expect(await callback.json()).toEqual({
        connected: true,
        sample: { resultCount: 0, firstReleaseId: null },
      });
      expect(callback.headers.get('set-cookie')).not.toContain('discogs_session=');
      const replay = await fetch(callbackUrl, { headers: { cookie: pendingCookie } });
      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);

      const sessionBegin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const sessionState = new URL(
        sessionBegin.headers.get('location')!,
      ).searchParams.get('oauth_token');
      const sessionPendingCookie = sessionBegin.headers.get('set-cookie')!.split(';')[0]!;
      const sessionCallbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${sessionState}&oauth_verifier=approved&session=0&validation=candidates`;
      const sessionCallback = await fetch(sessionCallbackUrl, {
        headers: { cookie: sessionPendingCookie },
      });
      expect(await sessionCallback.json()).toEqual({ connected: true });
      expect(sessionCallback.headers.get('set-cookie')).toContain('discogs_session=');
      const sessionReplay = await fetch(sessionCallbackUrl, {
        headers: { cookie: sessionPendingCookie },
      });
      expect(sessionReplay.status).toBe(400);
      expect(await sessionReplay.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(sessionReplay.headers.get('set-cookie')).not.toContain('discogs_session=');
      expect(fetchImpl).toHaveBeenCalledTimes(5);
    } finally {
      await stopServer(server);
    }
  });

  it('returns a generic exchange failure without creating a session', async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
      if (url.endsWith('/oauth/access_token'))
        return new Response('private failure', { status: 502 });
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      expect(callback.status).toBe(502);
      expect(await callback.json()).toEqual({ error: 'Discogs OAuth exchange failed' });
      expect(callback.headers.get('set-cookie')).not.toContain('discogs_session=');
      expect(await (await fetch(`${baseUrl}/api/discogs/session`)).json()).toEqual({
        connected: false,
      });
    } finally {
      await stopServer(server);
    }
  });

  it('keeps an owned session when reauthentication fails', async () => {
    let failExchange = false;
    let clock = Date.now();
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);
      if (url.endsWith('/oauth/request_token')) return new Response(requestToken);
      if (url.endsWith('/oauth/access_token')) {
        return failExchange
          ? new Response('private provider detail', { status: 502 })
          : new Response('oauth_token=access-token&oauth_token_secret=access-secret');
      }
      return Response.json({ results: [] });
    });
    const { baseUrl, server } = await startApp(
      fetchImpl,
      undefined,
      undefined,
      () => clock,
    );

    async function begin(cookie = ''): Promise<{ state: string; pendingCookie: string }> {
      const response = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: baseUrl, ...(cookie ? { cookie } : {}) },
      });
      return {
        state: new URL(response.headers.get('location')!).searchParams.get(
          'oauth_token',
        )!,
        pendingCookie: response.headers.get('set-cookie')!.split(';')[0]!,
      };
    }

    try {
      const first = await begin();
      const connected = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${first.state}&oauth_verifier=approved`,
        { headers: { cookie: first.pendingCookie } },
      );
      const sessionCookie =
        connected.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      failExchange = true;
      const second = await begin(sessionCookie);
      const failed = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${second.state}&oauth_verifier=approved`,
        { headers: { cookie: `${second.pendingCookie}; ${sessionCookie}` } },
      );
      expect(failed.status).toBe(502);
      expect(await failed.json()).toEqual({ error: 'Discogs OAuth exchange failed' });
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      const mismatch = await begin(sessionCookie);
      const mismatchedCallback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${mismatch.state}&oauth_verifier=approved`,
        { headers: { cookie: `discogs_oauth_state=wrong; ${sessionCookie}` } },
      );
      expect(mismatchedCallback.status).toBe(400);
      expect(await mismatchedCallback.json()).toEqual({
        error: 'OAuth callback rejected',
      });
      const expired = await begin(sessionCookie);
      clock += 6 * 60_000;
      const expiredCallback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${expired.state}&oauth_verifier=approved`,
        { headers: { cookie: `${expired.pendingCookie}; ${sessionCookie}` } },
      );
      expect(expiredCallback.status).toBe(400);
      expect(await expiredCallback.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(
        await (
          await fetch(`${baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      expect(fetchImpl).toHaveBeenCalledTimes(6);
    } finally {
      await stopServer(server);
    }
  });

  it('sets and clears Secure session cookies over an actual HTTPS connection', async () => {
    const directory = mkdtempSync(join(tmpdir(), 'discogs-session-tls-'));
    const keyPath = join(directory, 'key.pem');
    const certificatePath = join(directory, 'certificate.pem');
    execFileSync(
      'openssl',
      [
        'req',
        '-x509',
        '-newkey',
        'rsa:2048',
        '-nodes',
        '-keyout',
        keyPath,
        '-out',
        certificatePath,
        '-subj',
        '/CN=127.0.0.1',
        '-addext',
        'subjectAltName=IP:127.0.0.1',
        '-days',
        '1',
      ],
      { stdio: 'ignore' },
    );
    let clock = Date.now();
    const startedAt = clock;
    const fetchImpl = provider();
    const app = createApp({
      env: { ...environment, NODE_ENV: 'production' },
      fetchImpl,
      now: () => clock,
    });
    const server = createHttpsServer(
      { key: readFileSync(keyPath), cert: readFileSync(certificatePath) },
      app,
    );
    const plainServer = app.listen(0, '127.0.0.1');
    const plainListening = new Promise<void>((resolve) =>
      plainServer.once('listening', resolve),
    );

    try {
      await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
      await plainListening;
      const address = server.address() as AddressInfo;
      const baseUrl = `https://127.0.0.1:${address.port}`;
      const begin = await tlsRequest(`${baseUrl}/api/discogs/connect?session=1`, {
        headers: { origin: baseUrl },
      });
      expect(begin.status).toBe(302);
      const pendingSetCookie = begin.headers['set-cookie']!.find((value) =>
        value.startsWith('discogs_oauth_state='),
      )!;
      expect(pendingSetCookie).toContain('Secure');
      expect(pendingSetCookie).toContain('HttpOnly');
      expect(pendingSetCookie).toContain('SameSite=Lax');
      expect(pendingSetCookie).toContain('Path=/api/discogs');
      const pendingCookie = pendingSetCookie.split(';')[0]!;
      const state = new URL(begin.headers.location!).searchParams.get('oauth_token');
      const plainAddress = plainServer.address() as AddressInfo;
      const plainUrl = `http://127.0.0.1:${plainAddress.port}`;
      const plaintextCallback = await fetch(
        `${plainUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie, 'x-forwarded-proto': 'https' } },
      );
      expect(plaintextCallback.status).toBe(403);
      expect(await plaintextCallback.json()).toEqual({ error: 'Request rejected' });
      expect(plaintextCallback.headers.get('set-cookie')).toBeNull();
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      const callback = await tlsRequest(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      expect(JSON.parse(callback.body)).toEqual({ connected: true });
      const clearedPendingCookie = callback.headers['set-cookie']!.find((value) =>
        value.startsWith('discogs_oauth_state='),
      )!;
      expect(clearedPendingCookie).toContain('Secure');
      expect(clearedPendingCookie).toContain('HttpOnly');
      expect(clearedPendingCookie).toContain('SameSite=Lax');
      expect(clearedPendingCookie).toContain('Path=/api/discogs');
      const sessionSetCookie = callback.headers['set-cookie']!.find((value) =>
        value.startsWith('discogs_session='),
      )!;
      expect(sessionSetCookie).toContain('Secure');
      expect(sessionSetCookie).toContain('HttpOnly');
      expect(sessionSetCookie).toContain('SameSite=Lax');
      expect(sessionSetCookie).toContain('Path=/api/discogs');
      const sessionCookie = sessionSetCookie.split(';')[0]!;
      const initialStatus = await tlsRequest(`${baseUrl}/api/discogs/session`, {
        headers: { cookie: sessionCookie },
      });
      expect(JSON.parse(initialStatus.body)).toEqual({ connected: true });
      clock = startedAt + 29 * 60_000;
      const plainStatus = await fetch(`${plainUrl}/api/discogs/session`, {
        headers: { cookie: sessionCookie, 'x-forwarded-proto': 'https' },
      });
      expect(plainStatus.status).toBe(403);
      expect(await plainStatus.json()).toEqual({ error: 'Request rejected' });
      const plainDelete = await fetch(`${plainUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: {
          origin: `https://127.0.0.1:${plainAddress.port}`,
          'x-forwarded-proto': 'https',
          cookie: sessionCookie,
        },
      });
      expect(plainDelete.status).toBe(403);
      const plainConnect = await fetch(`${plainUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: {
          origin: `https://127.0.0.1:${plainAddress.port}`,
          'x-forwarded-proto': 'https',
        },
      });
      expect(plainConnect.status).toBe(403);
      clock = startedAt + 30 * 60_000;
      const status = await tlsRequest(`${baseUrl}/api/discogs/session`, {
        headers: { cookie: sessionCookie },
      });
      expect(JSON.parse(status.body)).toEqual({ connected: false });
      const removed = await tlsRequest(`${baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: baseUrl, cookie: sessionCookie },
      });
      expect(JSON.parse(removed.body)).toEqual({ connected: false });
      const clearCookie = removed.headers['set-cookie']!.find((value) =>
        value.startsWith('discogs_session='),
      )!;
      expect(clearCookie).toContain('Secure');
      expect(clearCookie).toContain('HttpOnly');
      expect(clearCookie).toContain('SameSite=Lax');
      expect(clearCookie).toContain('Path=/api/discogs');
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(plainServer);
      await stopServer(server);
      rmSync(directory, { recursive: true, force: true });
    }
  }, 15_000);

  it('requires an actual HTTPS request for production session initiation', async () => {
    const fetchImpl = provider();
    const { baseUrl, server } = await startApp(fetchImpl, {
      DISCOGS_CLIENT_KEY: 'test-consumer-key',
      DISCOGS_SECRET_KEY: 'test-consumer-secret',
      DISCOGS_REQUEST_TOKEN_URL: 'https://api.discogs.com/oauth/request_token',
      DISCOGS_AUTH_URL: 'https://www.discogs.com/oauth/authorize',
      DISCOGS_ACCESS_TOKEN_URL: 'https://api.discogs.com/oauth/access_token',
      NODE_ENV: 'production',
    });

    try {
      const response = await fetch(`${baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: 'https://127.0.0.1' },
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: 'Request rejected' });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it('does not extend idle expiry after a rejected disconnect', async () => {
    let clock = 1_700_000_000_000;
    const start = clock;
    const fetchImpl = provider();
    const app = await startApp(fetchImpl, undefined, undefined, () => clock);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      clock = start + 29 * 60_000 + 59_000;
      const rejected = await fetch(`${app.baseUrl}/api/discogs/session`, {
        method: 'DELETE',
        headers: { origin: 'https://attacker.invalid', cookie: sessionCookie },
      });
      expect(rejected.status).toBe(403);
      clock = start + 30 * 60_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      await stopServer(app.server);
    }
  });

  it('continues to extend idle activity through the absolute deadline', async () => {
    let clock = 1_700_000_000_000;
    const start = clock;
    const fetchImpl = provider();
    const app = await startApp(fetchImpl, undefined, undefined, () => clock);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      for (let minute = 29; minute < 8 * 60; minute += 29) {
        clock = start + minute * 60_000;
        expect(
          await (
            await fetch(`${app.baseUrl}/api/discogs/session`, {
              headers: { cookie: sessionCookie },
            })
          ).json(),
        ).toEqual({ connected: true });
      }
      clock = start + 8 * 60 * 60_000 - 1;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      clock = start + 8 * 60 * 60_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
    } finally {
      await stopServer(app.server);
    }
  });

  it('clears the original idle timer after valid activity reschedules expiry', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const fetchImpl = provider();
    const app = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      vi.setSystemTime(start + 29 * 60_000);
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      await vi.advanceTimersByTimeAsync(60_000);
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
    } finally {
      await stopServer(app.server);
    }
  });

  it('removes expired credentials on its timer without a browser request', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const fetchImpl = provider();
    const app = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      await vi.advanceTimersByTimeAsync(30 * 60_000);
      vi.setSystemTime(start + 1_000);
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
    } finally {
      await stopServer(app.server);
    }
  });

  it('expires exactly at the idle boundary and health requests do not renew activity', async () => {
    let clock = 1_700_000_000_000;
    const start = clock;
    const fetchImpl = provider();
    const app = await startApp(fetchImpl, undefined, undefined, () => clock);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      clock = start + 30 * 60_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/health`, { headers: { cookie: sessionCookie } })
        ).json(),
      ).toEqual({ status: 'ok' });
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
    } finally {
      await stopServer(app.server);
    }
  });

  it('does not renew on rejected DELETE and lets valid status extend only the idle deadline', async () => {
    let clock = 1_700_000_000_000;
    const start = clock;
    const fetchImpl = provider();
    const app = await startApp(fetchImpl, undefined, undefined, () => clock);

    try {
      const begin = await fetch(`${app.baseUrl}/api/discogs/connect?session=1`, {
        redirect: 'manual',
        headers: { origin: app.baseUrl },
      });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const pendingCookie = begin.headers.get('set-cookie')!.split(';')[0]!;
      const callback = await fetch(
        `${app.baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: pendingCookie } },
      );
      const sessionCookie =
        callback.headers.get('set-cookie')!.match(/discogs_session=[a-f0-9]{64}/)?.[0] ??
        '';
      clock = start + 29 * 60_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      clock = start + 58 * 60_000 + 59_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: true });
      clock = start + 8 * 60 * 60_000;
      expect(
        await (
          await fetch(`${app.baseUrl}/api/discogs/session`, {
            headers: { cookie: sessionCookie },
          })
        ).json(),
      ).toEqual({ connected: false });
    } finally {
      await stopServer(app.server);
    }
  });
});
