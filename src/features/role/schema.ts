import { t } from 'i18next';
import { z } from 'zod';

import { zu } from '@/lib/zod/zod-utils';

// All available subjects and their actions in the system
export const AVAILABLE_PERMISSIONS = [
  { subject: 'apps', actions: ['app', 'manager'] },
  { subject: 'book', actions: ['read', 'create', 'update', 'delete'] },
  { subject: 'genre', actions: ['read'] },
  { subject: 'user', actions: ['list', 'create', 'update', 'delete', 'ban'] },
  { subject: 'role', actions: ['read', 'create', 'update', 'delete'] },
  { subject: 'account', actions: ['read', 'update'] },
  { subject: 'session', actions: ['list', 'revoke'] },
] as const;

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

export type Role = z.infer<ReturnType<typeof zRole>>;
export const zRole = () =>
  z.object({
    id: z.string(),
    name: zu.fieldText.required({ error: t('role:common.name.required') }),
    description: zu.fieldText.nullish(),
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
    permissions: z.array(
      z.object({
        subject: z.string(),
        action: z.string(),
      })
    ),
  });
