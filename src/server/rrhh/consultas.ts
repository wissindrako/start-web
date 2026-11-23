/**
 * Queries and HR acts behind the Recursos humanos screens: people with their
 * posts on a date, a person's file, the org chart on a date, posts and
 * delegations, and registering a movement (closes and opens assignments).
 * "On a date" uses the SQL functions of prisma/ddl (asignaciones_en_fecha,
 * jefatura_en_fecha, jefe_inmediato_en_fecha).
 */
import { ORPCError } from '@orpc/client';

import type { db as Db } from '@/server/db';
import { Prisma } from '@/server/db/generated/client';

type Client = typeof Db;

/** Today in Bolivia as a day-only date (what @db.Date columns hold) */
export const hoy = () =>
  new Date(
    `${new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' })}T00:00:00Z`
  );

/** 'YYYY-MM-DD' (or nothing: today) → day-only date */
export const dia = (value?: string | null) =>
  value ? new Date(`${value}T00:00:00Z`) : hoy();

const vigenteEn = (fecha: Date) => ({
  desde: { lte: fecha },
  OR: [{ hasta: null }, { hasta: { gte: fecha } }],
});

const nombreDe = (p: {
  nombre: string | null;
  primerApellido: string | null;
  segundoApellido: string | null;
}) => [p.nombre, p.primerApellido, p.segundoApellido].filter(Boolean).join(' ');

const puestoSelect = {
  id: true,
  codigo: true,
  denominacion: true,
  esJefatura: true,
  numero: true,
  dependencia: {
    select: { id: true, codigo: true, sigla: true, nombre: true },
  },
} as const;

// ─── People ──────────────────────────────────────────────────────────────────

export async function listarPersonas(
  db: Client,
  {
    busqueda,
    dependenciaId,
    fecha,
    soloVigentes,
  }: {
    busqueda?: string;
    dependenciaId?: string;
    fecha: Date;
    soloVigentes: boolean;
  }
) {
  const words = (busqueda ?? '').trim().split(/\s+/).filter(Boolean);
  const vigentes = {
    ...vigenteEn(fecha),
    ...(dependenciaId ? { puesto: { dependenciaId } } : {}),
  };
  const personas = await db.personalData.findMany({
    where: {
      AND: words.map((word) => ({
        OR: [
          { nombre: { contains: word, mode: 'insensitive' as const } },
          { primerApellido: { contains: word, mode: 'insensitive' as const } },
          { segundoApellido: { contains: word, mode: 'insensitive' as const } },
          { numeroDocumento: { startsWith: word } },
        ],
      })),
      ...(soloVigentes || dependenciaId
        ? { asignaciones: { some: vigentes } }
        : {}),
    },
    include: {
      user: { select: { email: true } },
      asignaciones: {
        where: vigenteEn(fecha),
        include: { puesto: { select: puestoSelect } },
        orderBy: { desde: 'asc' },
      },
    },
    orderBy: [
      { primerApellido: 'asc' },
      { segundoApellido: 'asc' },
      { nombre: 'asc' },
    ],
    take: 1000,
  });
  return personas.map((p) => ({
    id: p.id,
    nombre: nombreDe(p),
    ci: p.numeroDocumento,
    complemento: p.complementoDocumento,
    correo: p.user?.email ?? p.correo,
    tieneCuenta: !!p.userId,
    asignaciones: p.asignaciones.map((a) => ({
      id: a.id,
      tipo: a.tipo,
      desde: a.desde,
      hasta: a.hasta,
      puesto: a.puesto,
    })),
  }));
}

