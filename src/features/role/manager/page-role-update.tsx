import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { FormRole } from '@/features/role/manager/form-role';
import { zFormFieldsRole } from '@/features/role/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageRoleUpdate = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['role']);
  const { navigateBack } = useNavigateBack();
  const queryClient = useQueryClient();
  const roleQuery = useQuery(
    orpc.role.getById.queryOptions({ input: { id: props.params.id } })
  );
  const form = useForm({
    resolver: zodResolver(zFormFieldsRole()),
    values: {
      name: roleQuery.data?.name ?? '',
      description: roleQuery.data?.description ?? '',
      scope: roleQuery.data?.scope ?? 'local',
      systemId: roleQuery.data?.systemId ?? null,
      permissions:
        roleQuery.data?.permissions.map((rp) => ({
          subject: rp.permission.subject,
          action: rp.permission.action,
        })) ?? [],
    },
  });

  const roleUpdate = useMutation(
    orpc.role.updateById.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.role.getAll.key(),
          type: 'all',
        });
        navigateBack({ ignoreBlocker: true });
      },
      onError: (error) => {
        if (error instanceof ORPCError && error.code === 'CONFLICT') {
          form.setError('name', {
            message: t('role:manager.form.nameAlreadyExist'),
          });
          return;
        }
        toast.error(t('role:manager.update.updateError'));
      },
    })
  );

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
      <Form
        {...form}
        onSubmit={async (values) => {
          roleUpdate.mutate({ id: props.params.id, ...values });
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
                loading={roleUpdate.isPending}
              >
                {t('role:manager.update.updateButton.label')}
              </Button>
            }
          >
            <PageLayoutTopBarTitle>
              {t('role:manager.update.title')}
            </PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent>
            <Card>
              <CardContent>
                <FormRole />
              </CardContent>
            </Card>
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
