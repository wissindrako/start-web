/**
 * Reads and checks RR.HH.'s spreadsheet (one sheet per table, linked by keys:
 * dependency code, post code and C.I.). Pure: it never touches the database;
 * src/server/rrhh/importar.ts compares the result with it and saves it.
 * Format: docs/rrhh.md ("Planilla").
 */
import ExcelJS from 'exceljs';

export type Issue = { hoja: string; fila: number; mensaje: string };

export type Nivel = 'DIRECCION' | 'UNIDAD' | 'AREA';
export type TipoAsignacion =
  | 'TITULAR'
  | 'INTERINO'
  | 'ROTACION'
  | 'COMISION'
  | 'SUPLENCIA';

export type DependenciaRow = {
  fila: number;
  codigo: string;
  sigla: string | null;
  nombre: string;
  nivel: Nivel;
  padre: string | null;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
  orden: number;
  observaciones: string | null;
};
export type PuestoRow = {
  fila: number;
  codigo: string;
  tipoVinculo: string; // parametrica.tipo_vinculo.codigo
  numero: string | null;
  denominacion: string;
  dependencia: string;
  esJefatura: boolean;
  vigenteDesde: Date;
  vigenteHasta: Date | null;
  observaciones: string | null;
};
export type PersonaRow = {
  fila: number;
  ci: string;
  complemento: string | null;
  nombre: string;
  primerApellido: string;
  segundoApellido: string | null;
  fechaNacimiento: Date | null;
  genero: 'M' | 'F' | null;
  telefono: string | null;
  correo: string | null;
};
export type AsignacionRow = {
  fila: number;
  ci: string;
  puesto: string;
  tipo: TipoAsignacion;
  desde: Date;
  hasta: Date | null;
  tipoMovimiento: string | null; // parametrica.tipo_movimiento.codigo
  documento: string | null;
  observaciones: string | null;
};
export type DelegacionRow = {
  fila: number;
  ciDelegante: string;
  ciDelegado: string;
  desde: Date;
  hasta: Date | null;
  motivo: string | null;
  documento: string | null;
};

export type Planilla = {
  dependencias: DependenciaRow[];
  puestos: PuestoRow[];
  personas: PersonaRow[];
  asignaciones: AsignacionRow[];
  delegaciones: DelegacionRow[];
};

// Labels of the drop-down lists → codes in the database
const NIVELES: Record<string, Nivel> = {
  direccion: 'DIRECCION',
  unidad: 'UNIDAD',
  area: 'AREA',
};
export const VINCULOS: Record<string, string> = {
  'item de planta': 'ITEM',
  item: 'ITEM',
  eventual: 'EVENTUAL',
  consultor: 'CONSULTOR',
};
const TIPOS: Record<string, TipoAsignacion> = {
  titular: 'TITULAR',
  interino: 'INTERINO',
  interina: 'INTERINO',
  rotacion: 'ROTACION',
  comision: 'COMISION',
  suplencia: 'SUPLENCIA',
};
export const MOVIMIENTOS: Record<string, string> = {
  alta: 'ALTA',
  designacion: 'DESIGNACION',
  interinato: 'INTERINATO',
  rotacion: 'ROTACION',
  comision: 'COMISION',
  suplencia: 'SUPLENCIA',
  conclusion: 'CONCLUSION',
  baja: 'BAJA',
};

/** Lowercase, no accents, single spaces: to match labels and headers */
export const key = (value: string) =>
  value
    .normalize('NFD')
    .replaceAll(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replaceAll(/\s+/g, ' ')
    .trim();

type Cell = string | number | boolean | Date | null;

/** Plain value of an exceljs cell (formulas give their result) */
const plain = (value: ExcelJS.CellValue): Cell => {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value === 'object') {
    if ('result' in value) return plain(value.result as ExcelJS.CellValue);
    if ('richText' in value)
      return value.richText.map((part) => part.text).join('');
    if ('text' in value) return String(value.text);
    return null;
  }
  return value;
};

type Row = { fila: number; get: (header: string) => Cell };

/** Rows of a sheet, read by header (without the trailing "*" of required ones) */
const rowsOf = (workbook: ExcelJS.Workbook, name: string): Row[] | null => {
  const sheet = workbook.getWorksheet(name);
  if (!sheet) return null;
  const headers = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, column) => {
    const text = plain(cell.value);
    if (typeof text === 'string')
      headers.set(key(text.replace(/\*$/, '')), column);
  });
  const rows: Row[] = [];
  sheet.eachRow((row, fila) => {
    if (fila === 1) return;
    const values = row.values as ExcelJS.CellValue[];
    const get = (header: string) => {
      const column = headers.get(key(header));
      if (!column) return null;
      const value = plain(values[column]);
      if (typeof value === 'string') {
        const text = value.replaceAll(/\s+/g, ' ').trim();
        return text === '' ? null : text;
      }
      return value;
    };
    // Rows with nothing in them (formatting only) are not rows
    if ([...headers.keys()].every((header) => get(header) === null)) return;
    rows.push({ fila, get });
  });
  return rows;
};

