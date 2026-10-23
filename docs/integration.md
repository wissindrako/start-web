# Connecting a system to nucleo-admin

nucleo-admin is the identity center: users sign in here once and every
connected system (any language or framework) trusts it. Everything a system
needs is a standard: **OpenID Connect** to sign users in, **JWT access
tokens** validated with the published keys, and **OAuth client_credentials**
for the system's backend to call this center's API.

Examples below use the local URLs (`http://localhost:3004`). In production
use your own domain over https.

| What | URL |
|---|---|
| Issuer | `http://localhost:3004/api/auth` |
| Discovery | `http://localhost:3004/api/auth/.well-known/openid-configuration` |
| Keys (JWKS) | `http://localhost:3004/api/auth/jwks` |
| Token endpoint | `http://localhost:3004/api/auth/oauth2/token` |
| External API | `http://localhost:3004/api/rest/external/...` |
| OpenAPI (all endpoints) | `http://localhost:3004/api/openapi/app` |

## 1. Register the system

In **Manager → External systems → New**, then on the system's page:

1. **OIDC connection**: the URL of the system's API (it becomes the `aud`
   of its access tokens), the frontend's redirect URIs and, optionally, where
   to return after logout. Pick *public* for browser or mobile apps (PKCE, no
   secret) or *confidential* if a server handles the login. Copy the
   client ID.
2. **Service credentials**: create them and copy the client ID and secret
   (the secret is shown once) into the system's backend configuration.
3. Give users roles or privileges for the system (Manager → Roles / Users).

People without an account join through **Manager → Users → Invitations**:
pick the system and at least one of its roles. The email links to the
system's app (the origin of its first web redirect URI, so list the
frontend's callback first); the person signs in there with the invited
email and gets the roles. People who already have an account get access by
assigning them a role of the system on their profile.

## 2. Sign users in (frontend)

Authorization Code + PKCE against the URLs in the discovery document:

```
GET /api/auth/oauth2/authorize
  ?response_type=code
  &client_id=<client id>
  &redirect_uri=<registered redirect URI>
  &scope=openid profile email offline_access
  &state=<random>
  &code_challenge=<S256(verifier)>&code_challenge_method=S256
  &resource=<the system's API URL>
```

Back on the redirect URI, exchange the code:

```
POST /api/auth/oauth2/token   (application/x-www-form-urlencoded)
grant_type=authorization_code&code=...&redirect_uri=...&client_id=...
&code_verifier=...&resource=<the system's API URL>
```

The response has `access_token` (send it to the system's API as
`Authorization: Bearer ...`), `refresh_token` (renew with
`grant_type=refresh_token`, sending `resource` again) and `id_token`.

**`resource` is required**: without it the access token is not a JWT for
the system's API. The token, revoke, userinfo, JWKS and discovery endpoints
allow CORS, so a browser app can call them directly.

To log out, clear the local tokens and send the browser to
`end_session_endpoint` with `id_token_hint`, `client_id` and a registered
`post_logout_redirect_uri`.

Any certified OIDC client library works (oidc-client-ts, AppAuth,
openid-client, Laravel Socialite drivers, Spring Security...). A minimal
browser implementation without dependencies is `src/services/auth/oidc.ts`
in the reference frontend.

## 3. Validate tokens (backend)

Each request carries a JWT. Validate, with any JOSE/JWT library:

- **signature** with the keys from the JWKS URL (algorithm `EdDSA`; cache
  the keys, refetch when an unknown `kid` appears);
- **`iss`** = the issuer above;
- **`aud`** includes the system's API URL (reject tokens for other systems);
- **`exp`** (access tokens last 15 minutes by default,
  `AUTH_OAUTH_ACCESS_TOKEN_EXPIRATION_IN_SECONDS`).

Claims:

| Claim | Meaning |
|---|---|
| `sub` | User id in the identity center. Use it to link the user to your own data (keep a local copy keyed by it). |
| `roles` | The user's role names in **this** system. |
| `permissions` | The user's effective permissions in **this** system, as `subject:action` (`users:read`). Roles + granted privileges − denied ones. |
| `scope`, `azp` | Granted scopes and the OAuth client that requested the token. |

Name, email and picture come from `GET /api/auth/oauth2/userinfo` with the
same token (scopes `profile email`).

### Where to read permissions from

- **From the token** (simplest): use the `permissions` claim. No calls to
  the center; a change reaches the system when the token is renewed (at most
  the token lifetime).
- **From the external API** (immediate): `GET /external/users/{sub}/permissions`
  with a short cache (seconds). Use it when a revoked permission must stop
  working right away.

## 4. Call the external API (backend)

Get a service token with the service credentials (HTTP Basic auth):

```bash
curl -u "$CLIENT_ID:$CLIENT_SECRET" \
  -d grant_type=client_credentials \
  -d "scope=permissions:read catalog:write" \
  -d resource=http://localhost:3004/api/rest \
  http://localhost:3004/api/auth/oauth2/token
```

Reuse it until shortly before `expires_in`, and send it as
`Authorization: Bearer ...`. Regenerating the credentials in the center
invalidates the old ones immediately.

| Endpoint | Scope | What it does |
|---|---|---|
| `GET /api/rest/external/users/{userId}/permissions` | `permissions:read` | `{ roles: [{id, name}], permissions: [{subject, action}] }` of the user in the calling system. |
| `PUT /api/rest/external/modules` | `catalog:write` | Declares the system's permission catalog: `{ modules: [{ name, actions: [...] }] }`. Modules not listed are removed (except `account`). Call it on startup. |

The system's **API key** (`X-Api-Key` header) still works for both
endpoints, for older integrations. Prefer the service credentials.

### Permission catalog

Each system decides its own permissions and publishes them; the center only
assigns them. A permission is a module (subject) and an action:

```json
{ "modules": [
  { "name": "users", "actions": ["read", "create", "update", "delete"] },
  { "name": "audit", "actions": ["read"] }
] }
```

In tokens and checks it is written `users:read`. Map it to your own naming
as you like (the reference backend uses `users.read`).

## Reference implementations

- **NestJS backend**: `src/identity` in base-nest: JWT validation with
  JWKS, local user copy, permissions from the token or the API, service
  token cache, catalog sync on startup. Settings: `IDENTITY_*` in its env.
- **Next.js frontend**: `src/services/auth/oidc.ts` in the Next.js
  frontend: PKCE login, refresh and logout.

## Checklist for a new system

- [ ] System created, OIDC connection with its API URL and redirect URIs
- [ ] Service credentials in the backend's configuration
- [ ] Backend validates signature, `iss`, `aud` and `exp`
- [ ] Backend publishes its catalog on startup
- [ ] Roles or privileges assigned to users for the system
