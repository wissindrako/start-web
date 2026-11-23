import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { protectedProcedure } from '@/server/orpc';
import {
  dia,
  fichaPersona,
  listarDelegaciones,
  listarPersonas,
  listarPuestos,
  opciones,
  organigrama,
  registrarMovimiento,
} from '@/server/rrhh/consultas';
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

const zFecha = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .optional();
const zTipoAsignacion = z.enum([
  'TITULAR',
  'INTERINO',
  'ROTACION',
  'COMISION',
  'SUPLENCIA',
]);

const reader = (subject: 'persona' | 'organizacion' | 'movilidad') =>
  protectedProcedure({ permission: { [subject]: ['read'] } });
const mover = () =>
  protectedProcedure({ permission: { movilidad: ['update'] } });

export default {
  // People with their posts on a date (today by default)
  personas: reader('persona')
    .route({ method: 'GET', path: '/rrhh/personas', tags })
    .input(
      z.object({
        busqueda: z.string().optional(),
        dependenciaId: z.string().optional(),
        fecha: zFecha,
        soloVigentes: z.boolean().default(true),
      })
    )
    .handler(({ context, input }) =>
      listarPersonas(context.db, { ...input, fecha: dia(input.fecha) })
    ),

  // A person's file: data, account, assignments (history), movements,
  // delegations and immediate superior on the date
  persona: reader('persona')
    .route({ method: 'GET', path: '/rrhh/personas/{id}', tags })
    .input(z.object({ id: z.string().uuid(), fecha: zFecha }))
    .handler(({ context, input }) =>
      fichaPersona(context.db, input.id, dia(input.fecha))
    ),

  organigrama: reader('organizacion')
    .route({ method: 'GET', path: '/rrhh/organigrama', tags })
    .input(z.object({ fecha: zFecha }))
    .handler(({ context, input }) => organigrama(context.db, dia(input.fecha))),

  puestos: reader('organizacion')
    .route({ method: 'GET', path: '/rrhh/puestos', tags })
    .input(
      z.object({
        dependenciaId: z.string().optional(),
        fecha: zFecha,
        soloVacantes: z.boolean().default(false),
      })
    )
    .handler(({ context, input }) =>
      listarPuestos(context.db, { ...input, fecha: dia(input.fecha) })
    ),

  opciones: reader('movilidad')
    .route({ method: 'GET', path: '/rrhh/opciones', tags })
    .handler(({ context }) => opciones(context.db)),

  registrarMovimiento: mover()
    .route({ method: 'POST', path: '/rrhh/movimientos', tags })
    .input(
      z.object({
        personaId: z.string().uuid(),
        tipoMovimiento: z.string(),
        fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        documento: z.string().nullish(),
        observaciones: z.string().nullish(),
        cerrar: z.array(z.string().uuid()),
        abrir: z
          .object({
            puestoId: z.string().uuid(),
            tipo: zTipoAsignacion,
            hasta: zFecha.nullable(),
          })
          .nullish(),
      })
    )
    .handler(({ context, input }) => {
      context.logger.info('Register HR movement');
      return registrarMovimiento(
        context.db,
        {
          ...input,
          fecha: dia(input.fecha),
          abrir: input.abrir
            ? {
                ...input.abrir,
                hasta: input.abrir.hasta ? dia(input.abrir.hasta) : null,
              }
            : null,
        },
        context.user.id
      );
    }),

  delegaciones: reader('movilidad')
    .route({ method: 'GET', path: '/rrhh/delegaciones', tags })
    .input(z.object({ fecha: zFecha, todas: z.boolean().default(false) }))
    .handler(({ context, input }) =>
      listarDelegaciones(context.db, {
        fecha: dia(input.fecha),
        todas: input.todas,
      })
    ),

  crearDelegacion: mover()
    .route({ method: 'POST', path: '/rrhh/delegaciones', tags })
    .input(
      z.object({
        delegantePersonaId: z.string().uuid(),
        delegadoPersonaId: z.string().uuid(),
        desde: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        hasta: zFecha.nullable(),
        motivo: z.string().nullish(),
        documento: z.string().nullish(),
      })
    )
    .handler(async ({ context, input }) => {
      if (input.delegantePersonaId === input.delegadoPersonaId) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'Una persona no se delega a sí misma',
        });
      }
      const desde = dia(input.desde);
      const hasta = input.hasta ? dia(input.hasta) : null;
      if (hasta && hasta < desde) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'La delegación termina antes de empezar',
        });
      }
      context.logger.info('Create delegation');
      const created = await context.db.delegacion.create({
        data: {
          delegantePersonaId: input.delegantePersonaId,
          delegadoPersonaId: input.delegadoPersonaId,
          desde,
          hasta,
          motivo: input.motivo || null,
          documento: input.documento || null,
        },
      });
      return { id: created.id };
    }),

  // Ends a delegation on a day (inclusive); it is never deleted
  cerrarDelegacion: mover()
    .route({ method: 'POST', path: '/rrhh/delegaciones/{id}/cerrar', tags })
    .input(
      z.object({
        id: z.string().uuid(),
        hasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      })
    )
    .handler(async ({ context, input }) => {
      const current = await context.db.delegacion.findUnique({
        where: { id: input.id },
      });
      if (!current) throw new ORPCError('NOT_FOUND');
      const hasta = dia(input.hasta);
      if (hasta < current.desde) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'La delegación termina antes de empezar',
        });
      }
      await context.db.delegacion.update({
        where: { id: input.id },
        data: { hasta },
      });
      return { id: input.id };
    }),

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
