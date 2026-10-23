import { useMutation } from '@tanstack/react-query';
import { CopyIcon, ShieldCheckIcon } from 'lucide-react';
import QRCode from 'qrcode';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import {
  ResponsiveDrawer,
  ResponsiveDrawerContent,
  ResponsiveDrawerDescription,
  ResponsiveDrawerFooter,
  ResponsiveDrawerHeader,
  ResponsiveDrawerTitle,
} from '@/components/ui/responsive-drawer';

import { useTwoFactorRequired } from '@/features/access-settings/use-access-settings';
import { authClient } from '@/features/auth/client';

type Setup = { qrCode: string; secret: string; backupCodes: string[] };

// Two-factor authentication of the signed-in user: an authenticator app
// (TOTP) plus single-use backup codes for when the phone is not at hand
export const TwoFactorCard = () => {
  const { t } = useTranslation(['account']);
  const session = authClient.useSession();
  const isEnabled = !!session.data?.user.twoFactorEnabled;
  const { required } = useTwoFactorRequired();
  const [setup, setSetup] = useState<Setup | null>(null);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);

  const form = useForm<{ code: string }>({ defaultValues: { code: '' } });

  const start = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.twoFactor.enable({
        method: 'totp',
      });
      if (error) throw error;
      if (data.method !== 'totp') throw new Error('Unexpected method');
      const uri = new URL(data.totpURI);
      return {
        qrCode: await QRCode.toDataURL(data.totpURI, { margin: 1, width: 200 }),
        secret: uri.searchParams.get('secret') ?? '',
        backupCodes: data.backupCodes,
      };
    },
    onSuccess: (result) => {
      form.reset({ code: '' });
      setSetup(result);
    },
    onError: () => toast.error(t('account:twoFactor.error')),
  });

  const confirm = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) throw error;
    },
    onSuccess: async () => {
      setBackupCodes(setup?.backupCodes ?? null);
      setSetup(null);
      await session.refetch();
      toast.success(t('account:twoFactor.enabled'));
    },
    onError: () => {
      form.setValue('code', '');
      form.setError('code', { message: t('account:twoFactor.invalidCode') });
    },
  });

  const regenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await authClient.twoFactor.generateBackupCodes(
        {}
      );
      if (error) throw error;
      return data.backupCodes;
    },
    onSuccess: setBackupCodes,
    onError: () => toast.error(t('account:twoFactor.error')),
  });

  const disable = useMutation({
    mutationFn: async () => {
      const { error } = await authClient.twoFactor.disable({});
      if (error) throw error;
    },
    onSuccess: async () => {
      await session.refetch();
      toast.success(t('account:twoFactor.disabled'));
    },
    onError: () => toast.error(t('account:twoFactor.error')),
  });

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('account:twoFactor.copied'));
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="flex-1">
            {t('account:twoFactor.title')}
          </CardTitle>
          <Badge variant={isEnabled ? 'positive' : 'secondary'}>
            {isEnabled
              ? t('account:twoFactor.statusOn')
              : t('account:twoFactor.statusOff')}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">
          {t('account:twoFactor.description')}
        </p>
        <div className="flex flex-wrap gap-2">
          {isEnabled ? (
            <>
              <Button
                size="sm"
                variant="secondary"
                loading={regenerate.isPending}
                onClick={() => regenerate.mutate()}
              >
                {t('account:twoFactor.regenerate')}
              </Button>
              {required ? (
                <p className="w-full text-sm text-muted-foreground">
                  {t('account:twoFactor.required')}
                </p>
              ) : (
                <ConfirmResponsiveDrawer
                  onConfirm={() => disable.mutate()}
                  title={t('account:twoFactor.disableConfirmTitle')}
                  description={t('account:twoFactor.disableConfirmDescription')}
                  confirmText={t('account:twoFactor.disable')}
                  confirmVariant="destructive"
                >
                  <Button size="sm" variant="ghost" loading={disable.isPending}>
                    {t('account:twoFactor.disable')}
                  </Button>
                </ConfirmResponsiveDrawer>
              )}
            </>
          ) : (
            <Button
              size="sm"
              loading={start.isPending}
              onClick={() => start.mutate()}
            >
              <ShieldCheckIcon />
              {t('account:twoFactor.enable')}
            </Button>
          )}
        </div>
      </CardContent>

      {/* Step 1: scan the QR code and confirm with the first code */}
      <ResponsiveDrawer
        open={!!setup}
        onOpenChange={(open) => !open && setSetup(null)}
      >
        <ResponsiveDrawerContent className="sm:max-w-md">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {t('account:twoFactor.setupTitle')}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {t('account:twoFactor.setupDescription')}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>
          {setup && (
            <Form
              {...form}
              onSubmit={({ code }) => confirm.mutate(code)}
              className="flex flex-col gap-4 px-4 pb-2 sm:px-6"
            >
              <img
                src={setup.qrCode}
                alt={t('account:twoFactor.qrAlt')}
                className="mx-auto size-48 rounded-md border bg-white p-1"
              />
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 rounded-md bg-muted px-2 py-1 font-mono text-xs break-all">
                  {setup.secret}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => copy(setup.secret)}
                >
                  <CopyIcon className="size-4" />
                </Button>
              </div>
              <FormField>
                <FormFieldLabel>{t('account:twoFactor.code')}</FormFieldLabel>
                <FormFieldController
                  type="otp"
                  control={form.control}
                  name="code"
                  maxLength={6}
                  autoSubmit
                  autoFocus
                />
              </FormField>
              <ResponsiveDrawerFooter>
                <Button type="submit" loading={confirm.isPending}>
                  {t('account:twoFactor.confirm')}
                </Button>
              </ResponsiveDrawerFooter>
            </Form>
          )}
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>

      {/* Step 2 (and on regenerate): the backup codes, shown once */}
      <ResponsiveDrawer
        open={!!backupCodes}
        onOpenChange={(open) => !open && setBackupCodes(null)}
      >
        <ResponsiveDrawerContent className="sm:max-w-md">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {t('account:twoFactor.backupTitle')}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {t('account:twoFactor.backupDescription')}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>
          <div className="flex flex-col gap-3 px-4 pb-2 sm:px-6">
            <ul
              className="grid grid-cols-2 gap-2 font-mono text-sm"
              data-testid="backup-codes"
            >
              {backupCodes?.map((code) => (
                <li key={code} className="rounded-md bg-muted px-2 py-1">
                  {code}
                </li>
              ))}
            </ul>
          </div>
          <ResponsiveDrawerFooter>
            <Button
              variant="secondary"
              onClick={() => copy((backupCodes ?? []).join('\n'))}
            >
              <CopyIcon />
              {t('account:twoFactor.copyAll')}
            </Button>
            <Button onClick={() => setBackupCodes(null)}>
              {t('account:twoFactor.done')}
            </Button>
          </ResponsiveDrawerFooter>
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>
    </Card>
  );
};
