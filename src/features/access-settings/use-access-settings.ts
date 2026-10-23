import { useQuery } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc/client';
import { useMyPermissions } from '@/hooks/use-my-permissions';

import { ACCESS_DEFAULTS } from '@/features/access-settings/schema';

// Access settings as the login pages and the manager need them; the
// defaults stand in while they load
export const useAccessSettings = () => {
  const query = useQuery({
    ...orpc.accessSettings.get.queryOptions(),
    staleTime: 30_000,
  });
  return {
    data: query.data,
    isPending: query.isPending,
    settings: query.data ?? ACCESS_DEFAULTS,
  };
};

// Whether the access settings ask the signed-in user for two-factor
// authentication (the server checks it too)
export const useTwoFactorRequired = () => {
  const { settings, isPending } = useAccessSettings();
  const { isLoading, checkPermission } = useMyPermissions();
  const policy = settings.twoFactorRequired;
  return {
    isLoading: isPending || isLoading,
    required:
      policy === 'everyone' ||
      (policy === 'managers' && checkPermission({ apps: ['manager'] })),
  };
};
