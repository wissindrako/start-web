import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRoundIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useAccessSettings } from '@/features/access-settings/use-access-settings';
import { PasswordFields } from '@/features/account/password-fields';

// The own password: only while the access settings allow signing in with one
export const PasswordCard = () => {
  const { t } = useTranslation(['account']);
  const { settings } = useAccessSettings();
  const queryClient = useQueryClient();
  const status = useQuery(
    orpc.account.passwordStatus.queryOptions({ input: {} })
  );

  const save = useMutation(
    orpc.account.setPassword.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.account.passwordStatus.key(),
        });
        toast.success(t('account:password.saved'));
      },
      onError: (error) => {
        const reason = (error as { data?: { reason?: string } }).data?.reason;
        toast.error(
          reason === 'wrongPassword'
            ? t('account:password.wrongCurrent')
            : t('account:password.error')
        );
      },
    })
  );

  if (!settings.passwordLogin || !status.data) return null;
  const has = status.data.hasPassword;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <KeyRoundIcon className="size-4" />
          <CardTitle className="flex-1">
            {t('account:password.title')}
          </CardTitle>
          <Badge variant={has ? 'positive' : 'secondary'}>
            {has ? t('account:password.set') : t('account:password.notSet')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {has
            ? t('account:password.changeHelp')
            : t('account:password.createHelp')}
        </p>
        <PasswordFields
          requireCurrent={has}
          pending={save.isPending}
          saveLabel={
            has ? t('account:password.change') : t('account:password.create')
          }
          onSave={async (values) => {
            try {
              await save.mutateAsync(values);
              return true;
            } catch {
              return false;
            }
          }}
        />
      </CardContent>
    </Card>
  );
};
