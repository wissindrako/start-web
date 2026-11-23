/**
 * Compares RR.HH.'s spreadsheet (already read and checked by planilla.ts)
 * with the database and, when asked, saves it: all or nothing, in one
 * transaction. Importing the same file twice changes nothing: every row is
 * found by its key (dependency code, post code, C.I., person + post + start).
 *
 * What it never does: delete. A dependency, post, person or assignment that
 * is not in the spreadsheet stays as it is (closing one is done by setting
 * its end date, so the history is kept).
 */
import type { db as Db } from '@/server/db';

import {
  type AsignacionRow,
  fecha,
  type Issue,
  type Planilla,
  seSuperponen,
} from './planilla';

type Client = typeof Db;
type Tx = Parameters<Parameters<Client['$transaction']>[0]>[0];

export type Conteo = { nuevas: number; cambian: number; iguales: number };
export type Resumen = Record<
  'dependencias' | 'puestos' | 'personas' | 'asignaciones' | 'delegaciones',
  Conteo
>;

const conteo = (): Conteo => ({ nuevas: 0, cambian: 0, iguales: 0 });
const time = (date: Date | null | undefined) => date?.getTime() ?? null;
const same = (a: unknown, b: unknown) => {
  if (a instanceof Date || b instanceof Date) {
    return time(a as Date | null) === time(b as Date | null);
  }
  return (a ?? null) === (b ?? null);
};
const changed = (
  current: Record<string, unknown>,
  next: Record<string, unknown>
) => Object.keys(next).some((field) => !same(current[field], next[field]));

