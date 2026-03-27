import { useQuery } from '@tanstack/react-query';
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

import {
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { ExternalSystem } from '@/features/external-system/schema';
import {
  AVAILABLE_PERMISSIONS,
  FormFieldsRole,
  ROLE_SCOPES,
} from '@/features/role/schema';
import { orpc } from '@/lib/orpc/client';

// ─── External: system selector + module checkboxes ───────────────────────────

type ExternalSystemPermissionsProps = {
  systemId: string | null | undefined;
  systems: ExternalSystem[];
  isLoadingSystems: boolean;
  permissions: Array<{ subject: string; action: string }>;
  onSystemChange: (systemId: string | null) => void;
  onPermissionsChange: (
    permissions: Array<{ subject: string; action: string }>
  ) => void;
};

const ExternalSystemPermissions = ({
  systemId,
  systems,
  isLoadingSystems,
  permissions,
  onSystemChange,
  onPermissionsChange,
}: ExternalSystemPermissionsProps) => {
  const { t } = useTranslation(['role']);

  const selectedSystem = systems.find((s) => s.id === systemId) ?? null;

  const isChecked = (subject: string, action: string) =>
    permissions.some((p) => p.subject === subject && p.action === action);

  const toggle = (subject: string, action: string) => {
    if (isChecked(subject, action)) {
      onPermissionsChange(
        permissions.filter(
          (p) => !(p.subject === subject && p.action === action)
        )
      );
    } else {
      onPermissionsChange([...permissions, { subject, action }]);
    }
  };

  const handleSystemChange = (newSystemId: string) => {
    onSystemChange(newSystemId || null);
    // Reset permissions when changing system
    onPermissionsChange([]);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* System selector */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          {t('role:common.system.label')}
        </Label>
        {isLoadingSystems ? (
          <div className="h-9 animate-pulse rounded-md bg-muted" />
        ) : systems.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t('role:common.system.empty')}
          </p>
        ) : (
          <Select
            value={systemId ?? undefined}
            onValueChange={handleSystemChange}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('role:common.system.placeholder')}>
                {(value: string | null) => {
                  if (!value) return null;
                  const s = systems.find((s) => s.id === value);
                  return s ? (s.label ?? s.name) : value;
                }}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {systems.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label ?? s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Modules from the selected system */}
      {selectedSystem && selectedSystem.modules.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label className="text-sm font-medium">
            {t('role:common.permissions.label')}
          </Label>
          <div className="divide-y rounded-md border">
            {selectedSystem.modules.map((mod) => (
              <div key={mod.id} className="flex items-start gap-4 px-4 py-3">
                <span className="w-32 shrink-0 pt-0.5 text-sm font-medium capitalize">
                  {mod.name}
                </span>
                <div className="flex flex-wrap gap-x-4 gap-y-2">
                  {mod.actions.map((action) => (
                    <div key={action} className="flex items-center gap-2">
                      <Checkbox
                        id={`${mod.name}-${action}`}
                        checked={isChecked(mod.name, action)}
                        onCheckedChange={() => toggle(mod.name, action)}
                      />
                      <label
                        htmlFor={`${mod.name}-${action}`}
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
      )}
    </div>
  );
};

// ─── Local: fixed permission matrix ──────────────────────────────────────────

type LocalPermissionMatrixProps = {
  permissions: Array<{ subject: string; action: string }>;
  onChange: (permissions: Array<{ subject: string; action: string }>) => void;
};

const LocalPermissionMatrix = ({
  permissions,
  onChange,
}: LocalPermissionMatrixProps) => {
  const { t } = useTranslation(['role']);

  const visiblePermissions = AVAILABLE_PERMISSIONS.filter(
    (p) => p.scope === 'both' || p.scope === 'local'
  );

  const isChecked = (subject: string, action: string) =>
    permissions.some((p) => p.subject === subject && p.action === action);

  const toggle = (subject: string, action: string) => {
    if (isChecked(subject, action)) {
      onChange(
        permissions.filter(
          (p) => !(p.subject === subject && p.action === action)
        )
      );
    } else {
      onChange([...permissions, { subject, action }]);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Label className="text-sm font-medium">
        {t('role:common.permissions.label')}
      </Label>
      <div className="divide-y rounded-md border">
        {visiblePermissions.map(({ subject, actions }) => (
          <div key={subject} className="flex items-start gap-4 px-4 py-3">
            <span className="w-32 shrink-0 pt-0.5 text-sm font-medium text-muted-foreground capitalize">
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
  );
};

// ─── Main form ────────────────────────────────────────────────────────────────

export const FormRole = () => {
  const { t } = useTranslation(['role']);
  const form = useFormContext<FormFieldsRole>();
  const scope = form.watch('scope') ?? 'local';
  const systemId = form.watch('systemId');
  const permissions = form.watch('permissions') ?? [];

  const systemsQuery = useQuery(orpc.externalSystem.getAll.queryOptions());
  const systems = systemsQuery.data ?? [];
  const isLoadingSystems = systemsQuery.isLoading;

  const setPermissions = (next: Array<{ subject: string; action: string }>) => {
    form.setValue('permissions', next, { shouldDirty: true });
  };

  const handleScopeChange = (newScope: 'local' | 'external') => {
    if (newScope === 'local') {
      // Drop permissions not in AVAILABLE_PERMISSIONS local/both
      const allowed = AVAILABLE_PERMISSIONS.filter(
        (p) => p.scope === 'both' || p.scope === 'local'
      );
      const allowedKeys = new Set(
        allowed.flatMap((p) => p.actions.map((a) => `${p.subject}:${a}`))
      );
      form.setValue(
        'permissions',
        permissions.filter((p) => allowedKeys.has(`${p.subject}:${p.action}`)),
        { shouldDirty: true }
      );
    }
    // Preserve systemId when switching scopes
    form.setValue('scope', newScope, { shouldDirty: true });
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

      {/* Scope selector */}
      <div className="flex flex-col gap-2">
        <Label className="text-sm font-medium">
          {t('role:common.scope.label')}
        </Label>
        <div className="flex gap-2">
          {ROLE_SCOPES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => handleScopeChange(s)}
              className={`rounded-md border px-4 py-2 text-sm transition-colors ${
                scope === s
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background hover:bg-muted'
              }`}
            >
              {t(`role:scopes.${s}`)}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t(`role:common.scope.hint.${scope}`)}
        </p>
      </div>

      {/* Permission section: matrix for local, system selector for external */}
      {scope === 'local' ? (
        <LocalPermissionMatrix
          permissions={permissions}
          onChange={setPermissions}
        />
      ) : (
        <ExternalSystemPermissions
          systemId={systemId}
          systems={systems}
          isLoadingSystems={isLoadingSystems}
          permissions={permissions}
          onSystemChange={(id) => {
            form.setValue('systemId', id, { shouldDirty: true });
          }}
          onPermissionsChange={setPermissions}
        />
      )}
    </div>
  );
};
