import { useRouter } from '@tanstack/react-router';
import { ReactNode } from 'react';

import { PageError } from '@/components/errors/page-error';
import { Spinner } from '@/components/ui/spinner';

import { authClient } from '@/features/auth/client';
import { PageOnboarding } from '@/features/auth/page-onboarding';
import { Permission } from '@/features/auth/permissions';
import { useMyPermissions } from '@/hooks/use-my-permissions';

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

  // Check if onboarding is done
  if (!session.data.user.onboardedAt) {
    return <PageOnboarding />;
  }

  // Check apps permission against dynamic role
  if (permissionApps && !checkPermission({ apps: permissionApps })) {
    return <PageError type="403" />;
  }

  return <>{children}</>;
};