export async function importarPlanilla(
  db: Client,
  planilla: Planilla,
  {
    aplicar,
    registradoPorId = null,
  }: { aplicar: boolean; registradoPorId?: string | null }
): Promise<{
  resumen: Resumen;
  errores: Issue[];
  avisos: Issue[];
  aplicado: boolean;
}> {
  const errores: Issue[] = [];
  const avisos: Issue[] = [];
  const resumen: Resumen = {
    dependencias: conteo(),
    puestos: conteo(),
    personas: conteo(),
    asignaciones: conteo(),
    delegaciones: conteo(),
  };

  // ── What is already there ───────────────────────────────────────────────
  const [vinculos, movimientos, dependencias, puestos, personas] =
    await Promise.all([
      db.tipoVinculo.findMany(),
      db.tipoMovimiento.findMany(),
      db.dependencia.findMany(),
      db.puesto.findMany(),
      db.personalData.findMany({
        where: { numeroDocumento: { in: planilla.personas.map((p) => p.ci) } },
      }),
    ]);
  const vinculoId = new Map(vinculos.map((v) => [v.codigo, v.id]));
  const movimientoId = new Map(movimientos.map((m) => [m.codigo, m.id]));
  const depByCode = new Map(dependencias.map((d) => [d.codigo, d]));
  const puestoByCode = new Map(puestos.map((p) => [p.codigo, p]));
  const personaByCi = new Map(personas.map((p) => [p.numeroDocumento!, p]));

  for (const p of planilla.puestos) {
    if (!vinculoId.has(p.tipoVinculo)) {
      errores.push({
        hoja: 'Puestos',
        fila: p.fila,
        mensaje: `Tipo de vínculo ${p.tipoVinculo} no existe en parametrica.tipo_vinculo`,
      });
    }
  }
  for (const a of planilla.asignaciones) {
    if (a.tipoMovimiento && !movimientoId.has(a.tipoMovimiento)) {
      errores.push({
        hoja: 'Asignaciones',
        fila: a.fila,
        mensaje: `Tipo de movimiento ${a.tipoMovimiento} no existe`,
      });
    }
  }

  // Accounts: a person is linked to the account with their institutional email
  const correos = planilla.personas.flatMap((p) =>
    p.correo ? [p.correo] : []
  );
  const users = await db.user.findMany({
    where: { email: { in: correos, mode: 'insensitive' } },
    select: {
      id: true,
      email: true,
      personalData: { select: { numeroDocumento: true } },
    },
  });
  const userByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u]));

  // ── Dependencias ─────────────────────────────────────────────────────────
  for (const d of planilla.dependencias) {
    const current = depByCode.get(d.codigo);
    const next = {
      sigla: d.sigla,
      nombre: d.nombre,
      nivel: d.nivel,
      orden: d.orden,
      vigenteDesde: d.vigenteDesde,
      vigenteHasta: d.vigenteHasta,
      observaciones: d.observaciones,
    };
    const parentChanged =
      current &&
      (current.padreId ?? null) !==
        (d.padre ? (depByCode.get(d.padre)?.id ?? 'new') : null);
    if (!current) resumen.dependencias.nuevas++;
    else if (changed(current, next) || parentChanged)
      resumen.dependencias.cambian++;
    else resumen.dependencias.iguales++;
  }

  // ── Puestos ──────────────────────────────────────────────────────────────
  for (const p of planilla.puestos) {
    const current = puestoByCode.get(p.codigo);
    const next = {
      tipoVinculoId: vinculoId.get(p.tipoVinculo),
      numero: p.numero,
      denominacion: p.denominacion,
      esJefatura: p.esJefatura,
      vigenteDesde: p.vigenteDesde,
      vigenteHasta: p.vigenteHasta,
      observaciones: p.observaciones,
    };
    const depChanged =
      current && current.dependenciaId !== depByCode.get(p.dependencia)?.id;
    if (!current) resumen.puestos.nuevas++;
    else if (changed(current, next) || depChanged) resumen.puestos.cambian++;
    else resumen.puestos.iguales++;
  }

  // ── Personas ─────────────────────────────────────────────────────────────
  const personaData = (p: Planilla['personas'][number]) => ({
    nombre: p.nombre,
    primerApellido: p.primerApellido,
    segundoApellido: p.segundoApellido,
    tipoDocumento: 'CI',
    complementoDocumento: p.complemento,
    fechaNacimiento: p.fechaNacimiento,
    genero: p.genero,
    telefono: p.telefono,
    correo: p.correo,
  });
  const linkUser = new Map<string, string>(); // ci → user id
  for (const p of planilla.personas) {
    const current = personaByCi.get(p.ci);
    if (p.correo) {
      const user = userByEmail.get(p.correo);
      if (!user) {
        avisos.push({
          hoja: 'Personas',
          fila: p.fila,
          mensaje: `Sin cuenta con el correo ${p.correo}: se vinculará cuando exista`,
        });
      } else if (
        user.personalData &&
        user.personalData.numeroDocumento !== p.ci
      ) {
        errores.push({
          hoja: 'Personas',
          fila: p.fila,
          mensaje: `La cuenta ${p.correo} ya está vinculada a otra persona (C.I. ${user.personalData.numeroDocumento ?? 'sin C.I.'})`,
        });
      } else {
        linkUser.set(p.ci, user.id);
      }
    }
    const next = personaData(p);
    const userChanged =
      current && linkUser.has(p.ci) && current.userId !== linkUser.get(p.ci);
    if (!current) resumen.personas.nuevas++;
    else if (changed(current, next) || userChanged) resumen.personas.cambian++;
    else resumen.personas.iguales++;
  }

  // ── Asignaciones ─────────────────────────────────────────────────────────
  const existingAssignments = await db.asignacion.findMany({
    where: {
      puesto: { codigo: { in: planilla.puestos.map((p) => p.codigo) } },
    },
    include: {
      puesto: { select: { codigo: true } },
      persona: { select: { numeroDocumento: true } },
    },
  });
  const assignmentKey = (ci: string, puesto: string, desde: Date) =>
    `${ci}|${puesto}|${desde.getTime()}`;
  const existingByKey = new Map(
    existingAssignments.map((a) => [
      assignmentKey(a.persona.numeroDocumento ?? '', a.puesto.codigo, a.desde),
      a,
    ])
  );
  const inSheet = new Set(
    planilla.asignaciones.map((a) => assignmentKey(a.ci, a.puesto, a.desde))
  );
  for (const a of planilla.asignaciones) {
    const current = existingByKey.get(assignmentKey(a.ci, a.puesto, a.desde));
    const next = {
      tipo: a.tipo,
      hasta: a.hasta,
      observaciones: a.observaciones,
    };
    if (!current) resumen.asignaciones.nuevas++;
    else if (changed(current, next)) resumen.asignaciones.cambian++;
    else resumen.asignaciones.iguales++;
    // A titular already in the database (not in this file) for the same dates
    const clash =
      a.tipo === 'TITULAR' &&
      existingAssignments.find(
        (other) =>
          other.tipo === 'TITULAR' &&
          other.puesto.codigo === a.puesto &&
          !inSheet.has(
            assignmentKey(
              other.persona.numeroDocumento ?? '',
              other.puesto.codigo,
              other.desde
            )
          ) &&
          seSuperponen(a, other)
      );
    if (clash) {
      errores.push({
        hoja: 'Asignaciones',
        fila: a.fila,
        mensaje: `${a.puesto}: ya tiene titular desde el ${fecha(clash.desde)} (C.I. ${clash.persona.numeroDocumento}); cerrar esa asignación primero`,
      });
    }
  }

  // ── Delegaciones ─────────────────────────────────────────────────────────
  const existingDelegations = await db.delegacion.findMany({
    where: {
      delegante: {
        numeroDocumento: {
          in: planilla.delegaciones.map((d) => d.ciDelegante),
        },
      },
    },
    include: {
      delegante: { select: { numeroDocumento: true } },
      delegado: { select: { numeroDocumento: true } },
    },
  });
  const delegationKey = (a: string, b: string, desde: Date) =>
    `${a}|${b}|${desde.getTime()}`;
  const delegationByKey = new Map(
    existingDelegations.map((d) => [
      delegationKey(
        d.delegante.numeroDocumento ?? '',
        d.delegado.numeroDocumento ?? '',
        d.desde
      ),
      d,
    ])
  );
  for (const d of planilla.delegaciones) {
    const current = delegationByKey.get(
      delegationKey(d.ciDelegante, d.ciDelegado, d.desde)
    );
    const next = { hasta: d.hasta, motivo: d.motivo, documento: d.documento };
    if (!current) resumen.delegaciones.nuevas++;
    else if (changed(current, next)) resumen.delegaciones.cambian++;
    else resumen.delegaciones.iguales++;
  }

  if (!aplicar || errores.length > 0) {
    return { resumen, errores, avisos, aplicado: false };
  }

  // ── Save: all or nothing ─────────────────────────────────────────────────
  await db.$transaction(
    async (tx) => {
      const depId = await guardarDependencias(tx, planilla);
      const puestoId = new Map<string, string>();
      for (const p of planilla.puestos) {
        const data = {
          dependenciaId: depId.get(p.dependencia)!,
          tipoVinculoId: vinculoId.get(p.tipoVinculo)!,
          numero: p.numero,
          denominacion: p.denominacion,
          esJefatura: p.esJefatura,
          vigenteDesde: p.vigenteDesde,
          vigenteHasta: p.vigenteHasta,
          observaciones: p.observaciones,
        };
        const saved = await tx.puesto.upsert({
          where: { codigo: p.codigo },
          create: { codigo: p.codigo, ...data },
          update: data,
        });
        puestoId.set(p.codigo, saved.id);
      }

      const personaId = new Map<string, string>();
      for (const p of planilla.personas) {
        const data = {
          ...personaData(p),
          ...(linkUser.has(p.ci) ? { userId: linkUser.get(p.ci) } : {}),
        };
        const saved = await tx.personalData.upsert({
          where: { numeroDocumento: p.ci },
          create: { numeroDocumento: p.ci, ...data },
          update: data,
        });
        personaId.set(p.ci, saved.id);
      }

      for (const a of planilla.asignaciones) {
        await guardarAsignacion(tx, a, {
          personaId: personaId.get(a.ci)!,
          puestoId: puestoId.get(a.puesto)!,
          movimientoId,
          registradoPorId,
        });
      }

      for (const d of planilla.delegaciones) {
        const ids = {
          delegantePersonaId: personaId.get(d.ciDelegante)!,
          delegadoPersonaId: personaId.get(d.ciDelegado)!,
        };
        const data = {
          hasta: d.hasta,
          motivo: d.motivo,
          documento: d.documento,
        };
        await tx.delegacion.upsert({
          where: {
            delegantePersonaId_delegadoPersonaId_desde: {
              ...ids,
              desde: d.desde,
            },
          },
          create: { ...ids, desde: d.desde, ...data },
          update: data,
        });
      }
    },
    { timeout: 5 * 60 * 1000, maxWait: 30_000 }
  );

  return { resumen, errores, avisos, aplicado: true };
}

