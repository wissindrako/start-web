import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { SubmitHandler, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldHelper,
  FormFieldLabel,
} from '@/components/form';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/ui/button-link';

import { authClient } from '@/features/auth/client';
import { useMascot } from '@/features/auth/mascot';

const zFormFieldsTwoFactor = () =>
  z.object({
    code: z.string().trim().min(1),
    trustDevice: z.boolean(),
  });

type FormFieldsTwoFactor = z.infer<ReturnType<typeof zFormFieldsTwoFactor>>;

// Second step of the sign-in for users with two-factor authentication: a
// code from their authenticator app, or one of their backup codes
export default function PageLoginTwoFactor() {
  const { t } = useTranslation(['auth', 'common']);
  const session = authClient.useSession();
  const [useBackupCode, setUseBackupCode] = useState(false);

  const form = useForm<FormFieldsTwoFactor>({
    mode: 'onSubmit',
    resolver: zodResolver(zFormFieldsTwoFactor()),
    defaultValues: { code: '', trustDevice: false },
  });
  const { isValid, isSubmitted } = form.formState;
  useMascot({ isError: !isValid && isSubmitted });

  const submitHandler: SubmitHandler<FormFieldsTwoFactor> = async ({
    code,
    trustDevice,
  }) => {
    const { error } = useBackupCode
      ? await authClient.twoFactor.verifyBackupCode({ code, trustDevice })
      : await authClient.twoFactor.verifyTotp({ code, trustDevice });

    if (error) {
      toast.error(error.message || t('auth:errorCode.UNKNOWN_ERROR'));
      // Cleared so the next code can be typed (and auto-submitted) right away
      form.setValue('code', '');
      form.setError('code', { message: t('auth:pageLoginTwoFactor.invalid') });
      return;
    }

    // Refetch session to update guards and redirect
    session.refetch();
  };

  return (
    <Form
      {...form}
      onSubmit={submitHandler}
      className="flex flex-col gap-4 pb-12"
    >
      <div className="flex flex-col gap-1">
        <ButtonLink variant="link" to="/login">
          <ArrowLeftIcon />
          {t('common:actions.back')}
        </ButtonLink>
        <h1 className="text-lg font-bold text-balance">
          {t('auth:pageLoginTwoFactor.title')}
        </h1>
        <p className="text-sm text-balance text-muted-foreground">
          {useBackupCode
            ? t('auth:pageLoginTwoFactor.backupDescription')
            : t('auth:pageLoginTwoFactor.description')}
        </p>
      </div>
      <div className="grid gap-4">
        <FormField>
          <FormFieldLabel>
            {useBackupCode
              ? t('auth:pageLoginTwoFactor.backupCode')
              : t('auth:pageLoginTwoFactor.code')}
          </FormFieldLabel>
          {useBackupCode ? (
            <FormFieldController
              type="text"
              control={form.control}
              name="code"
              size="lg"
              autoComplete="off"
              autoFocus
            />
          ) : (
            <FormFieldController
              type="otp"
              control={form.control}
              name="code"
              size="lg"
              maxLength={6}
              autoSubmit
              autoFocus
            />
          )}
          <FormFieldHelper className="text-xs">
            <button
              type="button"
              className="underline underline-offset-2"
              onClick={() => {
                form.reset({ ...form.getValues(), code: '' });
                setUseBackupCode((value) => !value);
              }}
            >
              {useBackupCode
                ? t('auth:pageLoginTwoFactor.useApp')
                : t('auth:pageLoginTwoFactor.useBackupCode')}
            </button>
          </FormFieldHelper>
        </FormField>
        <FormField>
          <FormFieldController
            type="checkbox"
            control={form.control}
            name="trustDevice"
          >
            {t('auth:pageLoginTwoFactor.trustDevice')}
          </FormFieldController>
        </FormField>
        <Button loading={form.formState.isSubmitting} type="submit" size="lg">
          {t('auth:pageLoginTwoFactor.confirm')}
        </Button>
      </div>
    </Form>
  );
}
