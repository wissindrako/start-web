import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { leerPlanilla } from './planilla';

const HEADERS = {
  Dependencias: [
    'Código*',
    'Sigla',
    'Nombre*',
    'Nivel*',
    'Depende de (código)',
    'Vigente desde*',
    'Vigente hasta',
    'Orden',
    'Observaciones',
  ],
  Puestos: [
    'Código de puesto*',
    'Tipo de vínculo*',
    'N° ítem o contrato',
    'Denominación*',
    'Código de dependencia*',
    '¿Jefatura?*',
    'Vigente desde*',
    'Vigente hasta',
    'Observaciones',
  ],
  Personas: [
    'C.I.*',
    'Complemento / expedido',
    'Nombres*',
    'Primer apellido*',
    'Segundo apellido',
    'Fecha de nacimiento',
    'Género',
    'Celular',
    'Correo institucional',
  ],
  Asignaciones: [
    'C.I.*',
    'Código de puesto*',
    'Tipo*',
    'Desde*',
    'Hasta',
    'Tipo de movimiento',
    'Documento',
    'Observaciones',
  ],
  Delegaciones: [
    'C.I. de quien delega*',
    'C.I. de quien la recibe*',
    'Desde*',
    'Hasta',
    'Motivo',
    'Documento',
  ],
};

type Sheets = Record<keyof typeof HEADERS, (string | number | Date | null)[][]>;

const d = (text: string) => new Date(`${text}T00:00:00Z`);

/** A valid workbook: DGE → UAF, two posts, two people, two assignments */
const base = (): Sheets => ({
  Dependencias: [
    [
      'DGE',
      'DGE',
      'Dirección General Ejecutiva',
      'Dirección',
      null,
      d('2026-01-01'),
    ],
    [
      'UAF',
      'UAF',
      'Unidad Administrativa y Financiera',
      'Unidad',
      'DGE',
      d('2026-01-01'),
    ],
  ],
  Puestos: [
    [
      'IT-001',
      'Ítem de planta',
      '1',
      'Director General Ejecutivo',
      'DGE',
      'Sí',
      d('2026-01-01'),
    ],
    [
      'IT-026',
      'Ítem de planta',
      '26',
      'Jefe de Unidad',
      'UAF',
      'Sí',
      d('2026-01-01'),
    ],
  ],
  Personas: [
    [
      '1234567',
      null,
      'Ana',
      'Prueba',
      null,
      null,
      'F',
      null,
      'ana@entidad.test',
    ],
    ['7654321', '1B', 'Beto', 'Prueba', 'Uno', null, 'M'],
  ],
  Asignaciones: [
    ['1234567', 'IT-001', 'Titular', d('2026-01-01')],
    [
      '7654321',
      'IT-026',
      'Titular',
      '15/02/2026',
      null,
      'Designación',
      'Memo 1/2026',
    ],
  ],
  Delegaciones: [],
});