const SHEETS = [
  'Dependencias',
  'Puestos',
  'Personas',
  'Asignaciones',
  'Delegaciones',
] as const;

/**
 * Day-only date (UTC midnight): what a @db.Date column stores. exceljs gives
 * Excel dates as UTC midnight already; reading them in local time would move
 * them to the day before in Bolivia (UTC-4).
 */
const day = (date: Date) =>
  new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
  );

/**
 * Reads the workbook and checks each row on its own and across sheets
 * (keys, references, dates, one titular per post at a time). Rows with an
 * error are left out of the result.
 */
export async function leerPlanilla(
  data: ArrayBuffer | Buffer
): Promise<{ planilla: Planilla; errores: Issue[]; avisos: Issue[] }> {
  const workbook = new ExcelJS.Workbook();
  // A plain ArrayBuffer: a Node Buffer is a view into a larger shared one,
  // and the zip reader exceljs bundles reads all of it
  const bytes =
    data instanceof ArrayBuffer
      ? data
      : data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
  await workbook.xlsx.load(bytes as ArrayBuffer);
  const errores: Issue[] = [];
  const avisos: Issue[] = [];
  const planilla: Planilla = {
    dependencias: [],
    puestos: [],
    personas: [],
    asignaciones: [],
    delegaciones: [],
  };

  const sheets = Object.fromEntries(
    SHEETS.map((name) => [name, rowsOf(workbook, name)])
  ) as Record<(typeof SHEETS)[number], Row[] | null>;
  for (const name of SHEETS) {
    if (!sheets[name] && name !== 'Delegaciones') {
      errores.push({ hoja: name, fila: 0, mensaje: 'Falta la hoja' });
    }
  }

  // Helpers bound to one row: they record the problem and return null
  const reader = (hoja: string, row: Row) => {
    let ok = true;
    const fail = (mensaje: string) => {
      errores.push({ hoja, fila: row.fila, mensaje });
      ok = false;
      return null;
    };
    const text = (header: string, required = false) => {
      const value = row.get(header);
      if (value === null || value === undefined) {
        return required ? fail(`Falta "${header}"`) : null;
      }
      return value instanceof Date
        ? value.toISOString().slice(0, 10)
        : String(value);
    };
    const date = (header: string, required = false) => {
      const value = row.get(header);
      if (value === null) {
        return required ? fail(`Falta "${header}"`) : null;
      }
      if (value instanceof Date) return day(value);
      const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(value));
      if (match) {
        return new Date(
          Date.UTC(Number(match[3]), Number(match[2]) - 1, Number(match[1]))
        );
      }
      return fail(`"${header}" no es una fecha (${String(value)})`);
    };
    const option = <T>(
      header: string,
      options: Record<string, T>,
      required = false
    ): T | null => {
      const value = text(header, required);
      if (value === null) return null;
      const found = options[key(value)];
      return found ?? fail(`"${header}": valor no válido (${value})`);
    };
    const yes = (header: string) => {
      const value = text(header, true);
      if (value === null) return false;
      if (['si', 'sí', 'yes'].includes(key(value))) return true;
      if (key(value) === 'no') return false;
      fail(`"${header}" debe ser Sí o No (${value})`);
      return false;
    };
    const range = (desde: Date | null, hasta: Date | null, labels: string) => {
      if (desde && hasta && hasta < desde)
        fail(`${labels}: termina antes de empezar`);
    };
    return { text, date, option, yes, range, fail, ok: () => ok };
  };

  // Dependencias
  for (const row of sheets.Dependencias ?? []) {
    const r = reader('Dependencias', row);
    const record = {
      fila: row.fila,
      codigo: r.text('Código', true),
      sigla: r.text('Sigla'),
      nombre: r.text('Nombre', true),
      nivel: r.option('Nivel', NIVELES, true),
      padre: r.text('Depende de (código)'),
      vigenteDesde: r.date('Vigente desde', true),
      vigenteHasta: r.date('Vigente hasta'),
      orden: Number(r.text('Orden') ?? 0) || 0,
      observaciones: r.text('Observaciones'),
    };
    r.range(record.vigenteDesde, record.vigenteHasta, 'Vigencia');
    if (r.ok()) planilla.dependencias.push(record as DependenciaRow);
  }

  // Puestos
  for (const row of sheets.Puestos ?? []) {
    const r = reader('Puestos', row);
    const record = {
      fila: row.fila,
      codigo: r.text('Código de puesto', true),
      tipoVinculo: r.option('Tipo de vínculo', VINCULOS, true),
      numero: r.text('N° ítem o contrato'),
      denominacion: r.text('Denominación', true),
      dependencia: r.text('Código de dependencia', true),
      esJefatura: r.yes('¿Jefatura?'),
      vigenteDesde: r.date('Vigente desde', true),
      vigenteHasta: r.date('Vigente hasta'),
      observaciones: r.text('Observaciones'),
    };
    r.range(record.vigenteDesde, record.vigenteHasta, 'Vigencia');
    if (record.denominacion && key(record.denominacion) === 'por definir') {
      avisos.push({
        hoja: 'Puestos',
        fila: row.fila,
        mensaje: `${record.codigo}: denominación "POR DEFINIR" (ítem vacante sin completar)`,
      });
    }
    if (r.ok()) planilla.puestos.push(record as PuestoRow);
  }

  // Personas
  for (const row of sheets.Personas ?? []) {
    const r = reader('Personas', row);
    const ci = r.text('C.I.', true);
    const record = {
      fila: row.fila,
      ci: ci?.replaceAll(/\D/g, '') ?? null,
      complemento: r.text('Complemento / expedido'),
      nombre: r.text('Nombres', true),
      primerApellido: r.text('Primer apellido', true),
      segundoApellido: r.text('Segundo apellido'),
      fechaNacimiento: r.date('Fecha de nacimiento'),
      genero: r.option('Género', { m: 'M' as const, f: 'F' as const }),
      telefono: r.text('Celular'),
      correo: r.text('Correo institucional')?.toLowerCase() ?? null,
    };
    if (ci && !record.ci) r.fail(`C.I. sin números (${ci})`);
    if (record.correo && !esCorreo(record.correo)) {
      r.fail(`Correo no válido (${record.correo})`);
    }
    if (r.ok()) planilla.personas.push(record as PersonaRow);
  }

  // Asignaciones
  for (const row of sheets.Asignaciones ?? []) {
    const r = reader('Asignaciones', row);
    const record = {
      fila: row.fila,
      ci: r.text('C.I.', true)?.replaceAll(/\D/g, '') ?? null,
      puesto: r.text('Código de puesto', true),
      tipo: r.option('Tipo', TIPOS, true),
      desde: r.date('Desde', true),
      hasta: r.date('Hasta'),
      tipoMovimiento: r.option('Tipo de movimiento', MOVIMIENTOS),
      documento: r.text('Documento'),
      observaciones: r.text('Observaciones'),
    };
    r.range(record.desde, record.hasta, 'Asignación');
    if (r.ok()) planilla.asignaciones.push(record as AsignacionRow);
  }

  // Delegaciones
  for (const row of sheets.Delegaciones ?? []) {
    const r = reader('Delegaciones', row);
    const record = {
      fila: row.fila,
      ciDelegante:
        r.text('C.I. de quien delega', true)?.replaceAll(/\D/g, '') ?? null,
      ciDelegado:
        r.text('C.I. de quien la recibe', true)?.replaceAll(/\D/g, '') ?? null,
      desde: r.date('Desde', true),
      hasta: r.date('Hasta'),
      motivo: r.text('Motivo'),
      documento: r.text('Documento'),
    };
    r.range(record.desde, record.hasta, 'Delegación');
    if (record.ciDelegante && record.ciDelegante === record.ciDelegado) {
      r.fail('Una persona no se delega a sí misma');
    }
    if (r.ok()) planilla.delegaciones.push(record as DelegacionRow);
  }

  cruzar(planilla, errores);
  return { planilla, errores, avisos };
}

