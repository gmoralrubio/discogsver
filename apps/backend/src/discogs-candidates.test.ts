import { describe, expect, it, vi } from 'vite-plus/test';

import { sampleDiscogsCandidates } from './discogs-candidates.js';

describe('Discogs candidate sampling', () => {
  it('samples three categories sequentially and projects safe track/video evidence', async () => {
    const calls: string[] = [];
    let active = 0;
    let maximumActive = 0;
    const fetchImpl = vi.fn(async (input: URL | RequestInfo) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      calls.push(url);
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await Promise.resolve();
      active -= 1;
      if (url.includes('/database/search')) {
        return Response.json({ results: [{ id: 7, title: 'Artist - Album' }] });
      }
      return Response.json({
        id: 7,
        title: 'Artist - Album',
        year: 2020,
        genre: ['Reggae'],
        tracklist: [{ title: 'Known Song' }, { title: 'Other Song' }],
        videos: [
          {
            uri: 'https://www.youtube.com/watch?v=AbC_123-xYz',
            title: 'Artist - Known Song',
          },
          { uri: 'https://youtu.be/AbC_123-xYz', title: 'Full Album' },
          { uri: 'https://youtu.be/Other000001', title: 'Unrelated mix' },
          { uri: 'https://evilyoutube.com/watch?v=Bad__1234567', title: 'Known Song' },
        ],
        secret: 'must not leak',
      });
    });

    const report = await sampleDiscogsCandidates(
      fetchImpl as typeof fetch,
      { toHeader: () => ({ Authorization: 'signed' }), authorize: () => ({}) } as never,
      { key: 'access', secret: 'secret' },
      async () => {},
    );

    expect(maximumActive).toBe(1);
    expect(calls).toHaveLength(6);
    expect(calls.every((url) => url.startsWith('https://api.discogs.com/'))).toBe(true);
    expect(calls[0]).toContain('genre=Reggae');
    expect(calls[2]).toContain('style=Techno');
    expect(calls[4]).toContain('style=Punk');
    expect(report.categories[0]?.releases[0]).toMatchObject({
      id: 7,
      tracks: ['Known Song', 'Other Song'],
    });
    expect(report.categories[0]?.releases[0]?.videos[0]).toMatchObject({
      youtubeId: 'AbC_123-xYz',
      assessment: 'apparent_track_match',
    });
    expect(report.categories[0]?.releases[0]?.videos[1]).toMatchObject({
      youtubeId: 'AbC_123-xYz',
      duplicate: true,
      assessment: 'full_album_or_mix',
    });
    expect(report.categories[0]?.releases[0]?.videos).toHaveLength(3);
    expect(JSON.stringify(report)).not.toContain('must not leak');
  });

  it('caps each category to ten distinct release details and paces every data request', async () => {
    const calls: Array<{ url: string; method: string | undefined }> = [];
    const waits: number[] = [];
    const fetchImpl = vi.fn(async (input: URL | RequestInfo, init?: RequestInit) => {
      const url =
        typeof input === 'string'
          ? input
          : input instanceof Request
            ? input.url
            : input.toString();
      calls.push({ url, method: init?.method });
      if (url.includes('/database/search')) {
        return Response.json({
          results: Array.from({ length: 15 }, (_, index) => ({ id: index + 1 })),
        });
      }
      return Response.json({ tracklist: [], videos: [] });
    });
    const report = await sampleDiscogsCandidates(
      fetchImpl as typeof fetch,
      { toHeader: () => ({ Authorization: 'signed' }), authorize: () => ({}) } as never,
      { key: 'access', secret: 'secret' },
      async (milliseconds) => {
        waits.push(milliseconds);
      },
    );

    expect(report.dataRequests).toBe(33);
    expect(calls.filter(({ url }) => url.includes('/database/search'))).toHaveLength(3);
    expect(calls.filter(({ url }) => url.includes('/releases/'))).toHaveLength(30);
    expect(calls.every(({ method }) => method === 'GET')).toBe(true);
    expect(waits).toEqual(Array.from({ length: 32 }, () => 1100));
    expect(report.categories.every((category) => category.inspected === 10)).toBe(true);
  });

  it('keeps a successful response with exhausted quota and stops before another request', async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json(
        { results: [{ id: 7 }] },
        { headers: { 'X-Discogs-Ratelimit-Remaining': '0' } },
      ),
    );
    const report = await sampleDiscogsCandidates(
      fetchImpl as typeof fetch,
      { toHeader: () => ({ Authorization: 'signed' }), authorize: () => ({}) } as never,
      { key: 'access', secret: 'secret' },
      async () => {},
    );

    expect(report.categories[0]?.name).toBe('Reggae');
    expect(report.categories[0]?.inspected).toBe(0);
    expect(report.partial).toBe(true);
    expect(report.stopReason).toBe('quota_exhausted');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('returns safe partial evidence when a data request fails', async () => {
    const fetchImpl = vi.fn(async () => new Response('private failure', { status: 429 }));
    const report = await sampleDiscogsCandidates(
      fetchImpl as typeof fetch,
      { toHeader: () => ({ Authorization: 'signed' }), authorize: () => ({}) } as never,
      { key: 'access', secret: 'secret' },
      async () => {},
    );

    expect(report.partial).toBe(true);
    expect(report.stopReason).toBe('rate_limited');
    expect(JSON.stringify(report)).not.toContain('private failure');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
