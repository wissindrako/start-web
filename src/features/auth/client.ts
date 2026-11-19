import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import type { BetterAuthClientPlugin } from 'better-auth/client';
import {
  adminClient,
  emailOTPClient,
  inferAdditionalFields,
  twoFactorClient,
} from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';

import { envClient } from '@/env/client';
import type { Auth } from '@/server/auth';

import { permissions } from './permissions';

/**
 * The OAuth provider sends users to /login with a signed query in which
 * `ba_param` is repeated once per signed parameter. TanStack Router rewrites
 * repeated keys as a JSON array (`ba_param=["a","b"]`), which breaks the
 * signature. This restores the original form before oauthProviderClient
 * reads the query (it skips requests that already carry `oauth_query`).
 * It is also kept for the next login step (/login/verify), whose URL no
 * longer has it.
 */
const PENDING_OAUTH_QUERY = 'pending-oauth-query';

const restoreSignedQuery = (search: URLSearchParams) => {
  const names = search.getAll('ba_param').flatMap((value) => {
    try {
      const parsed: unknown = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.map(String) : [value];
    } catch {
      return [value];
    }
  });
  const signed = new URLSearchParams();
  for (const [key, value] of search.entries()) {
    if (key !== 'ba_param' && (key === 'sig' || names.includes(key)))
      signed.append(key, value);
  }
  for (const name of names) signed.append('ba_param', name);
  return signed;
};

/**
 * Keeps a signed query for the next steps of the login, until it expires.
 * The expiry is measured with this browser's clock: `exp` comes from the
 * server's clock, and a device whose clock or time zone is off (common on
 * other PCs of the network) would see it as already expired and silently
 * drop the authorization flow. So only the lifetime the server gave it
 * (`exp` - `ba_iat`) is used, counted from now.
 */
const DEFAULT_QUERY_LIFETIME_MS = 10 * 60 * 1000;

const rememberQuery = (key: string, signed: string) => {
  const params = new URLSearchParams(signed);
  const lifetime =
    Number(params.get('exp')) * 1000 - Number(params.get('ba_iat'));
  sessionStorage.setItem(
    key,
    JSON.stringify({
      query: signed,
      until:
        Date.now() +
        (Number.isFinite(lifetime) && lifetime > 0
          ? lifetime
          : DEFAULT_QUERY_LIFETIME_MS),
    })
  );
};

const recallQuery = (key: string) => {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (!stored || typeof stored !== 'object') return null;
    const { query, until } = stored as { query?: unknown; until?: unknown };
    return typeof query === 'string' &&
      typeof until === 'number' &&
      until > Date.now()
      ? query
      : null;
  } catch {
    return null;
  }
};

const getSignedQuery = () => {
  const search = new URLSearchParams(window.location.search);
  if (search.has('sig')) {
    const signed = restoreSignedQuery(search).toString();
    rememberQuery(PENDING_OAUTH_QUERY, signed);
    return signed;
  }

  // Only while still signing in, and only until the signed query expires
  if (!window.location.pathname.startsWith('/login')) return null;
  return recallQuery(PENDING_OAUTH_QUERY);
};

/**
 * For pages outside /login that resume the authorization flow themselves
 * (/two-factor-setup): takes the signed query off the URL, so requests made
 * on the page do not resume it before the page is done.
 */
const TAKEN_OAUTH_QUERY = 'taken-oauth-query';

export const takeSignedOAuthQuery = () => {
  const search = new URLSearchParams(window.location.search);
  if (search.has('sig')) {
    rememberQuery(TAKEN_OAUTH_QUERY, restoreSignedQuery(search).toString());
    window.history.replaceState(null, '', window.location.pathname);
  }
  // Also after a reload, until the signed query expires
  return recallQuery(TAKEN_OAUTH_QUERY);
};

/**
 * Set when a sign-in response sends the browser back to the system that
 * asked for the login (OAuth flow). From then on this page must not navigate
 * by itself or send the code again: on a slow device the page kept running
 * while the browser left, redirected to "no access" or re-sent the code
 * (already used: "invalid code"), and the user never reached the system.
 */
let resumingOAuthFlowTo: string | null = null;
export const isResumingOAuthFlow = () => resumingOAuthFlowTo !== null;

const OAUTH_REDIRECT_RETRY_MS = 4000;

const signedOAuthQueryClient = () =>
  ({
    id: 'signed-oauth-query',
    fetchPlugins: [
      {
        id: 'signed-oauth-query',
        name: 'signed-oauth-query',
        hooks: {
          async onRequest(ctx) {
            if (typeof window === 'undefined') return;
            if (ctx.method === 'GET' || typeof ctx.body !== 'string') return;

            const signed = getSignedQuery();
            if (!signed) return;

            const body = JSON.parse(ctx.body || '{}');
            if (body.oauth_query) return;
            ctx.body = JSON.stringify({ ...body, oauth_query: signed });
          },
          async onSuccess(ctx) {
            // Signed in: the authorization flow resumes from here. Not yet
            // while the second factor is pending (/login/two-factor).
            if (typeof window === 'undefined') return;
            const url = ctx.request.url.toString();
            const pendingSecondFactor = !!(
              ctx.data as { twoFactorRedirect?: boolean } | null
            )?.twoFactorRedirect;
            if (
              (url.includes('/sign-in/') ||
                url.includes('/two-factor/verify')) &&
              !pendingSecondFactor
            ) {
              sessionStorage.removeItem(PENDING_OAUTH_QUERY);
            }
            const data = ctx.data as {
              redirect?: boolean;
              url?: string;
            } | null;
            if (data?.redirect && data.url) {
              const url = data.url;
              resumingOAuthFlowTo = url;
              // oauthProviderClient navigates there; if that navigation got
              // lost, try once more (timers do not run once the page is gone)
              setTimeout(
                () => window.location.assign(url),
                OAUTH_REDIRECT_RETRY_MS
              );
            }
          },
        },
      },
    ],
  }) satisfies BetterAuthClientPlugin;

export const authClient = createAuthClient({
  baseURL:
    typeof window === 'undefined'
      ? envClient.VITE_BASE_URL
      : window.location.origin,
  plugins: [
    inferAdditionalFields<Auth>(),
    adminClient({
      ...permissions,
    }),
    emailOTPClient(),
    twoFactorClient(),
    signedOAuthQueryClient(),
    // Resumes the OAuth authorization flow after signing in on /login
    oauthProviderClient(),
  ],
});
