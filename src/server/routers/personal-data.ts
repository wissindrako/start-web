import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { zPersonalData } from '@/features/personal-data/schema';
import { protectedProcedure } from '@/server/orpc';

const tags = ['personal-data'];

export default {
  getByUserId: protectedProcedure({
    permission: {
      personalData: ['read'],
    },
  })
    .route({
      method: 'GET',
      path: '/personal-data/{userId}',
      tags,
    })
    .input(
      z.object({
        userId: z.string(),
      })
    )
    .output(zPersonalData().nullable())
    .handler(async ({ context, input }) => {
      context.logger.info('Getting personal data');
      return await context.db.personalData.findUnique({
        where: { userId: input.userId },
      });
    }),

  upsertByUserId: protectedProcedure({
    permission: {
      personalData: ['update'],
    },
  })
    .route({
      method: 'POST',
      path: '/personal-data/{userId}',
      tags,
    })
    .input(
      z.object({
        userId: z.string(),
        nombre: z.string().nullish(),
        primerApellido: z.string().nullish(),
        segundoApellido: z.string().nullish(),
        tipoDocumento: z.enum(['CI', 'DNI', 'PASAPORTE']).nullish(),
        numeroDocumento: z.string().nullish(),
        fechaNacimiento: z.coerce.date().nullish(),
        genero: z.enum(['M', 'F']).nullish(),
        telefono: z.string().nullish(),
        telefonoAlternativo: z.string().nullish(),
        pais: z.string().nullish(),
        departamento: z.string().nullish(),
        ciudad: z.string().nullish(),
        direccion: z.string().nullish(),
        codigoPostal: z.string().nullish(),
      })
    )
    .output(zPersonalData())
    .handler(async ({ context, input }) => {
      const user = await context.db.user.findUnique({
        where: { id: input.userId },
      });
      if (!user) {
        context.logger.warn('User not found for personal data upsert');
        throw new ORPCError('NOT_FOUND');
      }

      const { userId, ...data } = input;

      context.logger.info('Upserting personal data');
      return await context.db.personalData.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    }),
};
