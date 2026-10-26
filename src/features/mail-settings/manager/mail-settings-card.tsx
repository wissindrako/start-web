import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { SendIcon } from 'lucide-react';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { orpc } from '@/lib/orpc/client';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldHelper,
  FormFieldLabel,
} from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

import { authClient } from '@/features/auth/client';
import {
  MAIL_ENCRYPTIONS,
  MAILERS,
  MailSettings,
} from '@/features/mail-settings/schema';

const zFormFieldsMail = () =>
  z
    .object({
      mailer: z.enum(MAILERS),
      host: z.string().trim(),
      port: z.number().int().min(1).max(65535).nullable(),
      encryption: z.enum(MAIL_ENCRYPTIONS),
      username: z.string().trim(),
      password: z.string(),
      fromAddress: z.email(t('system-config:manager.mail.invalidEmail')),
      fromName: z.string().trim(),
    })
    .refine((values) => values.mailer !== 'smtp' || !!values.host, {
      path: ['host'],
      message: t('system-config:manager.mail.required'),
    })
    .refine((values) => values.mailer !== 'smtp' || !!values.port, {
      path: ['port'],
      message: t('system-config:manager.mail.required'),
    });

type FormFieldsMail = z.infer<ReturnType<typeof zFormFieldsMail>>;

const toFormValues = (settings: MailSettings): FormFieldsMail => ({
  mailer: settings.mailer,
  host: settings.host ?? '',
  port: settings.port,
  encryption: settings.encryption,
  username: settings.username ?? '',
  password: '',
  fromAddress: settings.fromAddress ?? '',
  fromName: settings.fromName ?? '',
});

const SOURCE_BADGE = {
  database: 'positive',
  env: 'secondary',
  none: 'warning',
} as const;

const failureDetail = (error: unknown) =>
  error instanceof ORPCError
    ? ((error.data as { detail?: string } | undefined)?.detail ?? error.message)
    : String(error);

export const MailSettingsCard = () => {
  const settingsQuery = useQuery(orpc.mailSettings.get.queryOptions());

  if (settingsQuery.isPending) return <Skeleton className="h-96 w-full" />;
  if (!settingsQuery.data) return null;

  // Mounted with the settings, so the form starts with their values
  return <MailSettingsForm settings={settingsQuery.data} />;
};

