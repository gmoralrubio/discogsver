import type OAuth from 'oauth-1.0a';

import {
  providerRequest,
  type FetchImplementation,
  type OAuthCredentials,
} from './discogs-provider.js';

type SearchSample = { resultCount: number; firstReleaseId: number | null };

function hasSearchResults(payload: unknown): payload is { results: unknown[] } {
  if (typeof payload !== 'object' || payload === null) return false;
  return 'results' in payload && Array.isArray(payload.results);
}

function releaseId(release: unknown): number | null {
  if (typeof release !== 'object' || release === null || !('id' in release)) return null;
  if (typeof release.id !== 'number') return null;
  return release.id;
}

function searchSample(payload: unknown): SearchSample | undefined {
  if (!hasSearchResults(payload)) return undefined;

  const results = payload.results;
  return { resultCount: results.length, firstReleaseId: releaseId(results[0]) };
}

export async function fetchSearchSample(
  fetchImpl: FetchImplementation,
  client: OAuth,
  accessCredentials: OAuthCredentials,
): Promise<SearchSample | undefined> {
  const searchUrl =
    'https://api.discogs.com/database/search?type=release&genre=Reggae&per_page=1';

  const authorization = client.toHeader(
    client.authorize({ url: searchUrl, method: 'GET' }, accessCredentials),
  ).Authorization;

  const providerResponse = await providerRequest(
    fetchImpl,
    searchUrl,
    'GET',
    authorization,
  );

  if (!providerResponse.ok) return undefined;

  return searchSample(await providerResponse.json());
}
