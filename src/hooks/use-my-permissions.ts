import { useQuery } from '@tanstack/react-query';

import { orpc } from '@/lib/orpc/client';

import { authClient } from '@/features/auth/client';
import { Permission } from '@/features/auth/permissions';

export const useMyPermissions = () => {
  const session = authClient.useSession();

  const query = useQuery({
    ...orpc.role.getMyPermissions.queryOptions(),
    enabled: !!session.data?.user,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const hasPermission = (subject: string, action: string): boolean => {
    return (
      query.data?.some((p) => p.subject === subject && p.action === action) ??
      false
    );
  };

  // Checks a Permission object: all subjects required, any action per subject
  const checkPermission = (permission: Permission): boolean => {
    return Object.entries(permission).every(([subject, actions]) =>
      (actions as string[]).some((action) => hasPermission(subject, action))
    );
  };

  return {
    isLoading: query.isPending && !!session.data?.user,
    hasPermission,
    checkPermission,
  };
};
