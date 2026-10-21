import { ORPCError } from '@orpc/client';
import { getRequestHeaders } from '@tanstack/react-start/server';
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
import {
  CENTER_API_RESOURCE,
  ISSUER,
  SERVICE_SCOPES,
} from '@/server/identity-tokens';
import { protectedProcedure } from '@/server/orpc';

type Db = typeof db;

const tags = ['external-systems'];

type AuthApiError = {
  statusCode: number;
  message: string;
  body?: { error_description?: string; message?: string };
};

// Better Auth (and its HTTP layer, better-call, with its own error class)
// rejects invalid OAuth settings with a 4xx API error
const isAuthApiError = (error: unknown): error is AuthApiError =>
  typeof error === 'object' &&
  error !== null &&
  typeof (error as AuthApiError).statusCode === 'number' &&
  'body' in error;

// Returns those errors as a 400 with their description, not a 500
async function withOAuthErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (isAuthApiError(error) && error.statusCode < 500) {
      throw new ORPCError('BAD_REQUEST', {
        message:
          error.body?.error_description ?? error.body?.message ?? error.message,
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

const zServiceClient = () =>
  z.object({
    clientId: z.string().nullish(),
    tokenEndpoint: z.string(),
    audience: z.string(),
    scopes: z.array(z.string()),
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
          // An empty list is rejected: omit it instead
          post_logout_redirect_uris: input.postLogoutRedirectUris?.length
            ? input.postLogoutRedirectUris
            : undefined,
          scope: OAUTH_SCOPES,
          // OIDC requires https for web clients; plain http is only allowed
          // on loopback (native) redirect URIs, i.e. local development
          application_type: input.redirectUris.every(isHttpLoopback)
            ? ('native' as const)
            : ('web' as const),
        };

        let clientId = system.oauthClientId;
        let clientSecret: string | undefined;

        try {
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
                  input.clientType === 'public'
                    ? 'none'
                    : 'client_secret_basic',
                resources: [input.resourceIdentifier],
              },
            });
            clientId = client.client_id;
            clientSecret = client.client_secret;
          }

          await auth.api.adminLinkClientResource({
            headers: getRequestHeaders(),
            params: {
              identifier: input.resourceIdentifier,
              client_id: clientId,
            },
          });
        } catch (error) {
          // Do not leave behind the resource this call just created
          if (!resourceExists) {
            await auth.api
              .adminDeleteOAuthResource({
                headers: getRequestHeaders(),
                params: { identifier: input.resourceIdentifier },
              })
              .catch(() => undefined);
          }
          throw error;
        }

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

  // Service credentials: what the system's backend uses to call the
  // external API with the standard OAuth client_credentials grant
  getServiceClient: protectedProcedure({
    permission: { externalSystem: ['read'] },
  })
    .route({
      method: 'GET',
      path: '/external-systems/{id}/service-client',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(zServiceClient())
    .handler(async ({ context, input }) => {
      const system = await context.db.externalSystem.findUnique({
        where: { id: input.id },
        select: { serviceClientId: true },
      });
      if (!system) throw new ORPCError('NOT_FOUND');
      return toServiceClient(system.serviceClientId);
    }),

  // Creates the credentials, or replaces them (new id and secret: the old
  // ones stop working). The secret is only returned here, once.
  createServiceClient: protectedProcedure({
    permission: { externalSystem: ['update'] },
  })
    .route({
      method: 'POST',
      path: '/external-systems/{id}/service-client',
      tags,
    })
    .input(z.object({ id: z.string() }))
    .output(zServiceClient().extend({ clientSecret: z.string() }))
    .handler(async ({ context, input }) => {
      return withOAuthErrors(async () => {
        const system = await context.db.externalSystem.findUnique({
          where: { id: input.id },
        });
        if (!system) throw new ORPCError('NOT_FOUND');

        const centerResource = await context.db.oauthResource.findUnique({
          where: { identifier: CENTER_API_RESOURCE },
          select: { id: true },
        });
        if (!centerResource) {
          await auth.api.adminCreateOAuthResource({
            headers: getRequestHeaders(),
            body: {
              identifier: CENTER_API_RESOURCE,
              name: 'Identity center API',
            },
          });
        }

        const client = await auth.api.adminCreateOAuthClient({
          headers: getRequestHeaders(),
          body: {
            client_name: `${system.label ?? system.name} (service)`,
            grant_types: ['client_credentials'],
            token_endpoint_auth_method: 'client_secret_basic',
            client_credentials_scopes: [...SERVICE_SCOPES],
            resources: [CENTER_API_RESOURCE],
          },
        });
        if (!client.client_secret) {
          throw new ORPCError('INTERNAL_SERVER_ERROR', {
            message: 'No client secret was issued',
          });
        }

        await auth.api.adminLinkClientResource({
          headers: getRequestHeaders(),
          params: {
            identifier: CENTER_API_RESOURCE,
            client_id: client.client_id,
          },
        });

        await context.db.externalSystem.update({
          where: { id: input.id },
          data: { serviceClientId: client.client_id },
        });

        // Replaced credentials stop working right away
        if (system.serviceClientId) {
          await context.db.oauthClient.deleteMany({
            where: { clientId: system.serviceClientId },
          });
        }

        context.logger.info(
          { systemId: input.id, clientId: client.client_id },
          'External system service credentials issued'
        );

        return {
          ...toServiceClient(client.client_id),
          clientSecret: client.client_secret,
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

      // Its OAuth clients (and every token they were issued) and resource
      // go too
      const clientIds = [system.oauthClientId, system.serviceClientId].filter(
        (clientId): clientId is string => !!clientId
      );
      if (clientIds.length) {
        await context.db.oauthClient.deleteMany({
          where: { clientId: { in: clientIds } },
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
  const issuer = ISSUER;
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

function toServiceClient(clientId: string | null) {
  return {
    clientId,
    tokenEndpoint: `${ISSUER}/oauth2/token`,
    audience: CENTER_API_RESOURCE,
    scopes: [...SERVICE_SCOPES],
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