/** Dependencies in two passes: rows first, then who each one depends on */
async function guardarDependencias(tx: Tx, planilla: Planilla) {
  const ids = new Map<string, string>();
  for (const d of planilla.dependencias) {
    const data = {
      sigla: d.sigla,
      nombre: d.nombre,
      nivel: d.nivel,
      orden: d.orden,
      vigenteDesde: d.vigenteDesde,
      vigenteHasta: d.vigenteHasta,
      observaciones: d.observaciones,
    };
    const saved = await tx.dependencia.upsert({
      where: { codigo: d.codigo },
      create: { codigo: d.codigo, ...data },
      update: data,
    });
    ids.set(d.codigo, saved.id);
  }
  for (const d of planilla.dependencias) {
    await tx.dependencia.update({
      where: { codigo: d.codigo },
      data: { padreId: d.padre ? ids.get(d.padre)! : null },
    });
  }
  return ids;
}

/** HR act assumed for a new assignment when the file does not say one */
const MOVIMIENTO_POR_TIPO: Record<AsignacionRow['tipo'], string> = {
  TITULAR: 'DESIGNACION',
  INTERINO: 'INTERINATO',
  ROTACION: 'ROTACION',
  COMISION: 'COMISION',
  SUPLENCIA: 'SUPLENCIA',
};

