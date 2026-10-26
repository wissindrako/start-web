import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CopyIcon, KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
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
import { Spinner } from '@/components/ui/spinner';

const CLIENT_TYPES = ['public', 'confidential'] as const;

const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

const zUrlLines = () =>
  z.string().refine((value) => lines(value).every((url) => URL.canParse(url)), {
    error: 'invalidUrl',
  });

const zFormFieldsOAuth = () =>
  z.object({
    resourceIdentifier: z.url(),
    redirectUris: zUrlLines().refine((value) => lines(value).length > 0, {
      error: 'required',
    }),
    postLogoutRedirectUris: zUrlLines(),
    clientType: z.enum(CLIENT_TYPES),
  });

type FormFieldsOAuth = z.infer<ReturnType<typeof zFormFieldsOAuth>>;

export const ExternalSystemOAuthCard = (props: { systemId: string }) => {
  const { t } = useTranslation(['external-system']);
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const configQuery = useQuery(
    orpc.externalSystem.getOAuthConfig.queryOptions({
      input: { id: props.systemId },
    })
  );
  const config = configQuery.data;

  const form = useForm<FormFieldsOAuth>({
    resolver: zodResolver(zFormFieldsOAuth()),
    values: {
      resourceIdentifier: config?.resourceIdentifier ?? '',
      redirectUris: config?.redirectUris.join('\n') ?? '',
      postLogoutRedirectUris: config?.postLogoutRedirectUris.join('\n') ?? '',
      clientType: config?.clientType ?? 'public',
    },
  });

  const configure = useMutation(
    orpc.externalSystem.configureOAuth.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getOAuthConfig.key({
            input: { id: props.systemId },
          }),
        });
        if (result.clientSecret) setClientSecret(result.clientSecret);
        toast.success(t('external-system:manager.oauth.saved'));
      },
      onError: (error) => {
        if (error instanceof ORPCError && error.code === 'CONFLICT') {
          form.setError('resourceIdentifier', {
            message: t('external-system:manager.oauth.resourceInUse'),
          });
          return;
        }
        toast.error(
          error instanceof ORPCError && error.code === 'BAD_REQUEST'
            ? error.message
            : t('external-system:manager.oauth.saveError')
        );
      },
    })
  );

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('external-system:manager.oauth.copied'));
  };

  // This form lives inside the page's system form: it must not submit it
  const submit = form.handleSubmit((values) =>
    configure.mutate({
      id: props.systemId,
      resourceIdentifier: values.resourceIdentifier,
      redirectUris: lines(values.redirectUris),
      postLogoutRedirectUris: lines(values.postLogoutRedirectUris),
      clientType: values.clientType,
    })
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1 text-sm font-medium">
            {t('external-system:manager.oauth.title')}
          </CardTitle>
          {config && (
            <Badge variant={config.configured ? 'positive' : 'warning'}>
              {config.configured
                ? t('external-system:manager.oauth.configured')
                : t('external-system:manager.oauth.notConfigured')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t('external-system:manager.oauth.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {configQuery.isPending && <Spinner />}

        {config && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <CopyableValue
              label={t('external-system:manager.oauth.issuer')}
              value={config.issuer}
              onCopy={copy}
            />
            <CopyableValue
              label={t('external-system:manager.oauth.discoveryUrl')}
              value={config.discoveryUrl}
              onCopy={copy}
            />
            {config.clientId && (
              <CopyableValue
                label={t('external-system:manager.oauth.clientId')}
                value={config.clientId}
                onCopy={copy}
              />
            )}
          </dl>
        )}

        {clientSecret && (
          <div className="flex flex-col gap-2 rounded-md border border-warning-300 bg-warning-50 p-3 dark:border-warning-500/40 dark:bg-warning-500/10">
            <p className="flex items-center gap-2 text-sm font-medium">
              <KeyRoundIcon className="size-4" />
              {t('external-system:manager.oauth.secretTitle')}
            </p>
            <p className="text-xs text-muted-foreground">
              {t('external-system:manager.oauth.secretWarning')}
            </p>
            <CopyableValue value={clientSecret} onCopy={copy} />
          </div>
        )}

        <Form {...form} noHtmlForm>
          <div className="flex flex-col gap-4">
            <FormField>
              <FormFieldLabel>
                {t('external-system:manager.oauth.resourceIdentifier.label')}
              </FormFieldLabel>
              <FormFieldController
                type="text"
                control={form.control}
                name="resourceIdentifier"
                placeholder="https://api.mi-sistema.com/api"
              />
              <FormFieldHelper>
                {t('external-system:manager.oauth.resourceIdentifier.helper')}
              </FormFieldHelper>
            </FormField>
            <FormField>
              <FormFieldLabel>
                {t('external-system:manager.oauth.redirectUris.label')}
              </FormFieldLabel>
              <FormFieldController
                type="textarea"
                control={form.control}
                name="redirectUris"
                rows={2}
                placeholder="https://mi-sistema.com/auth/callback"
              />
              <FormFieldHelper>
                {t('external-system:manager.oauth.redirectUris.helper')}
              </FormFieldHelper>
            </FormField>
            <FormField>
              <FormFieldLabel>
                {t(
                  'external-system:manager.oauth.postLogoutRedirectUris.label'
                )}
              </FormFieldLabel>
              <FormFieldController
                type="textarea"
                control={form.control}
                name="postLogoutRedirectUris"
                rows={2}
                placeholder="https://mi-sistema.com"
              />
            </FormField>
            <FormField>
              <FormFieldLabel>
                {t('external-system:manager.oauth.clientType.label')}
              </FormFieldLabel>
              <FormFieldController
                type="select"
                control={form.control}
                name="clientType"
                disabled={!!config?.clientId}
                items={CLIENT_TYPES.map((type) => ({
                  value: type,
                  label: t(`external-system:manager.oauth.clientType.${type}`),
                }))}
              />
              <FormFieldHelper>
                {config?.clientId
                  ? t('external-system:manager.oauth.clientType.locked')
                  : t('external-system:manager.oauth.clientType.helper')}
              </FormFieldHelper>
            </FormField>
            <div>
              <Button
                type="button"
                size="sm"
                onClick={submit}
                loading={configure.isPending}
              >
                {config?.clientId
                  ? t('external-system:manager.oauth.update')
                  : t('external-system:manager.oauth.create')}
              </Button>
            </div>
          </div>
        </Form>
      </CardContent>
    </Card>
  );
};

export const CopyableValue = (props: {
  label?: string;
  value: string;
  onCopy: (value: string) => void;
}) => (
  <div className="flex min-w-0 flex-col gap-1">
    {props.label && (
      <dt className="text-xs text-muted-foreground">{props.label}</dt>
    )}
    <dd className="flex items-center gap-2">
      <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
        {props.value}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        onClick={() => props.onCopy(props.value)}
      >
        <CopyIcon className="size-4" />
      </Button>
    </dd>
  </div>
);
