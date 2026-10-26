import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import { useForm, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { orpc } from '@/lib/orpc/client';
import { useMyPermissions } from '@/hooks/use-my-permissions';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldHelper,
  FormFieldLabel,
} from '@/components/form';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  isValidDomain,
  parseDomainList,
} from '@/features/access-settings/domains';
import {
  AccessSettings,
  INVITATION_DAYS,
  LOGIN_CODE_MINUTES,
  TWO_FACTOR_POLICIES,
} from '@/features/access-settings/schema';
import { useAccessSettings } from '@/features/access-settings/use-access-settings';
import { authClient } from '@/features/auth/client';

const SIGNUP_MODES = ['invitation', 'open'] as const;

const zFormFieldsAccess = () =>
  z.object({
    signup: z.enum(SIGNUP_MODES),
    allowedDomains: z
      .string()
      .refine((value) => parseDomainList(value).every(isValidDomain), {
        message: t('system-config:manager.access.invalidDomains'),
      }),
    loginCodeMinutes: z
      .number(t('system-config:manager.access.required'))
      .int()
      .min(LOGIN_CODE_MINUTES.min)
      .max(LOGIN_CODE_MINUTES.max),
    invitationDays: z
      .number(t('system-config:manager.access.required'))
      .int()
      .min(INVITATION_DAYS.min)
      .max(INVITATION_DAYS.max),
    twoFactorRequired: z.enum(TWO_FACTOR_POLICIES),
  });

type FormFieldsAccess = z.infer<ReturnType<typeof zFormFieldsAccess>>;

const toFormValues = (settings: AccessSettings): FormFieldsAccess => ({
  signup: settings.signupEnabled ? 'open' : 'invitation',
  allowedDomains: settings.allowedDomains.join('\n'),
  loginCodeMinutes: settings.loginCodeMinutes,
  invitationDays: settings.invitationDays,
  twoFactorRequired: settings.twoFactorRequired,
});

export const AccessSettingsCard = () => {
  const { data, isPending } = useAccessSettings();

  if (isPending) return <Skeleton className="h-96 w-full" />;
  if (!data) return null;

  // Mounted with the settings, so the form starts with their values
  return <AccessSettingsForm settings={data} />;
};

const AccessSettingsForm = ({ settings }: { settings: AccessSettings }) => {
  const { t } = useTranslation(['system-config']);
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const { checkPermission } = useMyPermissions();

  const form = useForm<FormFieldsAccess>({
    resolver: zodResolver(zFormFieldsAccess()),
    values: toFormValues(settings),
  });
  const twoFactorRequired = useWatch({
    control: form.control,
    name: 'twoFactorRequired',
  });

  // Saving would ask the admin for it right away
  const appliesToMe =
    !session.data?.user.twoFactorEnabled &&
    (twoFactorRequired === 'everyone' ||
      (twoFactorRequired === 'managers' &&
        checkPermission({ apps: ['manager'] })));

  const update = useMutation(
    orpc.accessSettings.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.accessSettings.get.key(),
          type: 'all',
        });
        toast.success(t('system-config:manager.access.saveSuccess'));
      },
      onError: () => toast.error(t('system-config:manager.access.saveError')),
    })
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('system-config:manager.access.title')}</CardTitle>
        <CardDescription>
          {t('system-config:manager.access.description')}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form
          {...form}
          className="flex flex-col gap-6"
          onSubmit={(values) =>
            update.mutate({
              signupEnabled: values.signup === 'open',
              allowedDomains: parseDomainList(values.allowedDomains),
              loginCodeMinutes: values.loginCodeMinutes,
              invitationDays: values.invitationDays,
              twoFactorRequired: values.twoFactorRequired,
            })
          }
        >
          <FormField>
            <FormFieldLabel>
              {t('system-config:manager.access.signup')}
            </FormFieldLabel>
            <FormFieldController
              type="select"
              control={form.control}
              name="signup"
              items={SIGNUP_MODES.map((value) => ({
                value,
                label: t(`system-config:manager.access.signupModes.${value}`),
              }))}
            />
          </FormField>

          <FormField>
            <FormFieldLabel>
              {t('system-config:manager.access.allowedDomains')}
            </FormFieldLabel>
            <FormFieldController
              type="textarea"
              control={form.control}
              name="allowedDomains"
              rows={3}
              placeholder={'empresa.com\nsucursal.empresa.com'}
            />
            <FormFieldHelper>
              {t('system-config:manager.access.allowedDomainsHelper')}
            </FormFieldHelper>
          </FormField>

          <div className="grid gap-6 sm:grid-cols-2">
            <FormField>
              <FormFieldLabel>
                {t('system-config:manager.access.loginCodeMinutes')}
              </FormFieldLabel>
              <FormFieldController
                type="number"
                control={form.control}
                name="loginCodeMinutes"
                min={LOGIN_CODE_MINUTES.min}
                max={LOGIN_CODE_MINUTES.max}
              />
              <FormFieldHelper>
                {t('system-config:manager.access.range', LOGIN_CODE_MINUTES)}
              </FormFieldHelper>
            </FormField>
            <FormField>
              <FormFieldLabel>
                {t('system-config:manager.access.invitationDays')}
              </FormFieldLabel>
              <FormFieldController
                type="number"
                control={form.control}
                name="invitationDays"
                min={INVITATION_DAYS.min}
                max={INVITATION_DAYS.max}
              />
              <FormFieldHelper>
                {t('system-config:manager.access.range', INVITATION_DAYS)}
              </FormFieldHelper>
            </FormField>
          </div>

          <FormField>
            <FormFieldLabel>
              {t('system-config:manager.access.twoFactorRequired')}
            </FormFieldLabel>
            <FormFieldController
              type="select"
              control={form.control}
              name="twoFactorRequired"
              items={TWO_FACTOR_POLICIES.map((value) => ({
                value,
                label: t(
                  `system-config:manager.access.twoFactorPolicies.${value}`
                ),
              }))}
            />
            <FormFieldHelper>
              {appliesToMe
                ? t('system-config:manager.access.twoFactorAppliesToMe')
                : t('system-config:manager.access.twoFactorHelper')}
            </FormFieldHelper>
          </FormField>

          <div>
            <Button type="submit" size="sm" loading={update.isPending}>
              {t('system-config:manager.access.save')}
            </Button>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
};
