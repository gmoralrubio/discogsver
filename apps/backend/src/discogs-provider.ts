import { createHmac, randomBytes } from 'node:crypto';

import OAuth from 'oauth-1.0a';

const callbackUrl = 'http://127.0.0.1:5173/api/discogs/callback';
const endpoints = {
  DISCOGS_REQUEST_TOKEN_URL: 'https://api.discogs.com/oauth/request_token',
  DISCOGS_AUTH_URL: 'https://www.discogs.com/oauth/authorize',
  DISCOGS_ACCESS_TOKEN_URL: 'https://api.discogs.com/oauth/access_token',
} as const;

export type OAuthEnvironment = Record<string, string | undefined>;
export type FetchImplementation = typeof fetch;
export type OAuthCredentials = { key: string; secret: string };

type DiscogsEndpoints = Record<keyof typeof endpoints, string>;
type ProviderOptions = { environment: OAuthEnvironment; fetchImpl: FetchImplementation };
type AccessExchangeOptions = {
  fetchImpl: FetchImplementation;
  client: OAuth;
  accessUrl: string;
  temporaryCredentials: OAuthCredentials;
  verifier: string;
};

function endpoint(environment: OAuthEnvironment, name: keyof typeof endpoints): string {
  const configuredUrl = new URL(environment[name] ?? endpoints[name]);
  const { protocol, origin, pathname, username, password, search, hash } = configuredUrl;
  const expectedUrl = new URL(endpoints[name]);
  const isOfficialEndpoint =
    protocol === 'https:' &&
    origin === expectedUrl.origin &&
    pathname === expectedUrl.pathname;
  const hasEmbeddedCredentials = username !== '' || password !== '';
  const hasExtraParameters = Boolean(search || hash);

  if (!isOfficialEndpoint || hasEmbeddedCredentials || hasExtraParameters) {
    throw new Error('Invalid Discogs endpoint configuration');
  }

  return configuredUrl.toString();
}

function validatedEndpoints(environment: OAuthEnvironment): DiscogsEndpoints {
  return {
    DISCOGS_REQUEST_TOKEN_URL: endpoint(environment, 'DISCOGS_REQUEST_TOKEN_URL'),
    DISCOGS_AUTH_URL: endpoint(environment, 'DISCOGS_AUTH_URL'),
    DISCOGS_ACCESS_TOKEN_URL: endpoint(environment, 'DISCOGS_ACCESS_TOKEN_URL'),
  };
}

function parseForm(body: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(body));
}

function oauth(consumer: OAuthCredentials): OAuth {
  const client = new OAuth({
    consumer,
    signature_method: 'HMAC-SHA1',
    hash_function: (baseString: string, signingKey: string) =>
      createHmac('sha1', signingKey).update(baseString).digest('base64'),
  });
  // oauth-1.0a defaults to Math.random for nonces; use unpredictable values in signed requests.
  client.getNonce = () => randomBytes(24).toString('hex');

  return client;
}

export async function providerRequest(
  fetchImpl: FetchImplementation,
  url: string,
  method: 'GET' | 'POST',
  authorization: string,
): Promise<globalThis.Response> {
  return fetchImpl(url, {
    method,
    redirect: 'error',
    headers: {
      Authorization: authorization,
      'User-Agent': 'Discogsver OAuth proof',
    },
  });
}

async function requestTemporaryToken(
  fetchImpl: FetchImplementation,
  client: OAuth,
  requestTokenUrl: string,
): Promise<{ token: string; secret: string } | undefined> {
  // oauth-1.0a signs oauth_callback as request data before placing it in Authorization.
  const requestOptions = {
    url: requestTokenUrl,
    method: 'POST',
    data: { oauth_callback: callbackUrl },
  };

  const authorization = client.toHeader(client.authorize(requestOptions)).Authorization;

  const providerResponse = await providerRequest(
    fetchImpl,
    requestTokenUrl,
    'POST',
    authorization,
  );

  if (!providerResponse.ok) return undefined;

  const tokenData = parseForm(await providerResponse.text());
  const token = tokenData.oauth_token;
  const secret = tokenData.oauth_token_secret;
  const callbackConfirmed = tokenData.oauth_callback_confirmed === 'true';

  if (!token || !secret || !callbackConfirmed) return undefined;

  return { token, secret };
}

async function exchangeAccessToken({
  fetchImpl,
  client,
  accessUrl,
  temporaryCredentials,
  verifier,
}: AccessExchangeOptions): Promise<OAuthCredentials | undefined> {
  // The verifier is signed with the one-time request-token credentials, not sent as a query.
  const accessRequest = {
    url: accessUrl,
    method: 'POST',
    data: { oauth_verifier: verifier },
  };

  const authorization = client.toHeader(
    client.authorize(accessRequest, temporaryCredentials),
  ).Authorization;

  const providerResponse = await providerRequest(
    fetchImpl,
    accessUrl,
    'POST',
    authorization,
  );

  if (!providerResponse.ok) return undefined;

  const tokenData = parseForm(await providerResponse.text());
  const key = tokenData.oauth_token;
  const secret = tokenData.oauth_token_secret;

  if (!key || !secret) return undefined;

  return { key, secret };
}

export function createDiscogsProvider({ environment, fetchImpl }: ProviderOptions) {
  const consumerCredentials =
    environment.DISCOGS_CLIENT_KEY && environment.DISCOGS_SECRET_KEY
      ? { key: environment.DISCOGS_CLIENT_KEY, secret: environment.DISCOGS_SECRET_KEY }
      : undefined;

  function client(): OAuth {
    if (!consumerCredentials) throw new Error('Discogs OAuth is not configured');
    return oauth(consumerCredentials);
  }

  return {
    configured: Boolean(consumerCredentials),

    client,

    getEndpoints(): DiscogsEndpoints {
      return validatedEndpoints(environment);
    },

    async requestToken(configuredEndpoints: DiscogsEndpoints) {
      return requestTemporaryToken(
        fetchImpl,
        client(),
        configuredEndpoints.DISCOGS_REQUEST_TOKEN_URL,
      );
    },

    authorizationUrl(configuredEndpoints: DiscogsEndpoints, token: string): string {
      const url = new URL(configuredEndpoints.DISCOGS_AUTH_URL);
      url.searchParams.set('oauth_token', token);
      return url.toString();
    },

    async exchangeToken(
      configuredEndpoints: DiscogsEndpoints,
      temporaryCredentials: OAuthCredentials,
      verifier: string,
    ) {
      return exchangeAccessToken({
        fetchImpl,
        client: client(),
        accessUrl: configuredEndpoints.DISCOGS_ACCESS_TOKEN_URL,
        temporaryCredentials,
        verifier,
      });
    },
  };
}
