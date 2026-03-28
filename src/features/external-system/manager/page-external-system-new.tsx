import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

import { FormExternalSystem } from '@/features/external-system/manager/form-external-system';
import { zFormFieldsExternalSystem } from '@/features/external-system/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageExternalSystemNew = () => {
  const { t } = useTranslation(['external-system']);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const form = useForm({
    resolver: zodResolver(zFormFieldsExternalSystem()),
    defaultValues: {
      name: '',
      label: '',
      modules: [],
    },
  });

  const create = useMutation(
    orpc.externalSystem.create.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getAll.key(),
          type: 'all',
        });
      },
      onError: (error) => {
        if (
          error instanceof ORPCError &&
          error.code === 'CONFLICT' &&
          (error.data as { target?: string[] })?.target?.includes('name')
        ) {
          form.setError('name', {
            message: t('external-system:manager.new.nameAlreadyUsed'),
          });
          return;
        }
        toast.error(t('external-system:manager.new.createError'));
      },
    })
  );

  useEffect(() => {
    if (create.isSuccess) {
      navigate({ to: '/manager/external-systems' });
    }
  }, [create.isSuccess, navigate]);

  return (
    <>
      <PreventNavigation
        shouldBlock={form.formState.isDirty && !create.isSuccess}
      />
      <Form
        {...form}
        onSubmit={(values) => {
          create.mutate(values);
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
                loading={create.isPending}
              >
                {t('external-system:manager.new.createButton.label')}
              </Button>
            }
          >
            <PageLayoutTopBarTitle>
              {t('external-system:manager.new.title')}
            </PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent>
            <Card>
              <CardContent>
                <FormExternalSystem />
              </CardContent>
            </Card>
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
