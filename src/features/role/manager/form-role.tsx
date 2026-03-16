import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';

import { AVAILABLE_PERMISSIONS, FormFieldsRole } from '@/features/role/schema';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

export const FormRole = () => {
  const { t } = useTranslation(['role']);
  const form = useFormContext<FormFieldsRole>();
  const selectedPermissions = form.watch('permissions') ?? [];

  const isChecked = (subject: string, action: string) =>
    selectedPermissions.some(
      (p) => p.subject === subject && p.action === action
    );

  const toggle = (subject: string, action: string) => {
    const current = form.getValues('permissions') ?? [];
    if (isChecked(subject, action)) {
      form.setValue(
        'permissions',
        current.filter((p) => !(p.subject === subject && p.action === action)),
        { shouldDirty: true }
      );
    } else {
      form.setValue('permissions', [...current, { subject, action }], {
        shouldDirty: true,
      });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField>
        <FormFieldLabel>{t('role:common.name.label')}</FormFieldLabel>
        <FormFieldController
          type="text"
          control={form.control}
          name="name"
          autoFocus
        />
      </FormField>
      <FormField>
        <FormFieldLabel>{t('role:common.description.label')}</FormFieldLabel>
        <FormFieldController
          type="text"
          control={form.control}
          name="description"
        />
      </FormField>
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium">
          {t('role:common.permissions.label')}
        </Label>
        <div className="divide-y rounded-md border">
          {AVAILABLE_PERMISSIONS.map(({ subject, actions }) => (
            <div key={subject} className="flex items-start gap-4 px-4 py-3">
              <span className="w-28 shrink-0 pt-0.5 text-sm font-medium text-muted-foreground capitalize">
                {t(`role:subjects.${subject}`, { defaultValue: subject })}
              </span>
              <div className="flex flex-wrap gap-x-4 gap-y-2">
                {actions.map((action) => (
                  <div key={action} className="flex items-center gap-2">
                    <Checkbox
                      id={`${subject}-${action}`}
                      checked={isChecked(subject, action)}
                      onCheckedChange={() => toggle(subject, action)}
                    />
                    <label
                      htmlFor={`${subject}-${action}`}
                      className="cursor-pointer text-sm capitalize"
                    >
                      {t(`role:actions.${action}`, { defaultValue: action })}
                    </label>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
