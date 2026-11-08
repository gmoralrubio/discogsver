import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { authorization, requestUrl, startApp, stopServer } from './app-test-support.js';

afterEach(() => vi.restoreAllMocks());

describe('Discogs OAuth read-only proof', () => {
  it('completes callback-bound OAuth and performs one authenticated search', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url = requestUrl(input);
      calls.push({ url, init });
      if (url.endsWith('/oauth/request_token')) {
        return new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        );
      }
      if (url.endsWith('/oauth/access_token')) {
        return new Response('oauth_token=access-token&oauth_token_secret=access-secret');
      }
      return Response.json({ results: [{ id: 42 }] });
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      expect(begin.status).toBe(302);
      expect(begin.headers.get('location')).toBe(
        'https://www.discogs.com/oauth/authorize?oauth_token=request-token',
      );

      const cookie = begin.headers.get('set-cookie')?.split(';')[0];
      expect(cookie).toMatch(/^discogs_oauth_state=/);
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );

      const callback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        {
          headers: { cookie: cookie! },
        },
      );

      expect(callback.status).toBe(200);
      const result = await callback.json();

      expect(result).toEqual({
        connected: true,
        sample: { resultCount: 1, firstReleaseId: 42 },
      });
      expect(calls).toHaveLength(3);

      const requestHeader = authorization(calls[0]?.init);
      const exchangeHeader = authorization(calls[1]?.init);
      expect(requestHeader).toContain('oauth_callback=');
      expect(exchangeHeader).toContain('oauth_verifier="approved"');

      expect(calls[2]?.url).toBe(
        'https://api.discogs.com/database/search?type=release&genre=Reggae&per_page=1',
      );
      expect(authorization(calls[2]?.init)).toContain('oauth_token="access-token"');
      expect(JSON.stringify(result)).not.toContain('access-secret');
    } finally {
      await stopServer(server);
    }
  });

  it.each([
    ['missing browser cookie', undefined],
    ['mismatched browser cookie', 'discogs_oauth_state=wrong'],
  ])('rejects callback with %s without provider reads', async (_case, cookie) => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        ),
    );

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );

      const response = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=x`,
        {
          headers: cookie ? { cookie } : {},
        },
      );

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);
    } finally {
      await stopServer(server);
    }
  });

  it('rejects cancelled and expired callbacks before token exchange', async () => {
    const fetchImpl = vi.fn(
      async () =>
        new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        ),
    );

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const cookieHeader = begin.headers.get('set-cookie');
      expect(cookieHeader).toBeTruthy();
      const cookie = cookieHeader?.split(';')[0] ?? '';

      const cancelled = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&denied=${state}`,
        { headers: { cookie } },
      );

      expect(cancelled.status).toBe(400);
      expect(await cancelled.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(1);

      const secondBegin = await fetch(`${baseUrl}/api/discogs/connect`, {
        redirect: 'manual',
      });
      const secondState = new URL(secondBegin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const secondCookieHeader = secondBegin.headers.get('set-cookie');
      expect(secondCookieHeader).toBeTruthy();
      const secondCookie = secondCookieHeader?.split(';')[0] ?? '';

      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 6 * 60 * 1000);

      const expired = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${secondState}&oauth_verifier=approved`,
        { headers: { cookie: secondCookie } },
      );

      expect(expired.status).toBe(400);
      expect(await expired.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      await stopServer(server);
    }
  });

  it('rejects a replay after completing only one authenticated read', async () => {
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url = requestUrl(input);

      if (url.endsWith('/oauth/request_token'))
        return new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        );

      if (url.endsWith('/oauth/access_token'))
        return new Response('oauth_token=access-token&oauth_token_secret=access-secret');

      return Response.json({ results: [] });
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );
      const cookieHeader = begin.headers.get('set-cookie');
      expect(cookieHeader).toBeTruthy();

      const cookie = cookieHeader?.split(';')[0] ?? '';
      const callbackUrl = `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`;

      const completed = await fetch(callbackUrl, { headers: { cookie } });
      expect(completed.status).toBe(200);
      expect(await completed.json()).toEqual({
        connected: true,
        sample: { resultCount: 0, firstReleaseId: null },
      });

      const replay = await fetch(callbackUrl, { headers: { cookie } });

      expect(replay.status).toBe(400);
      expect(await replay.json()).toEqual({ error: 'OAuth callback rejected' });
      expect(fetchImpl).toHaveBeenCalledTimes(3);
    } finally {
      await stopServer(server);
    }
  });

  it('rejects malformed successful search payloads without exposing provider data', async () => {
    let providerCalls = 0;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      providerCalls += 1;
      const url = requestUrl(input);

      if (url.endsWith('/oauth/request_token')) {
        return new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        );
      }

      if (url.endsWith('/oauth/access_token')) {
        return new Response('oauth_token=access-token&oauth_token_secret=access-secret');
      }

      return Response.json({
        message: 'private provider detail',
        results: 'not-an-array',
      });
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      const begin = await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' });
      const state = new URL(begin.headers.get('location')!).searchParams.get(
        'oauth_token',
      );

      const cookie = begin.headers.get('set-cookie')?.split(';')[0];

      const callback = await fetch(
        `${baseUrl}/api/discogs/callback?oauth_token=${state}&oauth_verifier=approved`,
        { headers: { cookie: cookie! } },
      );

      expect(callback.status).toBe(502);
      expect(await callback.json()).toEqual({
        error: 'Discogs authenticated read failed',
      });
      expect(providerCalls).toBe(3);
    } finally {
      await stopServer(server);
    }
  });
});
