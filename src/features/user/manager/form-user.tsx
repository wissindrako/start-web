import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';

import { FormFieldsUser } from '@/features/user/schema';

export const FormUser = () => {
  const { t } = useTranslation(['user']);
  const form = useFormContext<FormFieldsUser>();

  return (
    <div className="flex flex-col gap-4">
      <FormField>
        <FormFieldLabel>{t('user:common.name.label')}</FormFieldLabel>
        <FormFieldController
          type="text"
          control={form.control}
          name="name"
          autoFocus
        />
      </FormField>
      <FormField>
        <FormFieldLabel>{t('user:common.email.label')}</FormFieldLabel>
        <FormFieldController type="email" control={form.control} name="email" />
      </FormField>
    </div>
  );
};