const MailSettingsForm = ({ settings }: { settings: MailSettings }) => {
  const { t } = useTranslation(['system-config']);
  const queryClient = useQueryClient();

  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: orpc.mailSettings.get.key(),
      type: 'all',
    });

  const form = useForm<FormFieldsMail>({
    resolver: zodResolver(zFormFieldsMail()),
    values: toFormValues(settings),
  });
  const mailer = useWatch({ control: form.control, name: 'mailer' });

  const update = useMutation(
    orpc.mailSettings.update.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('system-config:manager.mail.saveSuccess'));
      },
      onError: () => toast.error(t('system-config:manager.mail.saveError')),
    })
  );

  const reset = useMutation(
    orpc.mailSettings.reset.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success(t('system-config:manager.mail.resetSuccess'));
      },
      onError: () => toast.error(t('system-config:manager.mail.saveError')),
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('system-config:manager.mail.title')}</CardTitle>
        <CardDescription>
          {t('system-config:manager.mail.description')}
        </CardDescription>
        <div className="flex pt-1">
          <Badge variant={SOURCE_BADGE[settings.source]}>
            {t(`system-config:manager.mail.source.${settings.source}`)}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <Form
          {...form}
          className="flex flex-col gap-6"
          onSubmit={(values) => {
            const smtp = values.mailer === 'smtp';
            update.mutate({
              mailer: values.mailer,
              host: smtp ? values.host : null,
              port: smtp ? values.port : null,
              encryption: values.encryption,
              username: smtp ? values.username || null : null,
              password: values.password || null,
              fromAddress: values.fromAddress,
              fromName: values.fromName || null,
            });
          }}
        >
          <FormField>
            <FormFieldLabel>
              {t('system-config:manager.mail.mailer')}
            </FormFieldLabel>
            <FormFieldController
              type="select"
              control={form.control}
              name="mailer"
              items={MAILERS.map((value) => ({
                value,
                label: t(`system-config:manager.mail.mailers.${value}`),
              }))}
            />
          </FormField>

          {mailer === 'smtp' && (
            <>
              <div className="grid gap-6 sm:grid-cols-[1fr_8rem]">
                <FormField>
                  <FormFieldLabel>
                    {t('system-config:manager.mail.host')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="text"
                    control={form.control}
                    name="host"
                    placeholder="smtp.gmail.com"
                  />
                </FormField>
                <FormField>
                  <FormFieldLabel>
                    {t('system-config:manager.mail.port')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="number"
                    control={form.control}
                    name="port"
                    placeholder="587"
                  />
                </FormField>
              </div>
              <FormField>
                <FormFieldLabel>
                  {t('system-config:manager.mail.encryption')}
                </FormFieldLabel>
                <FormFieldController
                  type="select"
                  control={form.control}
                  name="encryption"
                  items={MAIL_ENCRYPTIONS.map((value) => ({
                    value,
                    label: t(`system-config:manager.mail.encryptions.${value}`),
                  }))}
                />
              </FormField>
              <div className="grid gap-6 sm:grid-cols-2">
                <FormField>
                  <FormFieldLabel>
                    {t('system-config:manager.mail.username')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="text"
                    control={form.control}
                    name="username"
                    autoComplete="off"
                  />
                </FormField>
                <FormField>
                  <FormFieldLabel>
                    {t('system-config:manager.mail.password')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="password"
                    control={form.control}
                    name="password"
                    autoComplete="new-password"
                    placeholder={
                      settings.source === 'database' && settings.hasPassword
                        ? t('system-config:manager.mail.passwordKeep')
                        : undefined
                    }
                  />
                  <FormFieldHelper>
                    {t('system-config:manager.mail.passwordHelper')}
                  </FormFieldHelper>
                </FormField>
              </div>
            </>
          )}

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField>
              <FormFieldLabel>
                {t('system-config:manager.mail.fromAddress')}
              </FormFieldLabel>
              <FormFieldController
                type="email"
                control={form.control}
                name="fromAddress"
                placeholder="noreply@empresa.com"
              />
            </FormField>
            <FormField>
              <FormFieldLabel>
                {t('system-config:manager.mail.fromName')}
              </FormFieldLabel>
              <FormFieldController
                type="text"
                control={form.control}
                name="fromName"
                placeholder="Núcleo"
              />
            </FormField>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="submit" size="sm" loading={update.isPending}>
              {t('system-config:manager.mail.save')}
            </Button>
            {settings.source === 'database' && (
              <ConfirmResponsiveDrawer
                onConfirm={() => reset.mutate({})}
                title={t('system-config:manager.mail.reset')}
                description={t('system-config:manager.mail.resetConfirm')}
                confirmText={t('system-config:manager.mail.reset')}
              >
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  loading={reset.isPending}
                >
                  {t('system-config:manager.mail.reset')}
                </Button>
              </ConfirmResponsiveDrawer>
            )}
          </div>
        </Form>

        <Separator />

        <MailTestForm disabled={settings.source === 'none'} />
      </CardContent>
    </Card>
  );
};

const zFormFieldsMailTest = () =>
  z.object({ to: z.email(t('system-config:manager.mail.invalidEmail')) });

const MailTestForm = (props: { disabled: boolean }) => {
  const { t } = useTranslation(['system-config']);
  const session = authClient.useSession();
  const form = useForm<z.infer<ReturnType<typeof zFormFieldsMailTest>>>({
    resolver: zodResolver(zFormFieldsMailTest()),
    values: { to: session.data?.user.email ?? '' },
  });

  const sendTest = useMutation(
    orpc.mailSettings.sendTest.mutationOptions({
      onSuccess: (_, { to }) =>
        toast.success(t('system-config:manager.mail.test.success', { to })),
      onError: (error) =>
        toast.error(
          t('system-config:manager.mail.test.error', {
            detail: failureDetail(error),
          })
        ),
    })
  );

  return (
    <Form
      {...form}
      className="flex flex-col gap-4"
      onSubmit={(values) => sendTest.mutate(values)}
    >
      <div>
        <p className="text-sm font-medium">
          {t('system-config:manager.mail.test.title')}
        </p>
        <p className="text-sm text-muted-foreground">
          {t('system-config:manager.mail.test.description')}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <FormField className="flex-1">
          <FormFieldLabel className="sr-only">
            {t('system-config:manager.mail.test.to')}
          </FormFieldLabel>
          <FormFieldController
            type="email"
            control={form.control}
            name="to"
            placeholder="nombre@empresa.com"
          />
        </FormField>
        <Button
          type="submit"
          size="sm"
          variant="secondary"
          className="h-9"
          disabled={props.disabled}
          loading={sendTest.isPending}
        >
          <SendIcon className="mr-1.5 size-3.5" />
          {t('system-config:manager.mail.test.submit')}
        </Button>
      </div>
    </Form>
  );
};
