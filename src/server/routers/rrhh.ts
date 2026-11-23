import { z } from 'zod';

import { protectedProcedure } from '@/server/orpc';
import { importarPlanilla } from '@/server/rrhh/importar';
import { leerPlanilla } from '@/server/rrhh/planilla';

const tags = ['rrhh'];

const zIssue = z.object({
  hoja: z.string(),
  fila: z.number(),
  mensaje: z.string(),
});
const zConteo = z.object({
  nuevas: z.number(),
  cambian: z.number(),
  iguales: z.number(),
});

/** Importing writes people, the org chart and mobility: it needs the three */
const importer = () =>
  protectedProcedure({
    permission: {
      persona: ['update'],
      organizacion: ['update'],
      movilidad: ['update'],
    },
  });

export default {
  // RR.HH.'s spreadsheet: with aplicar = false it only reports what would
  // change; with aplicar = true it saves all or nothing (never with errors)
  importar: importer()
    .route({ method: 'POST', path: '/rrhh/importar', tags })
    .input(
      z.object({
        archivo: z.instanceof(File),
        aplicar: z.boolean(),
      })
    )
    .output(
      z.object({
        resumen: z.object({
          dependencias: zConteo,
          puestos: zConteo,
          personas: zConteo,
          asignaciones: zConteo,
          delegaciones: zConteo,
        }),
        errores: z.array(zIssue),
        avisos: z.array(zIssue),
        aplicado: z.boolean(),
      })
    )
    .handler(async ({ context, input }) => {
      context.logger.info(
        `RR.HH. spreadsheet ${input.aplicar ? 'import' : 'check'}`
      );
      const read = await leerPlanilla(await input.archivo.arrayBuffer());
      const result = await importarPlanilla(context.db, read.planilla, {
        aplicar: input.aplicar && read.errores.length === 0,
        registradoPorId: context.user.id,
      });
      return {
        resumen: result.resumen,
        errores: [...read.errores, ...result.errores],
        avisos: [...read.avisos, ...result.avisos],
        aplicado: result.aplicado,
      };
    }),
};