export async function fichaPersona(db: Client, id: string, fecha: Date) {
  const p = await db.personalData.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, email: true } },
      asignaciones: {
        include: {
          puesto: { select: puestoSelect },
          movimientoInicio: {
            select: {
              documento: true,
              tipoMovimiento: { select: { nombre: true } },
            },
          },
          movimientoFin: {
            select: {
              documento: true,
              tipoMovimiento: { select: { nombre: true } },
            },
          },
        },
        orderBy: [{ desde: 'desc' }],
      },
      movimientos: {
        include: { tipoMovimiento: { select: { codigo: true, nombre: true } } },
        orderBy: [{ fechaEfectiva: 'desc' }, { createdAt: 'desc' }],
      },
      delegacionesDadas: {
        include: { delegado: true },
        orderBy: { desde: 'desc' },
      },
      delegacionesRecibidas: {
        include: { delegante: true },
        orderBy: { desde: 'desc' },
      },
    },
  });
  if (!p) throw new ORPCError('NOT_FOUND');

  const jefes = await db.$queryRaw<
    {
      asignacion_id: string;
      jefe_persona_id: string | null;
      por_delegacion: boolean;
    }[]
  >`SELECT asignacion_id, jefe_persona_id, por_delegacion
    FROM movilidad.jefe_inmediato_en_fecha(${id}::uuid, ${fecha}::date)`;
  const jefeIds = jefes.flatMap((j) =>
    j.jefe_persona_id ? [j.jefe_persona_id] : []
  );
  const jefesData = await db.personalData.findMany({
    where: { id: { in: jefeIds } },
    include: {
      asignaciones: {
        where: { ...vigenteEn(fecha), puesto: { esJefatura: true } },
        include: { puesto: { select: puestoSelect } },
      },
    },
  });
  const jefeById = new Map(jefesData.map((j) => [j.id, j]));

  const vigente = (a: { desde: Date; hasta: Date | null }) =>
    a.desde <= fecha && (!a.hasta || a.hasta >= fecha);

  return {
    id: p.id,
    nombre: nombreDe(p),
    datos: {
      nombre: p.nombre,
      primerApellido: p.primerApellido,
      segundoApellido: p.segundoApellido,
      ci: p.numeroDocumento,
      complemento: p.complementoDocumento,
      fechaNacimiento: p.fechaNacimiento,
      genero: p.genero,
      telefono: p.telefono,
      correo: p.correo,
    },
    cuenta: p.user ? { id: p.user.id, email: p.user.email } : null,
    asignaciones: p.asignaciones.map((a) => {
      const jefe = jefes.find((j) => j.asignacion_id === a.id);
      const jefeData = jefe?.jefe_persona_id
        ? jefeById.get(jefe.jefe_persona_id)
        : undefined;
      return {
        id: a.id,
        tipo: a.tipo,
        desde: a.desde,
        hasta: a.hasta,
        vigente: vigente(a),
        observaciones: a.observaciones,
        puesto: a.puesto,
        inicio: a.movimientoInicio
          ? {
              tipo: a.movimientoInicio.tipoMovimiento.nombre,
              documento: a.movimientoInicio.documento,
            }
          : null,
        fin: a.movimientoFin
          ? {
              tipo: a.movimientoFin.tipoMovimiento.nombre,
              documento: a.movimientoFin.documento,
            }
          : null,
        jefe: jefeData
          ? {
              id: jefeData.id,
              nombre: nombreDe(jefeData),
              puesto: jefeData.asignaciones[0]?.puesto.denominacion ?? null,
              porDelegacion: jefe?.por_delegacion ?? false,
            }
          : null,
      };
    }),
    movimientos: p.movimientos.map((m) => ({
      id: m.id,
      tipo: m.tipoMovimiento.nombre,
      fechaEfectiva: m.fechaEfectiva,
      documento: m.documento,
      observaciones: m.observaciones,
    })),
    delegaciones: [
      ...p.delegacionesDadas.map((d) => ({
        id: d.id,
        sentido: 'dada' as const,
        otraPersona: { id: d.delegado.id, nombre: nombreDe(d.delegado) },
        desde: d.desde,
        hasta: d.hasta,
        motivo: d.motivo,
      })),
      ...p.delegacionesRecibidas.map((d) => ({
        id: d.id,
        sentido: 'recibida' as const,
        otraPersona: { id: d.delegante.id, nombre: nombreDe(d.delegante) },
        desde: d.desde,
        hasta: d.hasta,
        motivo: d.motivo,
      })),
    ],
  };
}

// ─── Org chart and posts ─────────────────────────────────────────────────────

