import { zodResolver } from '@hookform/resolvers/zod';
import { t } from 'i18next';
import type { Resolver } from 'react-hook-form';
import { z } from 'zod';

import { zu } from '@/lib/zod/zod-utils';

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
    genero: zu.fieldText.nullish(),
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
    tipoDocumento: zu.fieldText.nullish(),
    numeroDocumento: zu.fieldText.required(),
    fechaNacimiento: z.coerce.date().nullish(),
    genero: zu.fieldText.required(),
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
export const personalDataResolver = (): Resolver<FormFieldsPersonalData> => {
  const zResolver = zodResolver(zFormFieldsPersonalData());
  return async (values, context, options) => {
    const result = await zResolver(values, context, options);

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
