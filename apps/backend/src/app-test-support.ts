import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { createApp } from './app.js';

export const environment = {
  DISCOGS_CLIENT_KEY: 'test-consumer-key',
  DISCOGS_SECRET_KEY: 'test-consumer-secret',
  DISCOGS_REQUEST_TOKEN_URL: 'https://api.discogs.com/oauth/request_token',
  DISCOGS_AUTH_URL: 'https://www.discogs.com/oauth/authorize',
  DISCOGS_ACCESS_TOKEN_URL: 'https://api.discogs.com/oauth/access_token',
};

export function requestUrl(input: URL | RequestInfo): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

export function authorization(init?: RequestInit): string {
  const headers = init?.headers;
  if (!headers || typeof headers !== 'object' || !('Authorization' in headers)) {
    throw new Error('Expected an authorization header');
  }
  const value = headers.Authorization;
  if (typeof value !== 'string') throw new Error('Expected an authorization header');
  return value;
}

export async function startApp(
  fetchImpl: typeof fetch,
  appEnvironment: typeof environment = environment,
  wait?: (milliseconds: number) => Promise<void>,
) {
  const app = createApp({ env: appEnvironment, fetchImpl, wait });
  const server = await new Promise<Server>((resolve) => {
    const listeningServer = app.listen(0, '127.0.0.1', () => resolve(listeningServer));
  });
  const address = server.address() as AddressInfo;
  return { baseUrl: `http://127.0.0.1:${address.port}`, server };
}

export async function stopServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
}
