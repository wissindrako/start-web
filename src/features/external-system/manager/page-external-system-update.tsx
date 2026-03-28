import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { CopyIcon, RefreshCwIcon, Trash2Icon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import { ResponsiveIconButton } from '@/components/ui/responsive-icon-button';
import { Spinner } from '@/components/ui/spinner';

import { FormExternalSystem } from '@/features/external-system/manager/form-external-system';
import { zFormFieldsExternalSystem } from '@/features/external-system/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageExternalSystemUpdate = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['external-system']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const systemQuery = useQuery(
    orpc.externalSystem.getById.queryOptions({ input: { id: props.params.id } })
  );

  const form = useForm({
    resolver: zodResolver(zFormFieldsExternalSystem()),
    values: {
      name: systemQuery.data?.name ?? '',
      label: systemQuery.data?.label ?? '',
      modules:
        systemQuery.data?.modules.map((m) => ({
          name: m.name,
          actions: [...m.actions],
          order: m.order,
        })) ?? [],
    },
  });

  const update = useMutation(
    orpc.externalSystem.updateById.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getAll.key(),
          type: 'all',
        });
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getById.key({
            input: { id: props.params.id },
          }),
          type: 'all',
        });
        toast.success(t('external-system:manager.update.updateButton.label'));
      },
      onError: (error) => {
        if (
          error instanceof ORPCError &&
          error.code === 'CONFLICT' &&
          (error.data as { target?: string[] })?.target?.includes('name')
        ) {
          form.setError('name', {
            message: t('external-system:manager.update.nameAlreadyUsed'),
          });
          return;
        }
        toast.error(t('external-system:manager.update.updateError'));
      },
    })
  );

  const deleteSystem = useMutation(
    orpc.externalSystem.deleteById.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getAll.key(),
          type: 'all',
        });
        toast.success(t('external-system:manager.detail.deleted'));
        navigate({ to: '/manager/external-systems' });
      },
      onError: (error) => {
        if (error instanceof ORPCError && error.code === 'NOT_FOUND') {
          navigate({ to: '/manager/external-systems' });
          return;
        }
        toast.error(t('external-system:manager.detail.deleteError'));
      },
    })
  );

  const [showApiKey, setShowApiKey] = useState(false);

  const rotateApiKey = useMutation(
    orpc.externalSystem.rotateApiKey.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getById.key({
            input: { id: props.params.id },
          }),
          type: 'all',
        });
        toast.success(t('external-system:manager.apiKey.rotated'));
        setShowApiKey(true);
      },
      onError: () => {
        toast.error(t('external-system:manager.apiKey.rotateError'));
      },
    })
  );

  const copyApiKey = async () => {
    const key = systemQuery.data?.apiKey;
    if (!key) return;
    await navigator.clipboard.writeText(key);
    toast.success(t('external-system:manager.apiKey.copied'));
  };

  if (systemQuery.isPending) {
    return (
      <PageLayout>
        <PageLayoutTopBar startActions={<BackButton />}>
          <PageLayoutTopBarTitle>
            {t('external-system:manager.update.title')}
          </PageLayoutTopBarTitle>
        </PageLayoutTopBar>
        <PageLayoutContent>
          <Spinner full />
        </PageLayoutContent>
      </PageLayout>
    );
  }

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
      <Form
        {...form}
        onSubmit={(values) => {
          update.mutate({ id: props.params.id, ...values });
        }}
      >
        <PageLayout>
          <PageLayoutTopBar
            startActions={<BackButton />}
            endActions={
              <>
                <ConfirmResponsiveDrawer
                  onConfirm={() => deleteSystem.mutate({ id: props.params.id })}
                  title={t(
                    'external-system:manager.detail.confirmDeleteTitle',
                    {
                      name:
                        systemQuery.data?.label ??
                        systemQuery.data?.name ??
                        '--',
                    }
                  )}
                  description={t(
                    'external-system:manager.detail.confirmDeleteDescription'
                  )}
                  confirmText={t(
                    'external-system:manager.detail.deleteButton.label'
                  )}
                  confirmVariant="destructive"
                >
                  <ResponsiveIconButton
                    variant="ghost"
                    label={t(
                      'external-system:manager.detail.deleteButton.label'
                    )}
                    size="sm"
                  >
                    <Trash2Icon />
                  </ResponsiveIconButton>
                </ConfirmResponsiveDrawer>
                <Button
                  size="sm"
                  type="submit"
                  className="min-w-20"
                  loading={update.isPending}
                >
                  {t('external-system:manager.update.updateButton.label')}
                </Button>
              </>
            }
          >
            <PageLayoutTopBarTitle>
              {systemQuery.data?.label ?? systemQuery.data?.name ?? ''}
            </PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent>
            <Card>
              <CardContent>
                <FormExternalSystem />
              </CardContent>
            </Card>

            {systemQuery.data && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">
                    {t('external-system:manager.apiKey.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-xs text-muted-foreground">
                    {t('external-system:manager.apiKey.description')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 rounded-md bg-muted px-3 py-2 font-mono text-sm break-all">
                      {showApiKey
                        ? systemQuery.data.apiKey
                        : '••••••••-••••-••••-••••-••••••••••••'}
                    </code>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowApiKey((v) => !v)}
                    >
                      {showApiKey
                        ? t('external-system:manager.apiKey.hide')
                        : t('external-system:manager.apiKey.show')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="icon-sm"
                      onClick={copyApiKey}
                    >
                      <CopyIcon className="size-4" />
                    </Button>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="flex-1 text-xs text-muted-foreground">
                      {t('external-system:manager.apiKey.rotateHint')}
                    </p>
                    <ConfirmResponsiveDrawer
                      onConfirm={() =>
                        rotateApiKey.mutate({ id: props.params.id })
                      }
                      title={t(
                        'external-system:manager.apiKey.confirmRotateTitle'
                      )}
                      description={t(
                        'external-system:manager.apiKey.confirmRotateDescription'
                      )}
                      confirmText={t('external-system:manager.apiKey.rotate')}
                      confirmVariant="destructive"
                    >
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        loading={rotateApiKey.isPending}
                      >
                        <RefreshCwIcon className="size-4" />
                        {t('external-system:manager.apiKey.rotate')}
                      </Button>
                    </ConfirmResponsiveDrawer>
                  </div>
                </CardContent>
              </Card>
            )}
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
