import i18n from '@/lib/i18n';

import { TemplateInvitation } from '@/emails/templates/invitation';
import { envClient } from '@/env/client';
import { db } from '@/server/db';
import { sendEmail } from '@/server/email';
import { getUserLanguage, parseUriList } from '@/server/utils';

type Db = typeof db;

const normalize = (email: string) => email.trim().toLowerCase();

// Invitation that can still be used: not accepted and not expired
export async function findPendingInvitation(prisma: Db, email: string) {
  return prisma.invitation.findFirst({
    where: {
      email: normalize(email),
      acceptedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { roles: true },
    orderBy: { createdAt: 'desc' },
  });
}

// The invited user just created their account: give them the invitation's
// roles and mark it as used
export async function acceptInvitation(
  prisma: Db,
  user: { id: string; email: string }
) {
  const invitation = await findPendingInvitation(prisma, user.email);
  if (!invitation) return;

  await prisma.$transaction([
    ...invitation.roles.map((role) =>
      prisma.userRoleAssignment.upsert({
        where: { userId_roleId: { userId: user.id, roleId: role.id } },
        create: { userId: user.id, roleId: role.id },
        update: {},
      })
    ),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date() },
    }),
  ]);
}

// Where the invited person goes: the system's app (the origin of its first
// web redirect URI, which starts the sign-in here) or this center's login
async function invitationTarget(
  prisma: Db,
  email: string,
  systemId: string | null
) {
  const system = systemId
    ? await prisma.externalSystem.findUnique({
        where: { id: systemId },
        include: { oauthClient: { select: { redirectUris: true } } },
      })
    : null;

  const appUrl = parseUriList(system?.oauthClient?.redirectUris).find((uri) =>
    /^https?:\/\//.test(uri)
  );
  if (system && appUrl) {
    return {
      systemName: system.label ?? system.name,
      url: new URL(appUrl).origin,
    };
  }

  const url = new URL('/login', envClient.VITE_BASE_URL);
  url.searchParams.set('email', email);
  return {
    systemName: system ? (system.label ?? system.name) : null,
    url: url.toString(),
  };
}

export class InvitationEmailError extends Error {}

export async function sendInvitationEmail(
  prisma: Db,
  invitation: {
    email: string;
    expiresAt: Date;
    systemId: string | null;
    invitedByName?: string | null;
  }
) {
  const language = getUserLanguage();
  const { systemName, url } = await invitationTarget(
    prisma,
    invitation.email,
    invitation.systemId
  );

  try {
    await sendEmail({
      to: invitation.email,
      subject: systemName
        ? i18n.t('emails:invitation.subjectSystem', {
            lng: language,
            system: systemName,
          })
        : i18n.t('emails:invitation.subject', { lng: language }),
      template: (
        <TemplateInvitation
          language={language}
          url={url}
          systemName={systemName ?? ''}
          invitedByName={invitation.invitedByName ?? ''}
          expiresAt={invitation.expiresAt.toISOString()}
        />
      ),
    });
  } catch (error) {
    throw new InvitationEmailError('The invitation email could not be sent', {
      cause: error,
    });
  }
}

export { normalize as normalizeEmail };
