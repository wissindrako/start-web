import { ORPCError } from '@orpc/client';
import dayjs from 'dayjs';
import { z } from 'zod';

import { INVITATION_EXPIRATION_IN_DAYS } from '@/features/auth/config';
import { db } from '@/server/db';
import { normalizeEmail, sendInvitationEmail } from '@/server/invitations';
import { protectedProcedure } from '@/server/orpc';
import { assertRequesterHolds } from '@/server/permissions';

type Db = typeof db;

const tags = ['invitations'];

const INVITATION_STATUSES = ['pending', 'accepted', 'expired'] as const;

const zInvitation = () =>
  z.object({
    id: z.string(),
    email: z.string(),
    status: z.enum(INVITATION_STATUSES),
    expiresAt: z.date(),
    acceptedAt: z.date().nullish(),
    createdAt: z.date(),
    invitedBy: z.object({ id: z.string(), name: z.string() }).nullish(),
    roles: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        systemId: z.string().nullish(),
        externalSystem: z
          .object({ name: z.string(), label: z.string().nullish() })
          .nullish(),
      })
    ),
  });

const include = {
  roles: {
    select: {
      id: true,
      name: true,
      systemId: true,
      externalSystem: { select: { name: true, label: true } },
    },
  },
  invitedBy: { select: { id: true, name: true } },
};

const statusOf = (invitation: { acceptedAt: Date | null; expiresAt: Date }) => {
  if (invitation.acceptedAt) return 'accepted' as const;
  return invitation.expiresAt > new Date()
    ? ('pending' as const)
    : ('expired' as const);
};

const toInvitation = <T extends { acceptedAt: Date | null; expiresAt: Date }>(
  invitation: T
) => ({ ...invitation, status: statusOf(invitation) });

const newExpiration = () =>
  dayjs().add(INVITATION_EXPIRATION_IN_DAYS, 'day').toDate();

export default {
  getAll: protectedProcedure({ permission: { user: ['list'] } })
    .route({ method: 'GET', path: '/invitations', tags })
    .input(
      z.object({ status: z.enum(INVITATION_STATUSES).optional() }).prefault({})
    )
    .output(z.array(zInvitation()))
    .handler(async ({ context, input }) => {
      const invitations = await context.db.invitation.findMany({
        include,
        orderBy: { createdAt: 'desc' },
        take: 200,
      });
      return invitations
        .map(toInvitation)
        .filter((i) => !input.status || i.status === input.status);
    }),

  // Invites an email that has no account yet. It gets the roles when the
  // person signs in for the first time (with the email code).
  create: protectedProcedure({ permission: { user: ['create'] } })
    .route({ method: 'POST', path: '/invitations', tags })
    .input(
      z.object({
        email: z.email(),
        roleIds: z.array(z.string()).prefault([]),
      })
    )
    .output(zInvitation())
    .handler(async ({ context, input }) => {
      const email = normalizeEmail(input.email);

      if (await context.db.user.findUnique({ where: { email } })) {
        throw new ORPCError('CONFLICT', {
          message: 'A user with this email already exists',
          data: { reason: 'userExists' },
        });
      }

      const pending = await context.db.invitation.findFirst({
        where: { email, acceptedAt: null, expiresAt: { gt: new Date() } },
      });
      if (pending) {
        throw new ORPCError('CONFLICT', {
          message: 'This email already has a pending invitation',
          data: { reason: 'pendingInvitation' },
        });
      }

      await assertCanGiveRoles(context.db, context.user.id, input.roleIds);

      const invitation = await context.db.invitation.create({
        data: {
          email,
          expiresAt: newExpiration(),
          invitedById: context.user.id,
          roles: { connect: input.roleIds.map((id) => ({ id })) },
        },
        include,
      });

      await sendInvitationEmail({
        email,
        expiresAt: invitation.expiresAt,
        invitedByName: context.user.name,
      });
      context.logger.info({ invitationId: invitation.id }, 'User invited');

      return toInvitation(invitation);
    }),

  // Sends the email again with a new expiration (also for expired ones)
  resend: protectedProcedure({ permission: { user: ['create'] } })
    .route({ method: 'POST', path: '/invitations/{id}/resend', tags })
    .input(z.object({ id: z.string() }))
    .output(zInvitation())
    .handler(async ({ context, input }) => {
      const current = await context.db.invitation.findUnique({
        where: { id: input.id },
      });
      if (!current) throw new ORPCError('NOT_FOUND');
      if (current.acceptedAt) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'The invitation was already accepted',
        });
      }

      const invitation = await context.db.invitation.update({
        where: { id: input.id },
        data: { expiresAt: newExpiration() },
        include,
      });
      await sendInvitationEmail({
        email: invitation.email,
        expiresAt: invitation.expiresAt,
        invitedByName: context.user.name,
      });

      return toInvitation(invitation);
    }),

  // Revokes it: the email can no longer use it to join
  deleteById: protectedProcedure({ permission: { user: ['create'] } })
    .route({ method: 'DELETE', path: '/invitations/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      const invitation = await context.db.invitation.findUnique({
        where: { id: input.id },
      });
      if (!invitation) throw new ORPCError('NOT_FOUND');
      if (invitation.acceptedAt) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'The invitation was already accepted',
        });
      }
      await context.db.invitation.delete({ where: { id: input.id } });
    }),
};

// Same rule as assigning roles to a user: identity-center roles require
// holding all their permissions (external-system roles are not restricted)
async function assertCanGiveRoles(
  prisma: Db,
  requesterId: string,
  roleIds: string[]
) {
  if (!roleIds.length) return;

  const roles = await prisma.role.findMany({
    where: { id: { in: roleIds } },
    include: { permissions: { include: { permission: true } } },
  });
  if (roles.length !== new Set(roleIds).size) {
    throw new ORPCError('BAD_REQUEST', { message: 'Unknown role' });
  }

  await assertRequesterHolds(
    prisma,
    requesterId,
    roles
      .filter((role) => !role.systemId)
      .flatMap((role) =>
        role.permissions.map(({ permission }) => ({
          subject: permission.subject,
          action: permission.action,
        }))
      )
  );
}
