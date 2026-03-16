import { getUiState } from '@bearstudio/ui-state';
import { ORPCError } from '@orpc/client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon, PencilLineIcon, Trash2Icon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { PageError } from '@/components/errors/page-error';
import { ButtonLink } from '@/components/ui/button-link';
import { Card, CardContent } from '@/components/ui/card';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import { ResponsiveIconButton } from '@/components/ui/responsive-icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

import { WithPermissions } from '@/features/auth/with-permission';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageRole = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['role']);
  const queryClient = useQueryClient();
  const { navigateBack } = useNavigateBack();
  const roleQuery = useQuery(
    orpc.role.getById.queryOptions({ input: { id: props.params.id } })
  );

  const ui = getUiState((set) => {
    if (roleQuery.status === 'pending') return set('pending');
    if (
      roleQuery.status === 'error' &&
      roleQuery.error instanceof ORPCError &&
      roleQuery.error.code === 'NOT_FOUND'
    )
      return set('not-found');
    if (roleQuery.status === 'error') return set('error');
    return set('default', { role: roleQuery.data });
  });

  const deleteRole = async () => {
    try {
      await orpc.role.deleteById.call({ id: props.params.id });
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: orpc.role.getAll.key(),
          type: 'all',
        }),
        queryClient.removeQueries({
          queryKey: orpc.role.getById.key({ input: { id: props.params.id } }),
        }),
      ]);
      toast.success(t('role:manager.detail.deleted'));
      navigateBack();
    } catch {
      toast.error(t('role:manager.detail.deleteError'));
    }
  };

  return (
    <PageLayout>
      <PageLayoutTopBar
        startActions={<BackButton />}
        endActions={
          <>
            <WithPermissions permissions={[{ role: ['delete'] }]}>
              <ConfirmResponsiveDrawer
                onConfirm={() => deleteRole()}
                title={t('role:manager.detail.confirmDeleteTitle', {
                  name: roleQuery.data?.name ?? '--',
                })}
                description={t('role:manager.detail.confirmDeleteDescription')}
                confirmText={t('role:manager.detail.deleteButton.label')}
                confirmVariant="destructive"
              >
                <ResponsiveIconButton
                  variant="ghost"
                  label={t('role:manager.detail.deleteButton.label')}
                  size="sm"
                >
                  <Trash2Icon />
                </ResponsiveIconButton>
              </ConfirmResponsiveDrawer>
            </WithPermissions>
            <ButtonLink
              size="sm"
              variant="secondary"
              to="/manager/roles/$id/update"
              params={{ id: props.params.id }}
            >
              <PencilLineIcon />
              {t('role:manager.detail.editButton.label')}
            </ButtonLink>
          </>
        }
      >
        <PageLayoutTopBarTitle>
          {ui
            .match('pending', () => <Skeleton className="h-4 w-48" />)
            .match(['not-found', 'error'], () => (
              <AlertCircleIcon className="size-4 text-muted-foreground" />
            ))
            .match('default', ({ role }) => <>{role.name}</>)
            .exhaustive()}
        </PageLayoutTopBarTitle>
      </PageLayoutTopBar>
      <PageLayoutContent>
        {ui
          .match('pending', () => <Spinner full />)
          .match('not-found', () => <PageError type="404" />)
          .match('error', () => <PageError type="unknown-server-error" />)
          .match('default', ({ role }) => (
            <Card className="py-1">
              <CardContent>
                <dl className="flex flex-col divide-y text-sm">
                  <div className="flex gap-4 py-3">
                    <dt className="w-32 flex-none font-medium text-muted-foreground">
                      {t('role:common.name.label')}
                    </dt>
                    <dd className="flex-1">{role.name}</dd>
                  </div>
                  {role.description && (
                    <div className="flex gap-4 py-3">
                      <dt className="w-32 flex-none font-medium text-muted-foreground">
                        {t('role:common.description.label')}
                      </dt>
                      <dd className="flex-1">{role.description}</dd>
                    </div>
                  )}
                  <div className="flex gap-4 py-3">
                    <dt className="w-32 flex-none font-medium text-muted-foreground">
                      {t('role:common.users.label')}
                    </dt>
                    <dd className="flex-1">{role._count.userAssignments}</dd>
                  </div>
                  <div className="flex gap-4 py-3">
                    <dt className="w-32 flex-none font-medium text-muted-foreground">
                      {t('role:common.permissions.label')}
                    </dt>
                    <dd className="flex-1">
                      {role.permissions.length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {role.permissions.map((rp) => (
                            <span
                              key={rp.permissionId}
                              className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium capitalize"
                            >
                              {rp.permission.subject}:{rp.permission.action}
                            </span>
                          ))}
                        </div>
                      )}
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>
          ))
          .exhaustive()}
      </PageLayoutContent>
    </PageLayout>
  );
};
