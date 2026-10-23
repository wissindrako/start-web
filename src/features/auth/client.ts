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

const getSignedQuery = () => {
  const search = new URLSearchParams(window.location.search);
  if (search.has('sig')) {
    const signed = restoreSignedQuery(search).toString();
    sessionStorage.setItem(PENDING_OAUTH_QUERY, signed);
    return signed;
  }

  // Only while still signing in, and only until the signed query expires
  if (!window.location.pathname.startsWith('/login')) return null;
  const pending = sessionStorage.getItem(PENDING_OAUTH_QUERY);
  const exp = Number(new URLSearchParams(pending ?? '').get('exp'));
  return pending && exp * 1000 > Date.now() ? pending : null;
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
    sessionStorage.setItem(
      TAKEN_OAUTH_QUERY,
      restoreSignedQuery(search).toString()
    );
    window.history.replaceState(null, '', window.location.pathname);
  }
  // Also after a reload, until the signed query expires
  const taken = sessionStorage.getItem(TAKEN_OAUTH_QUERY);
  const exp = Number(new URLSearchParams(taken ?? '').get('exp'));
  return taken && exp * 1000 > Date.now() ? taken : null;
};

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
