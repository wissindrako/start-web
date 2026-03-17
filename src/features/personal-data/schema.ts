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
    nombre: zu.fieldText.nullish(),
    primerApellido: zu.fieldText.nullish(),
    segundoApellido: zu.fieldText.nullish(),
    tipoDocumento: zu.fieldText.nullish(),
    numeroDocumento: zu.fieldText.nullish(),
    fechaNacimiento: z.coerce.date().nullish(),
    genero: zu.fieldText.nullish(),
    telefono: zu.fieldText.nullish(),
    telefonoAlternativo: zu.fieldText.nullish(),
    pais: zu.fieldText.nullish(),
    departamento: zu.fieldText.nullish(),
    ciudad: zu.fieldText.nullish(),
    direccion: zu.fieldText.nullish(),
    codigoPostal: zu.fieldText.nullish(),
  });
