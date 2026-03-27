import { z } from 'zod';

import { zu } from '@/lib/zod/zod-utils';

export const zExternalModule = () =>
  z.object({
    id: z.string(),
    systemId: z.string(),
    name: z.string(),
    actions: z.array(z.string()),
    order: z.number(),
  });

export const zExternalSystem = () =>
  z.object({
    id: z.string(),
    name: z.string(),
    label: z.string().nullish(),
    modules: z.array(zExternalModule()),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

export type ExternalSystem = z.infer<ReturnType<typeof zExternalSystem>>;
export type ExternalModule = z.infer<ReturnType<typeof zExternalModule>>;

export const zFormFieldsExternalModule = () =>
  z.object({
    name: z.string().trim().min(1),
    actions: z.array(z.string()),
    order: z.number().default(0),
  });

export type FormFieldsExternalSystem = z.infer<
  ReturnType<typeof zFormFieldsExternalSystem>
>;
export const zFormFieldsExternalSystem = () =>
  z.object({
    name: zu.fieldText.required({ error: 'Name is required' }),
    label: zu.fieldText.nullish(),
    modules: z.array(zFormFieldsExternalModule()).default([]),
  });
