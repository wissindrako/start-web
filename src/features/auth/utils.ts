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

      // Signed in, but no role gives access to the manager or the app:
      // without this, '/' sends back to the login and nothing seems to happen
      void authClient.signOut().then(() =>
        router.navigate({
          replace: true,
          to: '/login/error',
          search: { error: 'no_access' },
        })
      );
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
