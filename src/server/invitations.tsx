import i18n from '@/lib/i18n';

import { TemplateInvitation } from '@/emails/templates/invitation';
import { envClient } from '@/env/client';
import { db } from '@/server/db';
import { sendEmail } from '@/server/email';
import { getUserLanguage } from '@/server/utils';

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

export async function sendInvitationEmail(invitation: {
  email: string;
  expiresAt: Date;
  invitedByName?: string | null;
}) {
  const language = getUserLanguage();
  const url = new URL('/login', envClient.VITE_BASE_URL);
  url.searchParams.set('email', invitation.email);

  await sendEmail({
    to: invitation.email,
    subject: i18n.t('emails:invitation.subject', { lng: language }),
    template: (
      <TemplateInvitation
        language={language}
        url={url.toString()}
        invitedByName={invitation.invitedByName ?? ''}
        expiresAt={invitation.expiresAt.toISOString()}
      />
    ),
  });
}

export { normalize as normalizeEmail };
