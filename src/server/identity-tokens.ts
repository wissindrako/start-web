import { createRemoteJWKSet, jwtVerify } from 'jose';

import { envClient } from '@/env/client';

export const ISSUER = `${envClient.VITE_BASE_URL}/api/auth`;

// The identity center's own API, as an OAuth resource: systems get tokens
// for it with their service credentials (client_credentials grant)
export const CENTER_API_RESOURCE = `${envClient.VITE_BASE_URL}/api/rest`;

// What a system's service credentials can do in the external API
export const SERVICE_SCOPES = ['permissions:read', 'catalog:write'] as const;
export type ServiceScope = (typeof SERVICE_SCOPES)[number];

let jwks: ReturnType<typeof createRemoteJWKSet> | undefined;

// Verifies a service access token issued by this identity center for its
// own API. Returns the OAuth client it was issued to and its scopes.
export async function verifyServiceToken(token: string) {
  jwks ??= createRemoteJWKSet(new URL(`${ISSUER}/jwks`));
  const { payload } = await jwtVerify(token, jwks, {
    issuer: ISSUER,
    audience: CENTER_API_RESOURCE,
  });

  const clientId = payload.azp ?? payload.client_id;
  return {
    clientId: typeof clientId === 'string' ? clientId : null,
    scopes: typeof payload.scope === 'string' ? payload.scope.split(' ') : [],
  };
}
