import { ORPCError } from '@orpc/client';
import { getRequestHeaders } from '@tanstack/react-start/server';
import { z } from 'zod';

import { zRole } from '@/features/role/schema';
import { zSession, zUser } from '@/features/user/schema';
import { auth } from '@/server/auth';
import { Prisma } from '@/server/db/generated/client';
import { protectedProcedure } from '@/server/orpc';

const tags = ['users'];

export default {
  getAll: protectedProcedure({
    permission: {
      user: ['list'],
    },
  })
    .route({
      method: 'GET',
      path: '/users',
      tags,
    })
    .input(
      z
        .object({
          cursor: z.string().optional(),
          limit: z.coerce.number().int().min(1).max(100).prefault(20),
          searchTerm: z.string().trim().optional().prefault(''),
        })
        .prefault({})
    )
    .output(
      z.object({
        items: z.array(zUser()),
        nextCursor: z.string().optional(),
        total: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      const where = {
        OR: [
          {
            name: {
              contains: input.searchTerm,
              mode: 'insensitive',
            },
          },
          {
            email: {
              contains: input.searchTerm,
              mode: 'insensitive',
            },
          },
        ],
      } satisfies Prisma.UserWhereInput;

      context.logger.info('Getting users from database');
      const [total, items] = await Promise.all([
        context.db.user.count({
          where,
        }),
        context.db.user.findMany({
          // Get an extra item at the end which we'll use as next cursor
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: {
            name: 'asc',
          },
          where,
        }),
      ]);

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
        total,
      };
    }),

  getById: protectedProcedure({
    permission: {
      user: ['list'],
    },
  })
    .route({
      method: 'GET',
      path: '/users/{id}',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      context.logger.info('Getting user');
      const user = await context.db.user.findUnique({
        where: { id: input.id },
      });

      if (!user) {
        context.logger.warn('Unable to find user with the provided input');
        throw new ORPCError('NOT_FOUND');
      }

      return user;
    }),

  updateById: protectedProcedure({
    permission: {
      user: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}',
      tags,
    })
    .input(
      zUser().pick({
        id: true,
        name: true,
        email: true,
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      context.logger.info('Getting current user email');
      const currentUser = await context.db.user.findUnique({
        where: { id: input.id },
        select: { email: true },
      });

      if (!currentUser) {
        context.logger.warn('Unable to find user with the provided input');
        throw new ORPCError('NOT_FOUND');
      }

      context.logger.info('Update user');
      return await context.db.user.update({
        where: { id: input.id },
        data: {
          name: input.name ?? '',
          email: input.email,
          // Set email as verified if admin changed the email
          emailVerified: currentUser.email !== input.email ? true : undefined,
        },
      });
    }),

  create: protectedProcedure({
    permission: {
      user: ['create'],
    },
  })
    .route({
      method: 'POST',
      path: '/users',
      tags,
    })
    .input(
      zUser().pick({
        name: true,
        email: true,
        role: true,
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      context.logger.info('Create user');
      return await context.db.user.create({
        data: {
          email: input.email,
          emailVerified: true,
          name: input.name ?? '',
          role: input.role ?? 'user',
        },
      });
    }),

  deleteById: protectedProcedure({
    permission: {
      user: ['delete'],
    },
  })
    .route({
      method: 'DELETE',
      path: '/users/{id}',
      tags,
    })
    .input(
      zUser().pick({
        id: true,
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      if (context.user.id === input.id) {
        context.logger.warn('Prevent to delete the current connected user');
        throw new ORPCError('BAD_REQUEST', {
          message: 'You cannot delete yourself',
        });
      }

      context.logger.info('Delete user');
      const response = await auth.api.removeUser({
        body: {
          userId: input.id,
        },
        headers: getRequestHeaders(),
      });

      if (!response.success) {
        context.logger.error('Failed to delete the user');
        throw new ORPCError('INTERNAL_SERVER_ERROR');
      }
    }),

  getUserSessions: protectedProcedure({
    permission: {
      session: ['list'],
    },
  })
    .route({
      method: 'GET',
      path: '/users/{userId}/sessions',
      tags,
    })
    .input(
      z.object({
        userId: z.string(),
        cursor: z.string().optional(),
        limit: z.coerce.number().int().min(1).max(100).prefault(20),
      })
    )
    .output(
      z.object({
        items: z.array(zSession()),
        nextCursor: z.string().optional(),
        total: z.number(),
      })
    )
    .handler(async ({ context, input }) => {
      const where = {
        userId: input.userId,
      } satisfies Prisma.SessionWhereInput;

      context.logger.info('Getting user sessions from database');
      const [total, items] = await Promise.all([
        context.db.session.count({
          where,
        }),
        context.db.session.findMany({
          // Get an extra item at the end which we'll use as next cursor
          take: input.limit + 1,
          cursor: input.cursor ? { id: input.cursor } : undefined,
          orderBy: {
            createdAt: 'desc',
          },
          where,
        }),
      ]);

      let nextCursor: typeof input.cursor | undefined = undefined;
      if (items.length > input.limit) {
        const nextItem = items.pop();
        nextCursor = nextItem?.id;
      }

      return {
        items,
        nextCursor,
        total,
      };
    }),

  revokeUserSessions: protectedProcedure({
    permission: {
      session: ['revoke'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/sessions/revoke',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      if (context.user.id === input.id) {
        context.logger.warn(
          'Prevent to revoke all sesssions of the current connected user'
        );
        throw new ORPCError('BAD_REQUEST', {
          message: 'You cannot revoke all your sessions',
        });
      }

      context.logger.info('Revoke all user sessions');
      const response = await auth.api.revokeUserSessions({
        body: {
          userId: input.id,
        },
        headers: getRequestHeaders(),
      });

      if (!response.success) {
        context.logger.error('Failed to revoke all the user sessions');
        throw new ORPCError('INTERNAL_SERVER_ERROR');
      }
    }),

  revokeUserSession: protectedProcedure({
    permission: {
      session: ['revoke'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/sessions/{sessionToken}/revoke',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
        sessionToken: z.string(),
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      if (context.session.token === input.sessionToken) {
        context.logger.warn(
          'Prevent to revoke the current connected user session'
        );
        throw new ORPCError('BAD_REQUEST', {
          message: 'You cannot revoke your current session',
        });
      }

      context.logger.info('Revoke user session');
      const response = await auth.api.revokeUserSession({
        body: {
          sessionToken: input.sessionToken,
        },
        headers: getRequestHeaders(),
      });

      if (!response.success) {
        context.logger.error('Failed to revoke the user session');
        throw new ORPCError('INTERNAL_SERVER_ERROR');
      }
    }),
  updateImage: protectedProcedure({
    permission: {
      user: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/image',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
        image: z.string().nullable(),
        imageThumbnail: z.string().nullable(),
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      const user = await context.db.user.findUnique({
        where: { id: input.id },
      });
      if (!user) throw new ORPCError('NOT_FOUND');

      context.logger.info('Update user image');
      return await context.db.user.update({
        where: { id: input.id },
        data: {
          image: input.image,
          imageThumbnail: input.imageThumbnail,
        },
      });
    }),

  setVerified: protectedProcedure({
    permission: {
      user: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/set-verified',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
        verified: z.boolean(),
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      const user = await context.db.user.findUnique({
        where: { id: input.id },
      });
      if (!user) throw new ORPCError('NOT_FOUND');

      context.logger.info('Set user verified status');
      return await context.db.user.update({
        where: { id: input.id },
        data: { verifiedAt: input.verified ? new Date() : null },
      });
    }),

  banUser: protectedProcedure({
    permission: {
      user: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/ban',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
        reason: z.string().optional(),
        banExpires: z.coerce.date().optional(),
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      if (context.user.id === input.id) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'You cannot ban yourself',
        });
      }
      const user = await context.db.user.findUnique({
        where: { id: input.id },
      });
      if (!user) throw new ORPCError('NOT_FOUND');

      context.logger.info('Banning user');
      return await context.db.user.update({
        where: { id: input.id },
        data: {
          banned: true,
          banReason: input.reason ?? null,
          banExpires: input.banExpires ?? null,
        },
      });
    }),

  unbanUser: protectedProcedure({
    permission: {
      user: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/users/{id}/unban',
      tags,
    })
    .input(
      z.object({
        id: z.string(),
      })
    )
    .output(zUser())
    .handler(async ({ context, input }) => {
      const user = await context.db.user.findUnique({
        where: { id: input.id },
      });
      if (!user) throw new ORPCError('NOT_FOUND');

      context.logger.info('Unbanning user');
      return await context.db.user.update({
        where: { id: input.id },
        data: { banned: false, banReason: null, banExpires: null },
      });
    }),

  getUserRoles: protectedProcedure({
    permission: { user: ['update'] },
  })
    .route({ method: 'GET', path: '/users/{id}/roles', tags })
    .input(z.object({ id: z.string() }))
    .output(z.array(zRole()))
    .handler(async ({ context, input }) => {
      context.logger.info('Getting user roles');
      const user = await context.db.user.findUnique({
        where: { id: input.id },
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                  _count: { select: { userAssignments: true } },
                },
              },
            },
          },
        },
      });
      if (!user) throw new ORPCError('NOT_FOUND');
      return user.roles.map((a) => a.role);
    }),

  updateUserRoles: protectedProcedure({
    permission: { user: ['update'] },
  })
    .route({ method: 'POST', path: '/users/{id}/roles', tags })
    .input(z.object({ id: z.string(), roleIds: z.array(z.string()) }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      context.logger.info('Updating user roles');
      await context.db.userRoleAssignment.deleteMany({
        where: { userId: input.id },
      });
      if (input.roleIds.length > 0) {
        await context.db.userRoleAssignment.createMany({
          data: input.roleIds.map((roleId) => ({ userId: input.id, roleId })),
        });
      }
    }),
};
