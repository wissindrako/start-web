import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { useRouter, useSearch } from '@tanstack/react-router';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Button } from '@/components/ui/button';

import { envClient } from '@/env/client';
import { useAccessSettings } from '@/features/access-settings/use-access-settings';
import { authClient } from '@/features/auth/client';
import { useMascot } from '@/features/auth/mascot';
import { FormFieldsLogin, zFormFieldsLogin } from '@/features/auth/schema';
import { LoginEmailHint } from '@/features/devtools/login-hint';

export default function PageLogin({
  search,
}: {
  search: { redirect?: string };
}) {
  const { t } = useTranslation(['auth', 'common']);
  const router = useRouter();
  const { settings } = useAccessSettings();
  const session = authClient.useSession();
  // The sign-in methods the access settings leave on
  const [chosenMode, setChosenMode] = useState<'code' | 'password'>('code');
  let mode = chosenMode;
  if (!settings.emailCodeLogin) mode = 'password';
  else if (!settings.passwordLogin) mode = 'code';
  const bothModes = settings.emailCodeLogin && settings.passwordLogin;
  const I18N_KEY_PAGE_PREFIX = settings.signupEnabled
    ? ('auth:pageLoginWithSignUp' as const)
    : ('auth:pageLogin' as const);
  // Invitation links come with the invited email
  const { email: invitedEmail } = useSearch({ strict: false });
  const social = useMutation({
    mutationFn: async (
      provider: Parameters<typeof authClient.signIn.social>[0]['provider']
    ) => {
      const callbackURL = search.redirect ?? '/';
      let response;
      try {
        response = await authClient.signIn.social({
          provider,
          callbackURL,
          errorCallbackURL: '/login/error',
        });
      } catch (error) {
        throw error instanceof Error
          ? error
          : new Error(t('auth:errorCode.UNKNOWN_ERROR'));
      }
      if (response.error) {
        throw new Error(response.error.message);
      }
      return response.data;
    },
    onError: (error) => {
      const message = error.message || t('auth:errorCode.UNKNOWN_ERROR');
      toast.error(message);
    },
  });

  const form = useForm({
    mode: 'onSubmit',
    resolver: zodResolver(zFormFieldsLogin()),
    defaultValues: {
      email: typeof invitedEmail === 'string' ? invitedEmail : '',
      password: '',
    },
  });

  const { isValid, isSubmitted } = form.formState;
  useMascot({ isError: !isValid && isSubmitted });

  const signInWithPassword = async (email: string, password: string) => {
    if (!password) {
      form.setError('password', {
        message: t('auth:common.password.required'),
      });
      return;
    }
    let result;
    try {
      result = await authClient.signIn.email({ email, password });
    } catch {
      toast.error(t('auth:errorCode.UNKNOWN_ERROR'));
      return;
    }
    if (result.error) {
      toast.error(
        result.error.code === 'INVALID_EMAIL_OR_PASSWORD'
          ? t('auth:common.password.invalid')
          : result.error.message || t('auth:errorCode.UNKNOWN_ERROR')
      );
      return;
    }
    // Two-factor authentication enabled: the code from the app is next
    if (
      result.data &&
      'twoFactorRedirect' in result.data &&
      result.data.twoFactorRedirect
    ) {
      router.navigate({
        to: '/login/two-factor',
        replace: true,
        search: { redirect: search.redirect },
      });
      return;
    }
    // Refetch session to update guards and redirect
    session.refetch();
  };

  const submitHandler: SubmitHandler<FormFieldsLogin> = async ({
    email,
    password,
  }) => {
    if (mode === 'password') {
      await signInWithPassword(email, password ?? '');
      return;
    }
    let result;
    try {
      result = await authClient.emailOtp.sendVerificationOtp({
        email,
        type: 'sign-in',
      });
    } catch {
      toast.error(t('auth:errorCode.UNKNOWN_ERROR'));
      return;
    }

    if (result.error) {
      const errorMessage = result.error.code
        ? t(
            `auth:errorCode.${result.error.code as unknown as keyof typeof authClient.$ERROR_CODES}`
          )
        : result.error.message || t('auth:errorCode.UNKNOWN_ERROR');
      toast.error(errorMessage);
      return;
    }

    router.navigate({
      replace: true,
      to: '/login/verify',
      search: {
        redirect: search.redirect,
        email,
      },
    });
  };

  return (
    <Form {...form} onSubmit={submitHandler} className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-bold">
          {t(`${I18N_KEY_PAGE_PREFIX}.title`)}
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          {t(`${I18N_KEY_PAGE_PREFIX}.description`)}
        </p>
      </div>
      <div className="grid gap-6">
        {bothModes && (
          <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
            {(['code', 'password'] as const).map((value) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={mode === value ? 'secondary' : 'ghost'}
                onClick={() => setChosenMode(value)}
              >
                {t(`auth:pageLogin.modes.${value}`)}
              </Button>
            ))}
          </div>
        )}
        <div className="grid gap-4">
          <FormField>
            <FormFieldLabel className="sr-only">
              {t('auth:common.email.label')}
            </FormFieldLabel>
            <FormFieldController
              type="email"
              control={form.control}
              name="email"
              size="lg"
              placeholder={t('auth:common.email.label')}
            />
          </FormField>
          {mode === 'password' && (
            <FormField>
              <FormFieldLabel className="sr-only">
                {t('auth:common.password.label')}
              </FormFieldLabel>
              <FormFieldController
                type="password"
                control={form.control}
                name="password"
                size="lg"
                autoComplete="current-password"
                placeholder={t('auth:common.password.label')}
              />
            </FormField>
          )}
          <Button
            loading={form.formState.isSubmitting}
            type="submit"
            size="lg"
            className="w-full"
          >
            {mode === 'password'
              ? t('auth:pageLogin.loginWithPassword')
              : t(`${I18N_KEY_PAGE_PREFIX}.loginWithEmail`)}
          </Button>
          {mode === 'code' && <LoginEmailHint />}
        </div>
        <div className="relative text-center text-sm after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t after:border-border">
          <span className="relative z-10 bg-background px-2 text-muted-foreground">
            {t(`${I18N_KEY_PAGE_PREFIX}.spacer`)}
          </span>
        </div>
        <Button
          className="w-full"
          variant="secondary"
          disabled={envClient.VITE_IS_DEMO}
          loading={
            social.variables === 'github' &&
            (social.isPending || social.isSuccess)
          }
          size="lg"
          onClick={() => social.mutate('github')}
        >
          {t(`${I18N_KEY_PAGE_PREFIX}.loginWithSocial`, { provider: 'GitHub' })}
        </Button>
      </div>
    </Form>
  );
}
