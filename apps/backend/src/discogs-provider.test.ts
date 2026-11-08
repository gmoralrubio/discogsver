import { describe, expect, it, vi } from 'vite-plus/test';

import { createDiscogsProvider } from './discogs-provider.js';

const environment = {
  DISCOGS_CLIENT_KEY: 'test-consumer-key',
  DISCOGS_SECRET_KEY: 'test-consumer-secret',
};

describe('Discogs provider client', () => {
  it('signs temporary and access token requests', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      let url: string;
      if (typeof input === 'string') url = input;
      else if (input instanceof URL) url = input.toString();
      else url = input.url;

      calls.push({ url, init });

      if (url.endsWith('/oauth/request_token')) {
        return new Response(
          'oauth_token=request-token&oauth_token_secret=request-secret&oauth_callback_confirmed=true',
        );
      }

      if (url.endsWith('/oauth/access_token')) {
        return new Response('oauth_token=access-token&oauth_token_secret=access-secret');
      }

      throw new Error('Unexpected provider endpoint');
    });

    const provider = createDiscogsProvider({ environment, fetchImpl });
    const endpoints = provider.getEndpoints();

    const temporaryToken = await provider.requestToken(endpoints);

    expect(temporaryToken).toEqual({ token: 'request-token', secret: 'request-secret' });

    if (!temporaryToken) throw new Error('Expected a temporary token');

    expect(provider.authorizationUrl(endpoints, temporaryToken.token)).toBe(
      'https://www.discogs.com/oauth/authorize?oauth_token=request-token',
    );

    const credentials = await provider.exchangeToken(
      endpoints,
      { key: temporaryToken.token, secret: temporaryToken.secret },
      'approved',
    );

    expect(credentials).toEqual({ key: 'access-token', secret: 'access-secret' });

    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.init?.method)).toEqual(['POST', 'POST']);

    for (const call of calls) {
      expect(call.init?.redirect).toBe('error');
      expect(new Headers(call.init?.headers).get('Authorization')).toContain(
        'oauth_signature=',
      );
    }

    expect(new Headers(calls[0]?.init?.headers).get('Authorization')).toContain(
      'oauth_callback=',
    );
    expect(new Headers(calls[1]?.init?.headers).get('Authorization')).toContain(
      'oauth_verifier="approved"',
    );
  });

  it('rejects invalid endpoint settings before a provider request', () => {
    const fetchImpl = vi.fn(async () => new Response('not called'));
    const provider = createDiscogsProvider({
      environment: {
        ...environment,
        DISCOGS_AUTH_URL: 'https://user:password@www.discogs.com/oauth/authorize',
      },
      fetchImpl,
    });

    expect(() => provider.getEndpoints()).toThrow(
      'Invalid Discogs endpoint configuration',
    );
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
