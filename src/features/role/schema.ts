import { t } from 'i18next';
import { z } from 'zod';

import { zu } from '@/lib/zod/zod-utils';

import { zExternalModule } from '@/features/external-system/schema';

export const ROLE_SCOPES = ['local', 'external'] as const;
export type RoleScope = (typeof ROLE_SCOPES)[number];
export const zRoleScope = () => z.enum(ROLE_SCOPES);

// Scope of each subject: 'local' = only admin panel, 'external' = only other systems, 'both' = all roles
export const AVAILABLE_PERMISSIONS = [
  { subject: 'apps', scope: 'local', actions: ['app', 'manager'] },
  {
    subject: 'user',
    scope: 'local',
    actions: ['list', 'create', 'update', 'delete', 'ban'],
  },
  {
    subject: 'role',
    scope: 'local',
    actions: ['read', 'create', 'update', 'delete'],
  },
  {
    subject: 'externalSystem',
    scope: 'local',
    actions: ['read', 'create', 'update', 'delete'],
  },
  { subject: 'session', scope: 'local', actions: ['list', 'revoke'] },
  { subject: 'systemConfig', scope: 'local', actions: ['read', 'update'] },
  {
    subject: 'book',
    scope: 'both',
    actions: ['read', 'create', 'update', 'delete'],
  },
  { subject: 'genre', scope: 'both', actions: ['read'] },
  {
    subject: 'personalData',
    scope: 'both',
    actions: ['read', 'create', 'update', 'delete'],
  },
  { subject: 'account', scope: 'both', actions: ['read', 'update'] },
] as const;

export type AvailableSubject =
  (typeof AVAILABLE_PERMISSIONS)[number]['subject'];

export const zPermission = () =>
  z.object({
    id: z.string(),
    subject: z.string(),
    action: z.string(),
  });

export const zRolePermission = () =>
  z.object({
    roleId: z.string(),
    permissionId: z.string(),
    permission: zPermission(),
  });

const zExternalSystemSummary = () =>
  z.object({
    id: z.string(),
    name: z.string(),
    label: z.string().nullish(),
    modules: z.array(zExternalModule()),
  });

export type Role = z.infer<ReturnType<typeof zRole>>;
export const zRole = () =>
  z.object({
    id: z.string(),
    name: zu.fieldText.required({ error: t('role:common.name.required') }),
    description: zu.fieldText.nullish(),
    scope: zRoleScope(),
    systemId: z.string().nullish(),
    externalSystem: zExternalSystemSummary().nullish(),
    createdAt: z.date(),
    updatedAt: z.date(),
    permissions: z.array(zRolePermission()),
    _count: z.object({ userAssignments: z.number() }),
  });

export type FormFieldsRole = z.infer<ReturnType<typeof zFormFieldsRole>>;
export const zFormFieldsRole = () =>
  z.object({
    name: zu.fieldText.required({ error: t('role:common.name.required') }),
    description: zu.fieldText.nullish(),
    scope: zRoleScope().default('local'),
    systemId: z.string().nullish(),
    permissions: z.array(
      z.object({
        subject: z.string(),
        action: z.string(),
      })
    ),
  });
