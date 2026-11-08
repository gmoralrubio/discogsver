import { describe, expect, it, vi } from 'vite-plus/test';

import { createDiscogsProvider } from './discogs-provider.js';
import { fetchSearchSample } from './discogs-search.js';

const environment = {
  DISCOGS_CLIENT_KEY: 'test-consumer-key',
  DISCOGS_SECRET_KEY: 'test-consumer-secret',
};
const accessCredentials = { key: 'access-token', secret: 'access-secret' };

describe('Discogs authenticated search', () => {
  it('signs only the fixed read and returns a limited sample', async () => {
    const fetchImpl = vi.fn(async (_input: URL | RequestInfo, _options?: RequestInit) =>
      Response.json({ results: [{ id: 42, title: 'private provider detail' }] }),
    );
    const provider = createDiscogsProvider({ environment, fetchImpl });

    const sample = await fetchSearchSample(
      fetchImpl,
      provider.client(),
      accessCredentials,
    );

    expect(sample).toEqual({ resultCount: 1, firstReleaseId: 42 });
    expect(fetchImpl).toHaveBeenCalledTimes(1);

    const [url, options] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(
      'https://api.discogs.com/database/search?type=release&genre=Reggae&per_page=1',
    );
    expect(options?.method).toBe('GET');
    expect(options?.redirect).toBe('error');
    expect(new Headers(options?.headers).get('Authorization')).toContain(
      'oauth_token="access-token"',
    );
  });

  it('rejects malformed successful results instead of reporting a connection', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({ message: 'private provider detail', results: 'not-an-array' }),
    );
    const provider = createDiscogsProvider({ environment, fetchImpl });

    expect(
      await fetchSearchSample(fetchImpl, provider.client(), accessCredentials),
    ).toBeUndefined();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
