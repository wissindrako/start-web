import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { useAccessSettings } from '@/features/access-settings/use-access-settings';
import { PasswordFields } from '@/features/account/password-fields';
import { WithPermissions } from '@/features/auth/with-permission';

// For people who cannot get the email code: an administrator sets a
// password, and the person changes it from their account
export const UserPasswordCard = (props: { userId: string }) => {
  const { t } = useTranslation(['account', 'user']);
  const { settings } = useAccessSettings();
  const queryClient = useQueryClient();
  const status = useQuery(
    orpc.user.passwordStatus.queryOptions({ input: { id: props.userId } })
  );

  const save = useMutation(
    orpc.user.setPassword.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.passwordStatus.key(),
        });
        toast.success(t('user:manager.password.saved'));
      },
      onError: () => toast.error(t('account:password.error')),
    })
  );

  if (!settings.passwordLogin || !status.data) return null;
  const has = status.data.hasPassword;

  return (
    <WithPermissions permissions={[{ user: ['update'] }]}>
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
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
            {t('user:manager.password.help')}
          </p>
          <PasswordFields
            requireCurrent={false}
            pending={save.isPending}
            saveLabel={t('user:manager.password.save')}
            onSave={async ({ newPassword }) => {
              try {
                await save.mutateAsync({ id: props.userId, newPassword });
                return true;
              } catch {
                return false;
              }
            }}
          />
        </CardContent>
      </Card>
    </WithPermissions>
  );
};
