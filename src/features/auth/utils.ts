import { useRouter, useSearch } from '@tanstack/react-router';
import { useEffect } from 'react';

import { useMyPermissions } from '@/hooks/use-my-permissions';

import { authClient } from '@/features/auth/client';

export const useRedirectAfterLogin = () => {
  const search = useSearch({ strict: false });
  const router = useRouter();
  const session = authClient.useSession();
  const { isLoading, checkPermission } = useMyPermissions();
  const searchRedirect = search.redirect;

  useEffect(() => {
    const exec = () => {
      if (session.isPending || !session.data || isLoading) {
        return;
      }

      if (searchRedirect) {
        const redirectUrl = new URL(searchRedirect);
        router.navigate({
          replace: true,
          to: redirectUrl.pathname,
          search: Object.fromEntries(redirectUrl.searchParams),
        });
        return;
      }

      if (checkPermission({ apps: ['manager'] })) {
        router.navigate({ replace: true, to: '/manager' });
        return;
      }

      if (checkPermission({ apps: ['app'] })) {
        router.navigate({ replace: true, to: '/app' });
        return;
      }

      router.navigate({ replace: true, to: '/' });
    };

    exec();
  }, [
    searchRedirect,
    session.isPending,
    session.data,
    isLoading,
    checkPermission,
    router,
  ]);
};
