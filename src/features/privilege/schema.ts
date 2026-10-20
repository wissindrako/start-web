import { z } from 'zod';

export const PRIVILEGE_EFFECTS = ['grant', 'deny'] as const;
export type PrivilegeEffect = (typeof PRIVILEGE_EFFECTS)[number];

// Permission is "subject:action", as offered by the system catalog
export const zFormFieldsPrivilege = () =>
  z.object({
    permission: z.string().min(1),
    effect: z.enum(PRIVILEGE_EFFECTS),
    reason: z.string().trim().max(255).optional(),
    expiresAt: z.date().optional(),
  });

export type FormFieldsPrivilege = z.infer<
  ReturnType<typeof zFormFieldsPrivilege>
>;

export const permissionKey = (p: { subject: string; action: string }) =>
  `${p.subject}:${p.action}`;

export const parsePermissionKey = (key: string) => {
  const index = key.lastIndexOf(':');
  return { subject: key.slice(0, index), action: key.slice(index + 1) };
};