/**
 * A new assignment also records the HR act behind it (movimiento); an
 * existing one only takes the end date, type and notes from the file.
 */
async function guardarAsignacion(
  tx: Tx,
  a: AsignacionRow,
  {
    personaId,
    puestoId,
    movimientoId,
    registradoPorId,
  }: {
    personaId: string;
    puestoId: string;
    movimientoId: Map<string, string>;
    registradoPorId: string | null;
  }
) {
  const where = {
    personaId_puestoId_desde: { personaId, puestoId, desde: a.desde },
  };
  const existing = await tx.asignacion.findUnique({ where });
  const data = { tipo: a.tipo, hasta: a.hasta, observaciones: a.observaciones };
  if (existing) {
    await tx.asignacion.update({ where, data });
    return;
  }
  const tipoMovimientoId = movimientoId.get(
    a.tipoMovimiento ?? MOVIMIENTO_POR_TIPO[a.tipo]
  );
  const movimiento = tipoMovimientoId
    ? await tx.movimiento.create({
        data: {
          personaId,
          tipoMovimientoId,
          fechaEfectiva: a.desde,
          documento: a.documento,
          observaciones: 'Cargado desde la planilla de RR.HH.',
          registradoPorId,
        },
      })
    : null;
  await tx.asignacion.create({
    data: {
      personaId,
      puestoId,
      desde: a.desde,
      ...data,
      movimientoInicioId: movimiento?.id ?? null,
    },
  });
}
