import { ReactNode } from 'react';

import { useMyPermissions } from '@/hooks/use-my-permissions';

import { Permission } from '@/features/auth/permissions';

export const WithPermissions = (props: {
  permissions: Permission[];
  children?: ReactNode;
  loadingFallback?: ReactNode;
  fallback?: ReactNode;
}) => {
  const { isLoading, checkPermission } = useMyPermissions();

  if (isLoading) {
    return props.loadingFallback ?? props.fallback ?? null;
  }

  const hasAny = props.permissions.some((permission) =>
    checkPermission(permission)
  );

  if (!hasAny) {
    return props.fallback ?? null;
  }

  return props.children;
};
