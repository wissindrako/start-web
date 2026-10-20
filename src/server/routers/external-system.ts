import { ORPCError } from '@orpc/client';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { APIError } from 'better-auth';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';

import { envClient } from '@/env/client';
import {
  zExternalSystem,
  zExternalSystemWithKey,
  zFormFieldsExternalSystem,
} from '@/features/external-system/schema';
import { auth } from '@/server/auth';
import { db } from '@/server/db';
import { protectedProcedure } from '@/server/orpc';

type Db = typeof db;

const tags = ['external-systems'];

// Better Auth rejects invalid OAuth settings (e.g. a non-https redirect URI)
// with an APIError: return it as a 400 with its description, not a 500
async function withOAuthErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof APIError && error.statusCode < 500) {
      const body = error.body as { error_description?: string } | undefined;
      throw new ORPCError('BAD_REQUEST', {
        message: body?.error_description ?? error.message,
      });
    }
    throw error;
  }
}

const includeModules = {
  modules: { orderBy: { order: 'asc' as const } },
};

const OAUTH_SCOPES = 'openid profile email offline_access';

const zOAuthConfig = () =>
  z.object({
    configured: z.boolean(),
    issuer: z.string(),
    discoveryUrl: z.string(),
    clientId: z.string().nullish(),
    clientType: z.enum(['public', 'confidential']).nullish(),
    redirectUris: z.array(z.string()),
    postLogoutRedirectUris: z.array(z.string()),
    resourceIdentifier: z.string().nullish(),
  });