export async function organigrama(db: Client, fecha: Date) {
  const [dependencias, jefaturas, conteos, puestos] = await Promise.all([
    db.dependencia.findMany({
      where: {
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
    db.$queryRaw<
      {
        dependencia_id: string;
        persona_id: string;
        tipo: string;
        por_delegacion: boolean;
      }[]
    >`SELECT d.id AS dependencia_id, j.persona_id, j.tipo::text AS tipo, j.por_delegacion
      FROM organizacion.dependencia d
      CROSS JOIN LATERAL movilidad.jefatura_en_fecha(d.id, ${fecha}::date) j`,
    db.$queryRaw<{ dependencia_id: string; personas: number }[]>`
      SELECT dependencia_id, count(DISTINCT persona_id)::int AS personas
      FROM movilidad.asignaciones_en_fecha(${fecha}::date)
      GROUP BY dependencia_id`,
    db.puesto.findMany({
      where: {
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      select: {
        dependenciaId: true,
        asignaciones: { where: vigenteEn(fecha), select: { id: true } },
      },
    }),
  ]);
  const jefes = await db.personalData.findMany({
    where: { id: { in: jefaturas.map((j) => j.persona_id) } },
  });
  const jefeById = new Map(jefes.map((j) => [j.id, j]));
  const personas = new Map(conteos.map((c) => [c.dependencia_id, c.personas]));

  return dependencias.map((d) => {
    const jefatura = jefaturas.find((j) => j.dependencia_id === d.id);
    const jefe = jefatura ? jefeById.get(jefatura.persona_id) : undefined;
    const propios = puestos.filter((p) => p.dependenciaId === d.id);
    return {
      id: d.id,
      codigo: d.codigo,
      sigla: d.sigla,
      nombre: d.nombre,
      nivel: d.nivel,
      padreId: d.padreId,
      jefe: jefe
        ? {
            id: jefe.id,
            nombre: nombreDe(jefe),
            tipo: jefatura!.tipo,
            porDelegacion: jefatura!.por_delegacion,
          }
        : null,
      personas: personas.get(d.id) ?? 0,
      puestos: propios.length,
      vacantes: propios.filter((p) => p.asignaciones.length === 0).length,
    };
  });
}

export async function listarPuestos(
  db: Client,
  {
    dependenciaId,
    fecha,
    soloVacantes,
  }: { dependenciaId?: string; fecha: Date; soloVacantes: boolean }
) {
  const puestos = await db.puesto.findMany({
    where: {
      ...(dependenciaId ? { dependenciaId } : {}),
      vigenteDesde: { lte: fecha },
      OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      ...(soloVacantes ? { asignaciones: { none: vigenteEn(fecha) } } : {}),
    },
    include: {
      dependencia: {
        select: {
          id: true,
          codigo: true,
          sigla: true,
          nombre: true,
          orden: true,
        },
      },
      tipoVinculo: { select: { nombre: true } },
      asignaciones: {
        where: vigenteEn(fecha),
        include: { persona: true },
        orderBy: { desde: 'asc' },
      },
    },
  });
  return [...puestos]
    .sort(
      (a, b) =>
        a.dependencia.orden - b.dependencia.orden ||
        Number(b.esJefatura) - Number(a.esJefatura) ||
        a.codigo.localeCompare(b.codigo, 'es', { numeric: true })
    )
    .map((p) => ({
      id: p.id,
      codigo: p.codigo,
      numero: p.numero,
      denominacion: p.denominacion,
      esJefatura: p.esJefatura,
      vinculo: p.tipoVinculo.nombre,
      vigenteHasta: p.vigenteHasta,
      dependencia: p.dependencia,
      ocupantes: p.asignaciones.map((a) => ({
        personaId: a.personaId,
        nombre: nombreDe(a.persona),
        tipo: a.tipo,
        hasta: a.hasta,
      })),
    }));
}

// ─── Movements ───────────────────────────────────────────────────────────────

const unDiaAntes = (fecha: Date) =>
  new Date(fecha.getTime() - 24 * 60 * 60 * 1000);

/**
 * One HR act: records the movement and, in the same transaction, closes the
 * chosen assignments (their last day is the day before the effective date)
 * and opens a new one from that date. One titular per post at a time is
 * enforced by the database; it is reported as a readable error.
 */
export async function registrarMovimiento(
  db: Client,
  input: {
    personaId: string;
    tipoMovimiento: string;
    fecha: Date;
    documento?: string | null;
    observaciones?: string | null;
    cerrar: string[];
    abrir?: {
      puestoId: string;
      tipo: 'TITULAR' | 'INTERINO' | 'ROTACION' | 'COMISION' | 'SUPLENCIA';
      hasta?: Date | null;
    } | null;
  },
  registradoPorId: string
) {
  if (!input.cerrar.length && !input.abrir) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'El movimiento debe cerrar o abrir al menos una asignación',
    });
  }
  if (input.abrir?.hasta && input.abrir.hasta < input.fecha) {
    throw new ORPCError('BAD_REQUEST', {
      message: 'La nueva asignación termina antes de empezar',
    });
  }
  try {
    return await db.$transaction(async (tx) => {
      const tipo = await tx.tipoMovimiento.findUnique({
        where: { codigo: input.tipoMovimiento },
      });
      if (!tipo)
        throw new ORPCError('BAD_REQUEST', {
          message: 'Tipo de movimiento desconocido',
        });
      const movimiento = await tx.movimiento.create({
        data: {
          personaId: input.personaId,
          tipoMovimientoId: tipo.id,
          fechaEfectiva: input.fecha,
          documento: input.documento || null,
          observaciones: input.observaciones || null,
          registradoPorId,
        },
      });
      const hasta = unDiaAntes(input.fecha);
      for (const id of input.cerrar) {
        const a = await tx.asignacion.findUnique({ where: { id } });
        if (a?.personaId !== input.personaId) throw new ORPCError('NOT_FOUND');
        if (hasta < a.desde) {
          throw new ORPCError('BAD_REQUEST', {
            message:
              'Una asignación que se cierra empezó en la fecha del movimiento o después',
          });
        }
        await tx.asignacion.update({
          where: { id },
          data: { hasta, movimientoFinId: movimiento.id },
        });
      }
      if (input.abrir) {
        await tx.asignacion.create({
          data: {
            personaId: input.personaId,
            puestoId: input.abrir.puestoId,
            tipo: input.abrir.tipo,
            desde: input.fecha,
            hasta: input.abrir.hasta ?? null,
            movimientoInicioId: movimiento.id,
          },
        });
      }
      return { id: movimiento.id };
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError ||
      error instanceof Prisma.PrismaClientUnknownRequestError
    ) {
      const text = String(error.message);
      if (text.includes('asignacion_titular_unico')) {
        throw new ORPCError('BAD_REQUEST', {
          message:
            'Ese puesto ya tiene titular en esas fechas: primero hay que cerrar esa titularidad',
        });
      }
      if (
        text.includes('asignacion_persona_id_puesto_id_desde_key') ||
        (error as { code?: string }).code === 'P2002'
      ) {
        throw new ORPCError('BAD_REQUEST', {
          message:
            'La persona ya tiene una asignación en ese puesto desde esa fecha',
        });
      }
    }
    throw error;
  }
}

// ─── Delegations ─────────────────────────────────────────────────────────────

export async function listarDelegaciones(
  db: Client,
  { fecha, todas }: { fecha: Date; todas: boolean }
) {
  const delegaciones = await db.delegacion.findMany({
    where: todas ? {} : vigenteEn(fecha),
    include: { delegante: true, delegado: true },
    orderBy: { desde: 'desc' },
    take: 500,
  });
  return delegaciones.map((d) => ({
    id: d.id,
    delegante: { id: d.delegante.id, nombre: nombreDe(d.delegante) },
    delegado: { id: d.delegado.id, nombre: nombreDe(d.delegado) },
    desde: d.desde,
    hasta: d.hasta,
    motivo: d.motivo,
    documento: d.documento,
    vigente: d.desde <= fecha && (!d.hasta || d.hasta >= fecha),
  }));
}

/** Choices for the forms: movement types and posts in force */
export async function opciones(db: Client) {
  const fecha = hoy();
  const [tipos, puestos, dependencias] = await Promise.all([
    db.tipoMovimiento.findMany({
      where: { activo: true },
      orderBy: { orden: 'asc' },
    }),
    db.puesto.findMany({
      where: {
        vigenteDesde: { lte: fecha },
        OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }],
      },
      select: {
        id: true,
        codigo: true,
        denominacion: true,
        dependencia: { select: { sigla: true, codigo: true } },
      },
      orderBy: { codigo: 'asc' },
    }),
    db.dependencia.findMany({
      where: { OR: [{ vigenteHasta: null }, { vigenteHasta: { gte: fecha } }] },
      select: { id: true, codigo: true, sigla: true, nombre: true },
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
    }),
  ]);
  return {
    tiposMovimiento: tipos.map((t) => ({ codigo: t.codigo, nombre: t.nombre })),
    puestos: [...puestos]
      .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        denominacion: p.denominacion,
        dependencia: p.dependencia.sigla ?? p.dependencia.codigo,
      })),
    dependencias,
  };
}
