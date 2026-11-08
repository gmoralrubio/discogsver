import { afterEach, describe, expect, it, vi } from 'vite-plus/test';

import { authorization, environment, startApp, stopServer } from './app-test-support.js';

afterEach(() => vi.restoreAllMocks());

describe('Discogs OAuth connection', () => {
  it.each([
    [
      'provider rejection',
      async () => new Response('private provider detail', { status: 401 }),
    ],
    [
      'malformed provider response',
      async () =>
        new Response('oauth_token=private-token&oauth_token_secret=private-secret'),
    ],
    [
      'transport failure',
      async () => {
        throw new Error('private transport detail');
      },
    ],
  ] as const)(
    'keeps %s errors generic even with the obsolete diagnostic query',
    async (_case, providerResult) => {
      const fetchImpl = vi.fn(async () => providerResult());

      const { baseUrl, server } = await startApp(fetchImpl);

      try {
        const result = await fetch(`${baseUrl}/api/discogs/connect?diagnostic=1`, {
          redirect: 'manual',
        });

        expect(result.status).toBe(502);
        expect(await result.json()).toEqual({ error: 'Discogs OAuth request failed' });

        expect(fetchImpl).toHaveBeenCalledTimes(1);
      } finally {
        await stopServer(server);
      }
    },
  );

  it('keeps invalid endpoint configuration generic without calling the provider', async () => {
    const fetchImpl = vi.fn(async () => new Response('private provider detail'));
    const appEnv = {
      ...environment,
      DISCOGS_ACCESS_TOKEN_URL:
        'https://user:password@api.discogs.com/oauth/access_token',
    };
    const { baseUrl, server } = await startApp(fetchImpl, appEnv);

    try {
      const result = await fetch(`${baseUrl}/api/discogs/connect?diagnostic=1`, {
        redirect: 'manual',
      });

      expect(result.status).toBe(502);
      expect(await result.json()).toEqual({ error: 'Discogs OAuth request failed' });
      expect(fetchImpl).not.toHaveBeenCalled();
    } finally {
      await stopServer(server);
    }
  });

  it('reserves the 100-connection capacity while request-token calls are in flight', async () => {
    let providerCalls = 0;
    let releaseRequests: (() => void) | undefined;
    const deferred = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });

    let reachedCapacity: (() => void) | undefined;
    const capacityReached = new Promise<void>((resolve) => {
      reachedCapacity = resolve;
    });

    const fetchImpl = vi.fn(async () => {
      const requestNumber = ++providerCalls;

      if (requestNumber === 100) reachedCapacity?.();
      if (requestNumber <= 100) await deferred;
      return new Response(
        `oauth_token=request-${requestNumber}&oauth_token_secret=request-secret&oauth_callback_confirmed=true`,
      );
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    const firstHundred = Array.from({ length: 100 }, () =>
      fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' }),
    );

    try {
      await capacityReached;

      const overCapacity = await fetch(`${baseUrl}/api/discogs/connect`, {
        redirect: 'manual',
      });

      expect(overCapacity.status).toBe(503);
      expect(await overCapacity.json()).toEqual({
        error: 'OAuth connection capacity reached',
      });
      expect(providerCalls).toBe(100);

      releaseRequests?.();

      const responses = await Promise.all(firstHundred);
      expect(responses.every((response) => response.status === 302)).toBe(true);
    } finally {
      releaseRequests?.();
      await Promise.all(firstHundred);
      await stopServer(server);
    }
  });

  it('releases all in-flight capacity after provider rejection', async () => {
    let releaseRequests: (() => void) | undefined;

    const deferred = new Promise<void>((resolve) => {
      releaseRequests = resolve;
    });

    let providerCalls = 0;

    const fetchImpl = vi.fn(async () => {
      const requestNumber = ++providerCalls;

      if (requestNumber <= 100) {
        await deferred;

        return new Response('unavailable', { status: 503 });
      }

      return new Response(
        `oauth_token=request-${requestNumber}&oauth_token_secret=request-secret&oauth_callback_confirmed=true`,
      );
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    const requests = Array.from({ length: 100 }, () =>
      fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' }),
    );

    try {
      await vi.waitFor(() => expect(providerCalls).toBe(100));

      releaseRequests?.();

      const rejected = await Promise.all(requests);

      expect(rejected.every((response) => response.status === 502)).toBe(true);
      expect(await rejected[0]?.json()).toEqual({
        error: 'Discogs OAuth request failed',
      });

      const subsequent = await fetch(`${baseUrl}/api/discogs/connect`, {
        redirect: 'manual',
      });

      expect(subsequent.status).toBe(302);
      expect(providerCalls).toBe(101);
    } finally {
      releaseRequests?.();
      await Promise.all(requests);
      await stopServer(server);
    }
  });

  it('uses unique OAuth nonces even when Math.random repeats', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    let requestCount = 0;

    const headers: string[] = [];

    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, init?: RequestInit) => {
      headers.push(authorization(init));
      requestCount += 1;
      return new Response(
        `oauth_token=request-${requestCount}&oauth_token_secret=test-secret&oauth_callback_confirmed=true`,
      );
    });

    const { baseUrl, server } = await startApp(fetchImpl);

    try {
      expect(
        (await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' })).status,
      ).toBe(302);
      expect(
        (await fetch(`${baseUrl}/api/discogs/connect`, { redirect: 'manual' })).status,
      ).toBe(302);

      const nonces = headers.map((header) => /oauth_nonce="([^"]+)"/.exec(header)?.[1]);

      expect(nonces).toHaveLength(2);
      expect(nonces[0]).toBeTruthy();
      expect(nonces[0]).not.toBe(nonces[1]);
    } finally {
      await stopServer(server);
    }
  });

  it.each([
    [
      'DISCOGS_REQUEST_TOKEN_URL',
      'https://user:password@api.discogs.com/oauth/request_token',
    ],
    ['DISCOGS_AUTH_URL', 'https://user:password@www.discogs.com/oauth/authorize'],
    [
      'DISCOGS_ACCESS_TOKEN_URL',
      'https://user:password@api.discogs.com/oauth/access_token',
    ],
  ] as const)(
    'rejects endpoint userinfo in %s before provider requests',
    async (name, value) => {
      const fetchImpl = vi.fn(async () => new Response('should not be called'));
      const appEnv = { ...environment, [name]: value };
      const { baseUrl, server } = await startApp(fetchImpl, appEnv);

      try {
        const response = await fetch(`${baseUrl}/api/discogs/connect`, {
          redirect: 'manual',
        });

        expect(response.status).toBe(502);
        expect(await response.json()).toEqual({ error: 'Discogs OAuth request failed' });

        expect(fetchImpl).not.toHaveBeenCalled();
      } finally {
        await stopServer(server);
      }
    },
  );

  it('keeps health behavior unchanged', async () => {
    const { baseUrl, server } = await startApp(vi.fn());

    try {
      const response = await fetch(`${baseUrl}/api/health`);

      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ status: 'ok' });
    } finally {
      await stopServer(server);
    }
  });
});
