import { useMutation } from '@tanstack/react-query';
import { CopyIcon, LogOutIcon, ShieldCheckIcon } from 'lucide-react';
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
import { Button } from '@/components/ui/button';

import { authClient } from '@/features/auth/client';
import { ConfirmSignOut } from '@/features/auth/confirm-signout';
import { LayoutLogin } from '@/features/auth/layout-login';

type Setup = { qrCode: string; secret: string; backupCodes: string[] };

// Two-factor authentication required by the access settings and not set up
// yet: the user sets it up here before going on. `onStart` and `onDone`
// let the caller keep this page up until the backup codes are seen.
export const PageTwoFactorSetup = (props: {
  onStart?: () => void;
  onDone: () => Promise<void> | void;
}) => {
  const { t } = useTranslation(['auth', 'account']);
  const session = authClient.useSession();
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
    onMutate: () => props.onStart?.(),
    onSuccess: setSetup,
    onError: () => toast.error(t('account:twoFactor.error')),
  });

  const confirm = useMutation({
    mutationFn: async (code: string) => {
      const { error } = await authClient.twoFactor.verifyTotp({ code });
      if (error) throw error;
    },
    onSuccess: () => {
      setBackupCodes(setup?.backupCodes ?? []);
      setSetup(null);
      toast.success(t('account:twoFactor.enabled'));
    },
    onError: () => {
      form.setValue('code', '');
      form.setError('code', { message: t('account:twoFactor.invalidCode') });
    },
  });

  const done = useMutation({
    mutationFn: async () => props.onDone(),
    onError: () => toast.error(t('account:twoFactor.error')),
  });

  let description = t('auth:twoFactorSetup.description');
  if (setup) description = t('account:twoFactor.setupDescription');
  if (backupCodes) description = t('account:twoFactor.backupDescription');

  const copy = async (value: string) => {
    await navigator.clipboard.writeText(value);
    toast.success(t('account:twoFactor.copied'));
  };

  return (
    <LayoutLogin
      footer={
        <div className="flex flex-col items-center justify-center text-center">
          <p className="pt-8 text-xs text-balance break-words text-muted-foreground">
            {t('auth:pageOnboarding.loggedWith', {
              email: session.data?.user.email,
            })}
          </p>
          <ConfirmSignOut>
            <Button size="xs" variant="link" className="opacity-80">
              <LogOutIcon />
              {t('auth:signOut.action')}
            </Button>
          </ConfirmSignOut>
        </div>
      }
    >
      <div className="flex flex-col gap-4 pb-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-lg font-bold text-balance">
            {backupCodes
              ? t('account:twoFactor.backupTitle')
              : t('auth:twoFactorSetup.title')}
          </h1>
          <p className="text-sm text-balance break-words text-muted-foreground">
            {description}
          </p>
        </div>

        {!setup && !backupCodes && (
          <Button
            size="lg"
            loading={start.isPending}
            onClick={() => start.mutate()}
          >
            <ShieldCheckIcon />
            {t('auth:twoFactorSetup.start')}
          </Button>
        )}

        {setup && (
          <Form
            {...form}
            onSubmit={({ code }) => confirm.mutate(code)}
            className="flex flex-col gap-4"
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
                size="lg"
                maxLength={6}
                autoSubmit
                autoFocus
              />
            </FormField>
            <Button type="submit" size="lg" loading={confirm.isPending}>
              {t('account:twoFactor.confirm')}
            </Button>
          </Form>
        )}

        {backupCodes && (
          <>
            <ul
              className="grid grid-cols-2 gap-2 font-mono text-sm"
              data-testid="backup-codes"
            >
              {backupCodes.map((code) => (
                <li key={code} className="rounded-md bg-muted px-2 py-1">
                  {code}
                </li>
              ))}
            </ul>
            <Button
              variant="secondary"
              onClick={() => copy(backupCodes.join('\n'))}
            >
              <CopyIcon />
              {t('account:twoFactor.copyAll')}
            </Button>
            <Button
              size="lg"
              loading={done.isPending}
              onClick={() => done.mutate()}
            >
              {t('auth:twoFactorSetup.continue')}
            </Button>
          </>
        )}
      </div>
    </LayoutLogin>
  );
};
