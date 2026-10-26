import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRoundIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

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
import { Spinner } from '@/components/ui/spinner';

import { CopyableValue } from '@/features/external-system/manager/external-system-oauth-card';

// Credentials the system's backend uses to call the external API
// (OAuth client_credentials), shown with what it needs to request a token
export const ExternalSystemServiceClientCard = (props: {
  systemId: string;
}) => {
  const { t } = useTranslation(['external-system']);
  const queryClient = useQueryClient();
  const [clientSecret, setClientSecret] = useState<string | null>(null);

  const query = useQuery(
    orpc.externalSystem.getServiceClient.queryOptions({
      input: { id: props.systemId },
    })
  );
  const data = query.data;

  const issue = useMutation(
    orpc.externalSystem.createServiceClient.mutationOptions({
      onSuccess: async (result) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.externalSystem.getServiceClient.key({
            input: { id: props.systemId },
          }),
        });
        setClientSecret(result.clientSecret);
        toast.success(t('external-system:manager.service.issued'));
      },
      onError: () => toast.error(t('external-system:manager.service.error')),
    })
  );

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('external-system:manager.oauth.copied'));
  };

  const issueButton = (
    <Button
      type="button"
      size="sm"
      variant={data?.clientId ? 'secondary' : 'default'}
      loading={issue.isPending}
      onClick={
        data?.clientId ? undefined : () => issue.mutate({ id: props.systemId })
      }
    >
      {data?.clientId
        ? t('external-system:manager.service.rotate')
        : t('external-system:manager.service.create')}
    </Button>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1 text-sm font-medium">
            {t('external-system:manager.service.title')}
          </CardTitle>
          {data && (
            <Badge variant={data.clientId ? 'positive' : 'warning'}>
              {data.clientId
                ? t('external-system:manager.oauth.configured')
                : t('external-system:manager.oauth.notConfigured')}
            </Badge>
          )}
        </div>
        <CardDescription>
          {t('external-system:manager.service.description')}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {query.isPending && <Spinner />}

        {data && (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            {data.clientId && (
              <CopyableValue
                label={t('external-system:manager.oauth.clientId')}
                value={data.clientId}
                onCopy={copy}
              />
            )}
            <CopyableValue
              label={t('external-system:manager.service.tokenEndpoint')}
              value={data.tokenEndpoint}
              onCopy={copy}
            />
            <CopyableValue
              label={t('external-system:manager.service.audience')}
              value={data.audience}
              onCopy={copy}
            />
            <CopyableValue
              label={t('external-system:manager.service.scopes')}
              value={data.scopes.join(' ')}
              onCopy={copy}
            />
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

        <div>
          {data?.clientId ? (
            <ConfirmResponsiveDrawer
              onConfirm={() => issue.mutate({ id: props.systemId })}
              title={t('external-system:manager.service.rotateConfirmTitle')}
              description={t(
                'external-system:manager.service.rotateConfirmDescription'
              )}
              confirmText={t('external-system:manager.service.rotate')}
              confirmVariant="destructive"
            >
              {issueButton}
            </ConfirmResponsiveDrawer>
          ) : (
            issueButton
          )}
        </div>
      </CardContent>
    </Card>
  );
};