export default {
  getAll: protectedProcedure({
    permission: { role: ['read'] },
  })
    .route({ method: 'GET', path: '/external-systems', tags })
    .input(
      z
        .object({
          searchTerm: z.string().trim().optional().prefault(''),
        })
        .prefault({})
    )
    .output(z.array(zExternalSystem()))
    .handler(async ({ context, input }) => {
      const where = input.searchTerm
        ? {
            OR: [
              {
                name: {
                  contains: input.searchTerm,
                },
              },
              {
                label: {
                  contains: input.searchTerm,
                },
              },
            ],
          }
        : {};

      return context.db.externalSystem.findMany({
        where,
        orderBy: { name: 'asc' },
        include: includeModules,
      });
    }),

  // Returns the API key: only for those who manage external systems
  getById: protectedProcedure({
    permission: { externalSystem: ['read'] },
  })
    .route({ method: 'GET', path: '/external-systems/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(zExternalSystemWithKey())
    .handler(async ({ context, input }) => {
      const system = await context.db.externalSystem.findUnique({
        where: { id: input.id },
        include: includeModules,
      });
      if (!system) throw new ORPCError('NOT_FOUND');
      return system;
    }),

  rotateApiKey: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({
      method: 'POST',
      path: '/external-systems/{id}/rotate-api-key',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(zExternalSystemWithKey())
    .handler(async ({ context, input }) => {
      await assertExists(context.db, input.id);
      return context.db.externalSystem.update({
        where: { id: input.id },
        data: { apiKey: randomUUID() },
        include: includeModules,
      });
    }),

  create: protectedProcedure({
    permission: { externalSystem: ['create'] },
  })
    .route({ method: 'POST', path: '/external-systems', tags })
    .input(zFormFieldsExternalSystem())
    .output(zExternalSystem())
    .handler(async ({ context, input }) => {
      const modules = withDefaultAccountModule(input.modules);
      return context.db.externalSystem.create({
        data: {
          name: input.name.trim().toLowerCase(),
          label: input.label ?? null,
          modules: {
            create: modules.map((m, i) => ({
              name: m.name.trim().toLowerCase(),
              actions: m.actions,
              order: m.order ?? i,
            })),
          },
        },
        include: includeModules,
      });
    }),

  updateById: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({ method: 'POST', path: '/external-systems/{id}', tags })
    .input(zFormFieldsExternalSystem().extend({ id: z.string() }))
    .output(zExternalSystem())
    .handler(async ({ context, input }) => {
      await assertExists(context.db, input.id);

      // Replace all modules
      await context.db.externalModule.deleteMany({
        where: { systemId: input.id },
      });

      return context.db.externalSystem.update({
        where: { id: input.id },
        data: {
          name: input.name.trim().toLowerCase(),
          label: input.label ?? null,
          modules: {
            create: input.modules.map((m, i) => ({
              name: m.name.trim().toLowerCase(),
              actions: m.actions,
              order: m.order ?? i,
            })),
          },
        },
        include: includeModules,
      });
    }),

  // How the system connects to the identity center: its OAuth client and
  // the resource (API URL) its access tokens are issued for
  getOAuthConfig: protectedProcedure({
    permission: { externalSystem: ['read'] },
  })
    .route({ method: 'GET', path: '/external-systems/{id}/oauth', tags })
    .input(z.object({ id: z.string() }))
    .output(zOAuthConfig())
    .handler(async ({ context, input }) => {
      const system = await context.db.externalSystem.findUnique({
        where: { id: input.id },
        include: { oauthClient: true },
      });
      if (!system) throw new ORPCError('NOT_FOUND');

      return toOAuthConfig(system.oauthClient, system.resourceIdentifier);
    }),

  // Creates (or updates) the system's OAuth client as a trusted first-party
  // client (no consent screen) bound to its API as resource, so the access
  // tokens it gets are JWTs with that API as audience. The client secret of
  // a confidential client is only returned when the client is created.
  configureOAuth: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({ method: 'POST', path: '/external-systems/{id}/oauth', tags })
    .input(
      z.object({
        id: z.string(),
        redirectUris: z.array(z.url()).min(1),
        postLogoutRedirectUris: z.array(z.url()).optional(),
        resourceIdentifier: z.url(),
        // public: browser or mobile app (PKCE, no secret)
        clientType: z.enum(['public', 'confidential']).prefault('public'),
      })
    )
    .output(zOAuthConfig().extend({ clientSecret: z.string().nullish() }))
    .handler(async ({ context, input }) => {
      return withOAuthErrors(async () => {
        const system = await context.db.externalSystem.findUnique({
          where: { id: input.id },
        });
        if (!system) throw new ORPCError('NOT_FOUND');

        const name = system.label ?? system.name;

        // Resource (audience): a new one when the API URL changes. A leftover
        // resource no system owns (e.g. an interrupted setup) is reused.
        if (system.resourceIdentifier !== input.resourceIdentifier) {
          const owner = await context.db.externalSystem.findUnique({
            where: { resourceIdentifier: input.resourceIdentifier },
            select: { id: true },
          });
          if (owner) {
            throw new ORPCError('CONFLICT', {
              message: 'Another system already uses this API URL',
            });
          }
        }

        const resourceExists = !!(await context.db.oauthResource.findUnique({
          where: { identifier: input.resourceIdentifier },
          select: { id: true },
        }));

        if (!resourceExists) {
          await auth.api.adminCreateOAuthResource({
            headers: getRequestHeaders(),
            body: { identifier: input.resourceIdentifier, name },
          });
        }

        const settings = {
          client_name: name,
          redirect_uris: input.redirectUris,
          post_logout_redirect_uris: input.postLogoutRedirectUris,
          scope: OAUTH_SCOPES,
          // OIDC requires https for web clients; plain http is only allowed
          // on loopback (native) redirect URIs, i.e. local development
          application_type: input.redirectUris.every(isHttpLoopback)
            ? ('native' as const)
            : ('web' as const),
        };

        let clientId = system.oauthClientId;
        let clientSecret: string | undefined;

        if (clientId) {
          await auth.api.adminUpdateOAuthClient({
            headers: getRequestHeaders(),
            body: { client_id: clientId, update: settings },
          });
        } else {
          const client = await auth.api.adminCreateOAuthClient({
            headers: getRequestHeaders(),
            body: {
              ...settings,
              skip_consent: true,
              enable_end_session: true,
              require_pkce: true,
              grant_types: ['authorization_code', 'refresh_token'],
              token_endpoint_auth_method:
                input.clientType === 'public' ? 'none' : 'client_secret_basic',
              resources: [input.resourceIdentifier],
            },
          });
          clientId = client.client_id;
          clientSecret = client.client_secret;
        }

        await auth.api.adminLinkClientResource({
          headers: getRequestHeaders(),
          params: { identifier: input.resourceIdentifier, client_id: clientId },
        });

        if (
          system.resourceIdentifier &&
          system.resourceIdentifier !== input.resourceIdentifier
        ) {
          await auth.api.adminDeleteOAuthResource({
            headers: getRequestHeaders(),
            params: { identifier: system.resourceIdentifier },
          });
        }

        const updated = await context.db.externalSystem.update({
          where: { id: input.id },
          data: {
            oauthClientId: clientId,
            resourceIdentifier: input.resourceIdentifier,
          },
          include: { oauthClient: true },
        });

        context.logger.info(
          { systemId: input.id, clientId },
          'External system OAuth configured'
        );

        return {
          ...toOAuthConfig(updated.oauthClient, updated.resourceIdentifier),
          clientSecret,
        };
      });
    }),

  deleteById: protectedProcedure({
    permission: { externalSystem: ['delete'] },
  })
    .route({ method: 'DELETE', path: '/external-systems/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      const system = await context.db.externalSystem.delete({
        where: { id: input.id },
      });

      // Its OAuth client (and every token it was issued) and resource go too
      if (system.oauthClientId) {
        await context.db.oauthClient.delete({
          where: { clientId: system.oauthClientId },
        });
      }
      if (system.resourceIdentifier) {
        await auth.api.adminDeleteOAuthResource({
          headers: getRequestHeaders(),
          params: { identifier: system.resourceIdentifier },
        });
      }
    }),
};

const LOOPBACK_HOSTS = ['localhost', '127.0.0.1', '[::1]'];
const isHttpLoopback = (uri: string) => {
  const url = new URL(uri);
  return url.protocol === 'http:' && LOOPBACK_HOSTS.includes(url.hostname);
};

// Better Auth stores URI lists as JSON text on MySQL
const parseList = (value: string | null | undefined): string[] => {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [value];
  } catch {
    return value
      .split(',')
      .map((v) => v.trim())
      .filter(Boolean);
  }
};

const getClientType = (tokenEndpointAuthMethod: string | null) =>
  tokenEndpointAuthMethod === 'none'
    ? ('public' as const)
    : ('confidential' as const);

function toOAuthConfig(
  client: {
    clientId: string;
    tokenEndpointAuthMethod: string | null;
    redirectUris: string;
    postLogoutRedirectUris: string | null;
  } | null,
  resourceIdentifier: string | null
) {
  const issuer = `${envClient.VITE_BASE_URL}/api/auth`;
  return {
    configured: !!client && !!resourceIdentifier,
    issuer,
    discoveryUrl: `${issuer}/.well-known/openid-configuration`,
    clientId: client?.clientId,
    clientType: client ? getClientType(client.tokenEndpointAuthMethod) : null,
    redirectUris: parseList(client?.redirectUris),
    postLogoutRedirectUris: parseList(client?.postLogoutRedirectUris),
    resourceIdentifier,
  };
}

async function assertExists(prisma: Db, id: string) {
  const system = await prisma.externalSystem.findUnique({ where: { id } });
  if (!system) throw new ORPCError('NOT_FOUND');
}

function withDefaultAccountModule(
  modules: Array<{ name: string; actions: string[]; order?: number }>
) {
  const hasAccount = modules.some(
    (m) => m.name.trim().toLowerCase() === 'account'
  );
  if (hasAccount) return modules;
  return [
    { name: 'account', actions: ['read', 'update'], order: 0 },
    ...modules,
  ];
}