/** Checks across sheets: duplicated keys, references, overlapping titulars */
function cruzar(planilla: Planilla, errores: Issue[]) {
  const unique = <T extends { fila: number }>(
    hoja: string,
    rows: T[],
    keyOf: (row: T) => string,
    label: (row: T) => string
  ) => {
    const seen = new Map<string, number>();
    return rows.filter((row) => {
      const k = keyOf(row);
      const first = seen.get(k);
      if (first !== undefined) {
        errores.push({
          hoja,
          fila: row.fila,
          mensaje: `${label(row)} repetido (ya está en la fila ${first})`,
        });
        return false;
      }
      seen.set(k, row.fila);
      return true;
    });
  };
  planilla.dependencias = unique(
    'Dependencias',
    planilla.dependencias,
    (d) => d.codigo,
    (d) => `Código ${d.codigo}`
  );
  planilla.puestos = unique(
    'Puestos',
    planilla.puestos,
    (p) => p.codigo,
    (p) => `Código de puesto ${p.codigo}`
  );
  planilla.personas = unique(
    'Personas',
    planilla.personas,
    (p) => p.ci,
    (p) => `C.I. ${p.ci}`
  );
  planilla.asignaciones = unique(
    'Asignaciones',
    planilla.asignaciones,
    (a) => `${a.ci}|${a.puesto}|${a.desde.toISOString()}`,
    (a) => `Asignación de ${a.ci} en ${a.puesto} desde ${fecha(a.desde)}`
  );

  const deps = new Set(planilla.dependencias.map((d) => d.codigo));
  planilla.dependencias = planilla.dependencias.filter((d) => {
    if (d.padre && !deps.has(d.padre)) {
      errores.push({
        hoja: 'Dependencias',
        fila: d.fila,
        mensaje: `"Depende de" ${d.padre}: no existe esa dependencia`,
      });
      return false;
    }
    return true;
  });
  // The tree must not loop (A → B → A)
  const parent = new Map(planilla.dependencias.map((d) => [d.codigo, d.padre]));
  for (const d of planilla.dependencias) {
    const visited = new Set<string>();
    let current: string | null | undefined = d.codigo;
    while (current) {
      if (visited.has(current)) {
        errores.push({
          hoja: 'Dependencias',
          fila: d.fila,
          mensaje: `${d.codigo}: el organigrama da una vuelta (depende de sí misma)`,
        });
        break;
      }
      visited.add(current);
      current = parent.get(current);
    }
  }

  const depCodes = new Set(planilla.dependencias.map((d) => d.codigo));
  planilla.puestos = planilla.puestos.filter((p) => {
    if (!depCodes.has(p.dependencia)) {
      errores.push({
        hoja: 'Puestos',
        fila: p.fila,
        mensaje: `${p.codigo}: la dependencia ${p.dependencia} no está en la hoja Dependencias`,
      });
      return false;
    }
    return true;
  });

  const posts = new Set(planilla.puestos.map((p) => p.codigo));
  const people = new Set(planilla.personas.map((p) => p.ci));
  planilla.asignaciones = planilla.asignaciones.filter((a) => {
    const problems = [
      !people.has(a.ci) && `el C.I. ${a.ci} no está en la hoja Personas`,
      !posts.has(a.puesto) &&
        `el puesto ${a.puesto} no está en la hoja Puestos`,
    ].filter(Boolean);
    for (const mensaje of problems) {
      errores.push({
        hoja: 'Asignaciones',
        fila: a.fila,
        mensaje: String(mensaje),
      });
    }
    return problems.length === 0;
  });
  planilla.delegaciones = planilla.delegaciones.filter((d) => {
    const missing = [d.ciDelegante, d.ciDelegado].filter(
      (ci) => !people.has(ci)
    );
    for (const ci of missing) {
      errores.push({
        hoja: 'Delegaciones',
        fila: d.fila,
        mensaje: `el C.I. ${ci} no está en la hoja Personas`,
      });
    }
    return missing.length === 0;
  });

  // One titular per post at a time (the database refuses it too)
  const titulars = new Map<string, AsignacionRow[]>();
  for (const a of planilla.asignaciones.filter((x) => x.tipo === 'TITULAR')) {
    titulars.set(a.puesto, [...(titulars.get(a.puesto) ?? []), a]);
  }
  const overlapping = new Set<AsignacionRow>();
  for (const list of titulars.values()) {
    for (const [i, a] of list.entries()) {
      for (const b of list.slice(i + 1)) {
        if (seSuperponen(a, b)) {
          overlapping.add(b);
          errores.push({
            hoja: 'Asignaciones',
            fila: b.fila,
            mensaje: `${b.puesto}: ya tiene titular en esas fechas (fila ${a.fila})`,
          });
        }
      }
    }
  }
  planilla.asignaciones = planilla.asignaciones.filter(
    (a) => !overlapping.has(a)
  );
}

/** name@domain.tld, without spaces (no regex: kept simple on purpose) */
const esCorreo = (value: string) => {
  const [user, domain, ...rest] = value.split('@');
  return (
    rest.length === 0 &&
    !!user &&
    !!domain &&
    domain.includes('.') &&
    !domain.startsWith('.') &&
    !domain.endsWith('.') &&
    !/\s/.test(value)
  );
};

/** Two periods share a day (hasta inclusive; null = open) */
export const seSuperponen = (
  a: { desde: Date; hasta: Date | null },
  b: { desde: Date; hasta: Date | null }
) =>
  (a.hasta === null || a.hasta >= b.desde) &&
  (b.hasta === null || b.hasta >= a.desde);

export const fecha = (date: Date) =>
  date.toISOString().slice(0, 10).split('-').reverse().join('/');
