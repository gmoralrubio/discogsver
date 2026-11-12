import type OAuth from 'oauth-1.0a';

import {
  providerRequest,
  type FetchImplementation,
  type OAuthCredentials,
} from './discogs-provider.js';

type Video = {
  youtubeId: string;
  title: string;
  url: string;
  duplicate: boolean;
  assessment: 'apparent_track_match' | 'ambiguous' | 'full_album_or_mix' | 'unmatched';
};

type Release = {
  id: number;
  url: string;
  title: string;
  year: number | null;
  coverAvailable: boolean;
  tracks: string[];
  videos: Video[];
};

type Category = {
  name: string;
  releases: Release[];
  insufficient: boolean;
  inspected: number;
  withVideos: number;
  duplicateVideos: number;
  apparentTrackMatches: number;
  withCover: number;
};

export type CandidateReport = {
  categories: Category[];
  partial: boolean;
  stopReason: string | null;
  dataRequests: number;
};

const categories = [
  { name: 'Reggae', parameter: 'genre' },
  { name: 'Techno', parameter: 'style' },
  { name: 'Punk', parameter: 'style' },
] as const;

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim()
    ? value.trim().slice(0, 200)
    : undefined;
}

function videoId(uri: string): string | undefined {
  try {
    const url = new URL(uri);
    const hostname = url.hostname.toLowerCase();
    const isShortLink = hostname === 'youtu.be' || hostname === 'www.youtu.be';
    const isYoutube = hostname === 'youtube.com' || hostname.endsWith('.youtube.com');
    if (url.protocol !== 'https:' || (!isShortLink && !isYoutube)) return undefined;
    const id = isShortLink ? url.pathname.slice(1) : (url.searchParams.get('v') ?? '');
    return /^[A-Za-z0-9_-]{11}$/.test(id) ? id : undefined;
  } catch {
    return undefined;
  }
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function assessVideo(title: string, tracks: string[]): Video['assessment'] {
  const candidate = normalize(title);
  if (/\b(full album|whole album|album mix|dj mix|full mix|mixtape)\b/.test(candidate)) {
    return 'full_album_or_mix';
  }

  const matches = tracks.filter((track) => {
    const normalized = normalize(track);
    return normalized.length > 2 && candidate.includes(normalized);
  });
  if (matches.length === 1) return 'apparent_track_match';
  return matches.length > 1 ? 'ambiguous' : 'unmatched';
}

function emptyCategory(name: string): Category {
  return {
    name,
    releases: [],
    insufficient: true,
    inspected: 0,
    withVideos: 0,
    duplicateVideos: 0,
    apparentTrackMatches: 0,
    withCover: 0,
  };
}

function isPayload(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function hasQuota(response: Response): boolean {
  const remaining = response.headers.get('X-Discogs-Ratelimit-Remaining');
  return remaining !== null && Number(remaining) <= 0;
}

export async function sampleDiscogsCandidates(
  fetchImpl: FetchImplementation,
  client: OAuth,
  credentials: OAuthCredentials,
  wait: (milliseconds: number) => Promise<void> = (milliseconds) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds)),
): Promise<CandidateReport> {
  const report: CandidateReport = {
    categories: [],
    partial: false,
    stopReason: null,
    dataRequests: 0,
  };
  const seenVideos = new Set<string>();
  let stopped = false;

  async function get(url: string): Promise<Response | undefined> {
    if (report.dataRequests > 0) await wait(1100);
    report.dataRequests += 1;
    try {
      const authorization = client.toHeader(
        client.authorize({ url, method: 'GET' }, credentials),
      ).Authorization;
      const response = await providerRequest(fetchImpl, url, 'GET', authorization);
      if (!response.ok) {
        report.stopReason = response.status === 429 ? 'rate_limited' : 'provider_error';
        stopped = true;
        return undefined;
      }
      if (hasQuota(response)) {
        report.stopReason = 'quota_exhausted';
        stopped = true;
      }
      return response;
    } catch {
      report.stopReason = 'request_failed';
      stopped = true;
      return undefined;
    }
  }

  for (const category of categories) {
    const result = emptyCategory(category.name);
    report.categories.push(result);
    const search = new URL('https://api.discogs.com/database/search');
    search.searchParams.set('type', 'release');
    search.searchParams.set(category.parameter, category.name);
    search.searchParams.set('per_page', '10');
    const searchResponse = await get(search.toString());
    if (!searchResponse) break;

    let payload: unknown;
    try {
      payload = await searchResponse.json();
    } catch {
      report.stopReason = 'malformed_response';
      stopped = true;
      break;
    }
    if (!isPayload(payload) || !Array.isArray(payload.results)) {
      report.stopReason = 'malformed_response';
      stopped = true;
      break;
    }

    const releaseIds: number[] = [];
    for (const candidate of payload.results) {
      if (releaseIds.length >= 10) break;
      if (
        !isPayload(candidate) ||
        typeof candidate.id !== 'number' ||
        !Number.isSafeInteger(candidate.id) ||
        candidate.id <= 0 ||
        releaseIds.includes(candidate.id)
      )
        continue;
      releaseIds.push(candidate.id);
    }

    for (const id of releaseIds) {
      if (stopped) break;
      const detailResponse = await get(`https://api.discogs.com/releases/${id}`);
      if (!detailResponse) break;
      let detail: unknown;
      try {
        detail = await detailResponse.json();
      } catch {
        report.stopReason = 'malformed_response';
        stopped = true;
        break;
      }
      if (!isPayload(detail) || !Array.isArray(detail.tracklist)) {
        report.stopReason = 'malformed_response';
        stopped = true;
        break;
      }

      const tracks = detail.tracklist
        .flatMap((track) =>
          isPayload(track) && text(track.title) ? [text(track.title)!] : [],
        )
        .slice(0, 100);
      const videos: Video[] = [];
      if (Array.isArray(detail.videos)) {
        for (const video of detail.videos.slice(0, 50)) {
          if (!isPayload(video) || typeof video.uri !== 'string') continue;
          const idValue = videoId(video.uri);
          if (!idValue) continue;
          const title = text(video.title) ?? '';
          videos.push({
            youtubeId: idValue,
            title,
            url: `https://www.youtube.com/watch?v=${idValue}`,
            duplicate: seenVideos.has(idValue),
            assessment: assessVideo(title, tracks),
          });
          seenVideos.add(idValue);
        }
      }
      result.releases.push({
        id,
        url: `https://www.discogs.com/release/${id}`,
        title: text(detail.title) ?? `Release ${id}`,
        year: typeof detail.year === 'number' ? detail.year : null,
        coverAvailable: Array.isArray(detail.images) && detail.images.length > 0,
        tracks,
        videos,
      });
    }

    result.inspected = result.releases.length;
    result.withVideos = result.releases.filter(
      (release) => release.videos.length > 0,
    ).length;
    result.duplicateVideos = result.releases.reduce(
      (count, release) =>
        count + release.videos.filter((video) => video.duplicate).length,
      0,
    );
    result.apparentTrackMatches = result.releases.reduce(
      (count, release) =>
        count +
        release.videos.filter((video) => video.assessment === 'apparent_track_match')
          .length,
      0,
    );
    result.withCover = result.releases.filter((release) => release.coverAvailable).length;
    result.insufficient = result.inspected < 10;
    if (stopped) break;
  }

  report.partial = stopped || report.categories.some((category) => category.insufficient);
  return report;
}
