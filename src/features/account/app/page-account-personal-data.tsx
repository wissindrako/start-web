import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { type Resolver, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { FormPersonalData } from '@/features/personal-data/manager/form-personal-data';
import {
  FormFieldsPersonalData,
  PersonalData,
  zFormFieldsPersonalData,
} from '@/features/personal-data/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/app/page-layout';

const toFormValues = (
  data: PersonalData | null | undefined
): FormFieldsPersonalData => ({
  nombre: data?.nombre ?? '',
  primerApellido: data?.primerApellido ?? null,
  segundoApellido: data?.segundoApellido ?? null,
  tipoDocumento: data?.tipoDocumento ?? null,
  numeroDocumento: data?.numeroDocumento ?? '',
  fechaNacimiento: data?.fechaNacimiento ?? null,
  genero: data?.genero ?? '',
  telefono: data?.telefono ?? '',
  telefonoAlternativo: data?.telefonoAlternativo ?? null,
  pais: data?.pais ?? null,
  departamento: data?.departamento ?? null,
  ciudad: data?.ciudad ?? null,
  direccion: data?.direccion ?? '',
  codigoPostal: data?.codigoPostal ?? null,
});

export const PageAccountPersonalData = () => {
  const { t } = useTranslation(['account', 'personal-data']);
  const { navigateBack } = useNavigateBack();
  const queryClient = useQueryClient();

  const personalDataQuery = useQuery(
    orpc.account.getPersonalData.queryOptions({ input: {} })
  );

  const form = useForm<FormFieldsPersonalData>({
    resolver: zodResolver(
      zFormFieldsPersonalData()
    ) as Resolver<FormFieldsPersonalData>,
    values: toFormValues(personalDataQuery.data),
  });

  const upsert = useMutation(
    orpc.account.upsertPersonalData.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.account.getPersonalData.key({ input: {} }),
        });
        toast.success(t('personal-data:manager.update.saveSuccess'));
        navigateBack({ ignoreBlocker: true });
      },
      onError: () => {
        toast.error(t('personal-data:manager.update.saveError'));
      },
    })
  );

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
      <Form
        {...form}
        onSubmit={(values) => {
          upsert.mutate(values);
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
                loading={upsert.isPending}
              >
                {t('personal-data:manager.update.saveButton.label')}
              </Button>
            }
          >
            <PageLayoutTopBarTitle>
              {t('account:personalData.title')}
            </PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent containerClassName="py-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('personal-data:manager.update.cardTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <FormPersonalData />
              </CardContent>
            </Card>
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
