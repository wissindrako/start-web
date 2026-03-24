import { z } from 'zod';

export type SystemConfig = z.infer<ReturnType<typeof zSystemConfig>>;
export const zSystemConfig = () =>
  z.object({
    systemName: z.string().nullish(),
    logoUrl: z.string().nullish(),
  });

export type FormFieldsSystemConfig = z.infer<
  ReturnType<typeof zFormFieldsSystemConfig>
>;
export const zFormFieldsSystemConfig = () =>
  z.object({
    systemName: z.string().trim().optional(),
  });