const workbook = async (sheets: Sheets) => {
  const wb = new ExcelJS.Workbook();
  for (const [name, headers] of Object.entries(HEADERS)) {
    const ws = wb.addWorksheet(name);
    ws.addRow(headers);
    for (const row of sheets[name as keyof Sheets]) ws.addRow(row);
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
};

const read = async (change?: (sheets: Sheets) => void) => {
  const sheets = base();
  change?.(sheets);
  return leerPlanilla(await workbook(sheets));
};

describe('leerPlanilla', () => {
  it('reads a valid workbook into typed rows', async () => {
    const { planilla, errores } = await read();
    expect(errores).toEqual([]);
    expect(
      planilla.dependencias.map((x) => [x.codigo, x.nivel, x.padre])
    ).toEqual([
      ['DGE', 'DIRECCION', null],
      ['UAF', 'UNIDAD', 'DGE'],
    ]);
    expect(planilla.puestos[0]).toMatchObject({
      tipoVinculo: 'ITEM',
      esJefatura: true,
    });
    expect(planilla.personas[1]).toMatchObject({
      ci: '7654321',
      complemento: '1B',
      genero: 'M',
    });
    // Excel dates and dd/mm/yyyy text give the same kind of day-only date
    expect(planilla.asignaciones[0]?.desde).toEqual(d('2026-01-01'));
    expect(planilla.asignaciones[1]).toMatchObject({
      tipo: 'TITULAR',
      desde: d('2026-02-15'),
      tipoMovimiento: 'DESIGNACION',
      documento: 'Memo 1/2026',
    });
  });

  it('reports missing required values with sheet and row', async () => {
    const { errores, planilla } = await read((s) => {
      s.Puestos[1]![4] = null; // dependency of IT-026
    });
    expect(errores).toContainEqual({
      hoja: 'Puestos',
      fila: 3,
      mensaje: 'Falta "Código de dependencia"',
    });
    expect(planilla.puestos.map((p) => p.codigo)).toEqual(['IT-001']);
  });

  it('rejects unknown options and invalid dates', async () => {
    const { errores } = await read((s) => {
      s.Dependencias[1]![3] = 'Gerencia';
      s.Asignaciones[0]![3] = '31-02-2026';
    });
    expect(errores.map((e) => e.mensaje)).toEqual(
      expect.arrayContaining([
        '"Nivel": valor no válido (Gerencia)',
        '"Desde" no es una fecha (31-02-2026)',
      ])
    );
  });

  it('checks references across sheets', async () => {
    const { errores } = await read((s) => {
      s.Puestos.push([
        'IT-099',
        'Ítem de planta',
        '99',
        'Técnico',
        'XYZ',
        'No',
        d('2026-01-01'),
      ]);
      s.Asignaciones.push(['9999999', 'IT-001', 'Interino', d('2026-03-01')]);
    });
    expect(errores.map((e) => e.mensaje)).toEqual(
      expect.arrayContaining([
        'IT-099: la dependencia XYZ no está en la hoja Dependencias',
        'el C.I. 9999999 no está en la hoja Personas',
      ])
    );
  });

  it('refuses two titulars of the same post at the same time, but not an interim', async () => {
    const { errores, planilla } = await read((s) => {
      s.Asignaciones.push(['7654321', 'IT-001', 'Titular', d('2026-06-01')]);
      s.Asignaciones.push([
        '7654321',
        'IT-001',
        'Interino',
        d('2026-07-01'),
        d('2026-07-31'),
      ]);
    });
    expect(errores).toEqual([
      {
        hoja: 'Asignaciones',
        fila: 4,
        mensaje: 'IT-001: ya tiene titular en esas fechas (fila 2)',
      },
    ]);
    expect(planilla.asignaciones.map((a) => a.tipo)).toEqual([
      'TITULAR',
      'TITULAR',
      'INTERINO',
    ]);
  });

  it('accepts consecutive titulars when the first one ends the day before', async () => {
    const { errores } = await read((s) => {
      s.Asignaciones[0]![4] = d('2026-05-31');
      s.Asignaciones.push(['7654321', 'IT-001', 'Titular', d('2026-06-01')]);
    });
    expect(errores).toEqual([]);
  });

  it('reports duplicated keys and loops in the org chart', async () => {
    const { errores } = await read((s) => {
      s.Personas.push(['1234567', null, 'Otra', 'Persona']);
      s.Dependencias[0]![4] = 'UAF'; // DGE depends on UAF, which depends on DGE
    });
    expect(errores.map((e) => e.mensaje)).toEqual(
      expect.arrayContaining([
        'C.I. 1234567 repetido (ya está en la fila 2)',
        'DGE: el organigrama da una vuelta (depende de sí misma)',
      ])
    );
  });

  it('rejects an end before the start and a bad email', async () => {
    const { errores } = await read((s) => {
      s.Asignaciones[0]![4] = d('2025-12-31');
      s.Personas[0]![8] = 'ana@entidad';
    });
    expect(errores.map((e) => e.mensaje)).toEqual(
      expect.arrayContaining([
        'Asignación: termina antes de empezar',
        'Correo no válido (ana@entidad)',
      ])
    );
  });

  it('warns about posts still named POR DEFINIR', async () => {
    const { avisos, errores } = await read((s) => {
      s.Puestos.push([
        'IT-030',
        'Ítem de planta',
        '30',
        'POR DEFINIR',
        'UAF',
        'No',
        d('2026-01-01'),
      ]);
    });
    expect(errores).toEqual([]);
    expect(avisos).toHaveLength(1);
  });

  it('reports a missing sheet', async () => {
    const wb = new ExcelJS.Workbook();
    wb.addWorksheet('Dependencias').addRow(HEADERS.Dependencias);
    const { errores } = await leerPlanilla(
      Buffer.from(await wb.xlsx.writeBuffer())
    );
    expect(errores.map((e) => `${e.hoja}: ${e.mensaje}`)).toEqual([
      'Puestos: Falta la hoja',
      'Personas: Falta la hoja',
      'Asignaciones: Falta la hoja',
    ]);
  });
});
