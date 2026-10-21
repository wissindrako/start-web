import { createFileRoute } from '@tanstack/react-router';

import { auth } from '@/server/auth';

// OAuth endpoints that browser apps (public clients) call with fetch from
// their own origin. They never rely on cookies, so any origin is allowed
// without credentials, like a public OpenID provider.
const CORS_PATHS = [
  '/api/auth/oauth2/token',
  '/api/auth/oauth2/revoke',
  '/api/auth/oauth2/userinfo',
  '/api/auth/jwks',
  '/api/auth/.well-known/openid-configuration',
];

const isCorsPath = (request: Request) =>
  CORS_PATHS.includes(new URL(request.url).pathname);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  'Access-Control-Max-Age': '600',
};

const handle = async (request: Request) => {
  const response = await auth.handler(request);
  if (!isCorsPath(request)) return response;

  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(CORS_HEADERS)) {
    headers.set(key, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
      OPTIONS: ({ request }) =>
        isCorsPath(request)
          ? new Response(null, { status: 204, headers: CORS_HEADERS })
          : new Response(null, { status: 404 }),
    },
  },
});
