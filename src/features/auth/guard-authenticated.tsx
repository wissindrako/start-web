import { useRouter } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { ReactNode, useEffect } from 'react';
import { useTranslation } from 'react-i18next';

import { useMyPermissions } from '@/hooks/use-my-permissions';

import { PageError } from '@/components/errors/page-error';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { authClient } from '@/features/auth/client';
import { PageOnboarding } from '@/features/auth/page-onboarding';
import { Permission } from '@/features/auth/permissions';

export const GuardAuthenticated = ({
  children,
  permissionApps,
}: {
  children?: ReactNode;
  permissionApps?: Permission['apps'];
}) => {
  const session = authClient.useSession();
  const { isLoading, checkPermission } = useMyPermissions();
  const router = useRouter();
  const { t } = useTranslation(['auth']);

  // When any ORPC request returns UNAUTHORIZED or FORBIDDEN, refetch the
  // session so this guard can redirect (login) or show the banned screen.
  useEffect(() => {
    const handler = () => session.refetch();
    window.addEventListener('auth:session-invalid', handler);
    return () => window.removeEventListener('auth:session-invalid', handler);
  }, [session]);

  if (session.isPending || isLoading) {
    return <Spinner full className="opacity-60" />;
  }

  if (session.error && session.error.status > 0) {
    return <PageError type="unknown-auth-error" />;
  }

  if (!session.data?.user) {
    router.navigate({
      to: '/login',
      replace: true,
      search: {
        redirect: location.href,
      },
    });
    return null;
  }

  // Check if user is banned
  if (session.data.user.banned) {
    const { banReason, banExpires } = session.data.user;
    return (
      <PageError
        type="403"
        title={t('auth:banned.title')}
        message={
          <>
            <span className="block">
              {banReason
                ? t('auth:banned.messageWithReason', { reason: banReason })
                : t('auth:banned.message')}
            </span>
            {banExpires && (
              <span className="mt-1 block">
                {t('auth:banned.expiresAt', {
                  date: dayjs(banExpires).format('DD/MM/YYYY HH:mm'),
                })}
              </span>
            )}
          </>
        }
        errorCode="banned"
      >
        <Button
          variant="secondary"
          onClick={() =>
            authClient
              .signOut()
              .then(() => router.navigate({ to: '/login', replace: true }))
          }
        >
          {t('auth:banned.signOutButton')}
        </Button>
      </PageError>
    );
  }

  // Check if onboarding is done
  if (!session.data.user.verifiedAt) {
    return <PageOnboarding />;
  }

  // Check apps permission against dynamic role
  if (permissionApps && !checkPermission({ apps: permissionApps })) {
    return <PageError type="403" />;
  }

  return <>{children}</>;
};
