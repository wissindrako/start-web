import { getUiState } from '@bearstudio/ui-state';
import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircleIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

import { authClient } from '@/features/auth/client';
import { FormUser } from '@/features/user/manager/form-user';
import { zFormFieldsUser } from '@/features/user/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageUserUpdate = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['user', 'role']);
  const { navigateBack } = useNavigateBack();
  const session = authClient.useSession();
  const queryClient = useQueryClient();

  const userQuery = useQuery(
    orpc.user.getById.queryOptions({ input: { id: props.params.id } })
  );

  // All available roles
  const allRolesQuery = useQuery(orpc.role.getAll.queryOptions({ input: {} }));

  // Current user role assignments
  const userRolesQuery = useQuery(
    orpc.user.getUserRoles.queryOptions({ input: { id: props.params.id } })
  );

  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);

  // Sync selectedRoleIds when data loads
  useEffect(() => {
    if (userRolesQuery.data) {
      setSelectedRoleIds(userRolesQuery.data.map((r) => r.id));
    }
  }, [userRolesQuery.data]);

  const userUpdate = useMutation(
    orpc.user.updateById.mutationOptions({
      onSuccess: async (data) => {
        if (data.id === session.data?.user.id) {
          session.refetch();
        }
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: orpc.user.getById.key({ input: { id: props.params.id } }),
          }),
          queryClient.invalidateQueries({
            queryKey: orpc.user.getAll.key(),
            type: 'all',
          }),
        ]);
        navigateBack({ ignoreBlocker: true });
      },
      onError: (error) => {
        if (
          error instanceof ORPCError &&
          error.code === 'CONFLICT' &&
          error.data?.target?.includes('email')
        ) {
          form.setError('email', {
            message: t('user:manager.form.emailAlreadyExist'),
          });
          return;
        }
        toast.error(t('user:manager.update.updateError'));
      },
    })
  );

  const updateUserRoles = useMutation(
    orpc.user.updateUserRoles.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getUserRoles.key({
            input: { id: props.params.id },
          }),
        });
        toast.success(t('user:manager.update.rolesUpdated'));
      },
      onError: () => {
        toast.error(t('user:manager.update.rolesUpdateError'));
      },
    })
  );

  const form = useForm({
    resolver: zodResolver(zFormFieldsUser()),
    values: {
      name: userQuery.data?.name ?? '',
      email: userQuery.data?.email ?? '',
    },
  });

  const ui = getUiState((set) => {
    if (userQuery.status === 'pending') return set('pending');
    if (
      userQuery.status === 'error' &&
      userQuery.error instanceof ORPCError &&
      userQuery.error.code === 'NOT_FOUND'
    )
      return set('not-found');
    if (userQuery.status === 'error') return set('error');
    return set('default', { user: userQuery.data });
  });

  const toggleRole = (roleId: string) => {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId)
        ? prev.filter((id) => id !== roleId)
        : [...prev, roleId]
    );
  };

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
      <Form
        {...form}
        onSubmit={(values) => {
          userUpdate.mutate({ id: props.params.id, ...values });
        }}
      >
        <PageLayout>
          <PageLayoutTopBar
            startActions={<BackButton />}
            endActions={
              <Button
                size="sm"
                type="submit"
                className="min-w-20"
                loading={userUpdate.isPending}
              >
                {t('user:manager.update.updateButton.label')}
              </Button>
            }
          >
            <PageLayoutTopBarTitle>
              {ui
                .match('pending', () => <Skeleton className="h-4 w-48" />)
                .match(['not-found', 'error'], () => (
                  <AlertCircleIcon className="size-4 text-muted-foreground" />
                ))
                .match('default', ({ user }) => <>{user.name || user.email}</>)
                .exhaustive()}
            </PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent containerClassName="flex flex-col gap-6 py-4">
            <Card>
              <CardContent>
                <FormUser />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>{t('user:manager.update.rolesTitle')}</CardTitle>
              </CardHeader>
              <CardContent>
                {allRolesQuery.isPending || userRolesQuery.isPending ? (
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-6 w-40" />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {allRolesQuery.data?.items.map((role) => (
                      <label
                        key={role.id}
                        className="flex cursor-pointer items-center gap-2"
                      >
                        <Checkbox
                          checked={selectedRoleIds.includes(role.id)}
                          onCheckedChange={() => toggleRole(role.id)}
                        />
                        <span className="text-sm font-medium">{role.name}</span>
                        {role.description && (
                          <span className="text-sm text-muted-foreground">
                            — {role.description}
                          </span>
                        )}
                      </label>
                    ))}
                  </div>
                )}
                <div className="mt-4">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    loading={updateUserRoles.isPending}
                    onClick={() =>
                      updateUserRoles.mutate({
                        id: props.params.id,
                        roleIds: selectedRoleIds,
                      })
                    }
                  >
                    {t('user:manager.update.saveRolesButton')}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
