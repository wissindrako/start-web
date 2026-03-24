import { zodResolver } from '@hookform/resolvers/zod';
import { t } from 'i18next';
import { z } from 'zod';

import { zu } from '@/lib/zod/zod-utils';

export const GENERO_OPTIONS = ['M', 'F'] as const;
export type Genero = (typeof GENERO_OPTIONS)[number];

export const TIPO_DOCUMENTO_OPTIONS = ['CI', 'DNI', 'PASAPORTE'] as const;
export type TipoDocumento = (typeof TIPO_DOCUMENTO_OPTIONS)[number];

export type PersonalData = z.infer<ReturnType<typeof zPersonalData>>;
export const zPersonalData = () =>
  z.object({
    id: z.string(),
    userId: z.string(),
    nombre: zu.fieldText.nullish(),
    primerApellido: zu.fieldText.nullish(),
    segundoApellido: zu.fieldText.nullish(),
    tipoDocumento: zu.fieldText.nullish(),
    numeroDocumento: zu.fieldText.nullish(),
    fechaNacimiento: z.date().nullish(),
    genero: z.enum(GENERO_OPTIONS).nullish(),
    telefono: zu.fieldText.nullish(),
    telefonoAlternativo: zu.fieldText.nullish(),
    pais: zu.fieldText.nullish(),
    departamento: zu.fieldText.nullish(),
    ciudad: zu.fieldText.nullish(),
    direccion: zu.fieldText.nullish(),
    codigoPostal: zu.fieldText.nullish(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

export type FormFieldsPersonalData = z.infer<
  ReturnType<typeof zFormFieldsPersonalData>
>;
export const zFormFieldsPersonalData = () =>
  z.object({
    nombre: zu.fieldText.required(),
    primerApellido: zu.fieldText.nullish(),
    segundoApellido: zu.fieldText.nullish(),
    tipoDocumento: z.enum(TIPO_DOCUMENTO_OPTIONS).optional(),
    numeroDocumento: zu.fieldText.required(),
    fechaNacimiento: z.coerce.date().nullish(),
    genero: z
      .enum(GENERO_OPTIONS, {
        error: t('personal-data:errors.generoRequired'),
      })
      .optional(),
    telefono: zu.fieldText.required(),
    telefonoAlternativo: zu.fieldText.nullish(),
    pais: zu.fieldText.nullish(),
    departamento: zu.fieldText.nullish(),
    ciudad: zu.fieldText.nullish(),
    direccion: zu.fieldText.required(),
    codigoPostal: zu.fieldText.nullish(),
  });

/**
 * Resolver personalizado que combina zodResolver con validaciones cruzadas.
 * Esto permite que todos los errores aparezcan simultáneamente al enviar el
 * formulario, sin depender de superRefine (que Zod omite cuando hay errores
 * en otros campos).
 */

type AnyResolver = (
  values: FormFieldsPersonalData,
  context: unknown,
  options: unknown
) => Promise<{
  values: FormFieldsPersonalData;
  errors: Record<string, { type: string; message?: string } | undefined>;
}>;

export const personalDataResolver = () => {
  const zResolver = zodResolver(
    zFormFieldsPersonalData()
  ) as unknown as AnyResolver;
  return async (
    values: FormFieldsPersonalData,
    context: unknown,
    options: unknown
  ) => {
    const result = await zResolver(values, context, options);

    if (!values.genero) {
      result.errors.genero ??= {
        type: 'custom',
        message: t('personal-data:errors.generoRequired'),
      };
    }
    if (!values.primerApellido && !values.segundoApellido) {
      const msg = t('personal-data:errors.apellidoRequired');
      result.errors.primerApellido ??= { type: 'custom', message: msg };
      result.errors.segundoApellido ??= { type: 'custom', message: msg };
    }
    if (!values.fechaNacimiento) {
      result.errors.fechaNacimiento ??= {
        type: 'custom',
        message: t('personal-data:errors.fechaNacimientoRequired'),
      };
    }

    return result;
  };
};
