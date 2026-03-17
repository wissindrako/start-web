import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm, type Resolver } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  FormFieldsPersonalData,
  zFormFieldsPersonalData,
} from '@/features/personal-data/schema';
import { FormPersonalData } from '@/features/personal-data/manager/form-personal-data';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

const toFormValues = (
  data: Partial<FormFieldsPersonalData> | null | undefined
): FormFieldsPersonalData => ({
  nombre: data?.nombre ?? null,
  primerApellido: data?.primerApellido ?? null,
  segundoApellido: data?.segundoApellido ?? null,
  tipoDocumento: data?.tipoDocumento ?? null,
  numeroDocumento: data?.numeroDocumento ?? null,
  fechaNacimiento: data?.fechaNacimiento ?? null,
  genero: data?.genero ?? null,
  telefono: data?.telefono ?? null,
  telefonoAlternativo: data?.telefonoAlternativo ?? null,
  pais: data?.pais ?? null,
  departamento: data?.departamento ?? null,
  ciudad: data?.ciudad ?? null,
  direccion: data?.direccion ?? null,
  codigoPostal: data?.codigoPostal ?? null,
});

export const PagePersonalDataUpdate = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['personal-data']);
  const { navigateBack } = useNavigateBack();
  const queryClient = useQueryClient();

  const personalDataQuery = useQuery(
    orpc.personalData.getByUserId.queryOptions({
      input: { userId: props.params.id },
    })
  );

  const form = useForm<FormFieldsPersonalData>({
    resolver: zodResolver(
      zFormFieldsPersonalData()
    ) as Resolver<FormFieldsPersonalData>,
    values: toFormValues(personalDataQuery.data),
  });

  const upsert = useMutation(
    orpc.personalData.upsertByUserId.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.personalData.getByUserId.key({
            input: { userId: props.params.id },
          }),
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
          upsert.mutate({ userId: props.params.id, ...values });
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
              {t('personal-data:manager.update.title')}
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
