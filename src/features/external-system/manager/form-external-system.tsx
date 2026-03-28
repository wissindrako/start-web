import { PlusIcon, Trash2Icon, XIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { FormFieldsExternalSystem } from '@/features/external-system/schema';

const BASIC_ACTIONS = ['read', 'create', 'update', 'delete'] as const;

export const FormExternalSystem = () => {
  const { t } = useTranslation(['external-system']);
  const form = useFormContext<FormFieldsExternalSystem>();
  const modules = form.watch('modules') ?? [];

  const [newModuleName, setNewModuleName] = useState('');
  const [customInputs, setCustomInputs] = useState<Record<string, string>>({});
  const newModuleRef = useRef<HTMLInputElement>(null);

  const setModules = (next: FormFieldsExternalSystem['modules']) => {
    form.setValue('modules', next, { shouldDirty: true });
  };

  const addModule = () => {
    const name = newModuleName.trim().toLowerCase();
    if (!name || modules.some((m) => m.name === name)) return;
    setModules([...modules, { name, actions: [], order: modules.length }]);
    setNewModuleName('');
    newModuleRef.current?.focus();
  };

  const removeModule = (index: number) => {
    setModules(modules.filter((_, i) => i !== index));
  };

  const isActionChecked = (index: number, action: string) =>
    modules[index]?.actions.includes(action) ?? false;

  const toggleAction = (index: number, action: string) => {
    const mod = modules[index];
    if (!mod) return;
    const next = mod.actions.includes(action)
      ? mod.actions.filter((a) => a !== action)
      : [...mod.actions, action];
    const updated = [...modules];
    updated[index] = { ...mod, actions: next };
    setModules(updated);
  };

  const customActionsFor = (index: number) =>
    (modules[index]?.actions ?? []).filter(
      (a) => !(BASIC_ACTIONS as readonly string[]).includes(a)
    );

  const addCustomAction = (index: number) => {
    const action = (customInputs[index] ?? '').trim().toLowerCase();
    if (!action || isActionChecked(index, action)) return;
    toggleAction(index, action);
    setCustomInputs((prev) => ({ ...prev, [index]: '' }));
  };

  const removeCustomAction = (index: number, action: string) => {
    toggleAction(index, action);
  };

  return (
    <div className="flex flex-col gap-4">
      <FormField>
        <FormFieldLabel>
          {t('external-system:common.name.label')}
        </FormFieldLabel>
        <FormFieldController
          type="text"
          control={form.control}
          name="name"
          autoFocus
        />
        <p className="text-xs text-muted-foreground">
          {t('external-system:common.name.hint')}
        </p>
      </FormField>

      <FormField>
        <FormFieldLabel>
          {t('external-system:common.label.label')}
        </FormFieldLabel>
        <FormFieldController type="text" control={form.control} name="label" />
      </FormField>

      {/* Modules */}
      <div className="flex flex-col gap-3">
        <Label className="text-sm font-medium">
          {t('external-system:common.modules.label')}
        </Label>

        {modules.length > 0 && (
          <div className="divide-y rounded-md border">
            {modules.map((mod, index) => {
              const extras = customActionsFor(index);
              return (
                <div key={index} className="flex flex-col gap-3 px-4 py-3">
                  {/* Module header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold capitalize">
                      {mod.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeModule(index)}
                      className="text-muted-foreground hover:text-destructive"
                      aria-label={t('external-system:module.remove')}
                    >
                      <Trash2Icon className="size-4" />
                    </button>
                  </div>

                  {/* Basic CRUD checkboxes */}
                  <div className="flex flex-wrap gap-x-4 gap-y-2">
                    {BASIC_ACTIONS.map((action) => (
                      <div key={action} className="flex items-center gap-2">
                        <Checkbox
                          id={`${index}-${action}`}
                          checked={isActionChecked(index, action)}
                          onCheckedChange={() => toggleAction(index, action)}
                        />
                        <label
                          htmlFor={`${index}-${action}`}
                          className="cursor-pointer text-sm"
                        >
                          {t(`external-system:actions.${action}`, {
                            defaultValue: action,
                          })}
                        </label>
                      </div>
                    ))}
                  </div>

                  {/* Custom actions */}
                  <div className="flex flex-col gap-2">
                    {extras.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {extras.map((action) => (
                          <Badge
                            key={action}
                            variant="secondary"
                            className="gap-1 pr-1 text-xs"
                          >
                            {action}
                            <button
                              type="button"
                              onClick={() => removeCustomAction(index, action)}
                              className="ml-0.5 hover:text-destructive"
                            >
                              <XIcon className="size-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        className="h-7 text-xs"
                        placeholder={t(
                          'external-system:module.actions.placeholder'
                        )}
                        value={customInputs[index] ?? ''}
                        onChange={(e) =>
                          setCustomInputs((prev) => ({
                            ...prev,
                            [index]: e.target.value,
                          }))
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addCustomAction(index);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        size="xs"
                        variant="secondary"
                        onClick={() => addCustomAction(index)}
                      >
                        +
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add module input */}
        <div className="flex gap-2">
          <Input
            ref={newModuleRef}
            placeholder={t('external-system:module.name.placeholder')}
            value={newModuleName}
            onChange={(e) => setNewModuleName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addModule();
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={addModule}
            disabled={!newModuleName.trim()}
          >
            <PlusIcon className="size-4" />
            {t('external-system:module.add')}
          </Button>
        </div>
      </div>
    </div>
  );
};
