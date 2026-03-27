import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
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
        navigate({ to: '/manager/external-systems' });
      },
      onError: () => {
        toast.error(t('external-system:manager.new.createError'));
      },
    })
  );

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
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
