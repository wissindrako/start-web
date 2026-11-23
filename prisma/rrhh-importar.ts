/**
 * Imports RR.HH.'s spreadsheet (people, org chart, posts and mobility) from
 * the command line. Same logic as the "Importar planilla" screen.
 *
 *   pnpm rrhh:importar <planilla.xlsx>            shows what would change
 *   pnpm rrhh:importar <planilla.xlsx> --aplicar  saves it (all or nothing)
 *
 * Format: docs/rrhh.md. The spreadsheet has personal data: keep it out of
 * any repository.
 */
import { readFileSync } from 'node:fs';

import { db } from '@/server/db';
import { importarPlanilla } from '@/server/rrhh/importar';
import { type Issue, leerPlanilla } from '@/server/rrhh/planilla';

const args = process.argv.slice(2);
// run-jiti passes this script's own path among the arguments: take the .xlsx
const file = args.find((arg) => /\.xlsx$/i.test(arg));
const aplicar = args.includes('--aplicar');

const print = (title: string, issues: Issue[]) => {
  if (!issues.length) return;
  console.log(`\n${title} (${issues.length}):`);
  for (const i of issues) {
    console.log(
      `  · ${i.hoja}${i.fila ? ` fila ${i.fila}` : ''}: ${i.mensaje}`
    );
  }
};

const main = async () => {
  if (!file) {
    console.log('Uso: pnpm rrhh:importar <planilla.xlsx> [--aplicar]');
    process.exitCode = 1;
    return;
  }
  const { planilla, errores, avisos } = await leerPlanilla(readFileSync(file));
  const result = await importarPlanilla(db, planilla, {
    aplicar: aplicar && errores.length === 0,
  });
  const allErrors = [...errores, ...result.errores];

  console.log('\nResumen (nuevas · cambian · iguales):');
  for (const [hoja, c] of Object.entries(result.resumen)) {
    console.log(
      `  ${hoja.padEnd(13)} ${String(c.nuevas).padStart(4)} · ${String(c.cambian).padStart(4)} · ${String(c.iguales).padStart(4)}`
    );
  }
  print('Errores', allErrors);
  print('Avisos', [...avisos, ...result.avisos]);

  if (allErrors.length) {
    console.log(
      '\n✖ Hay errores: no se guardó nada. Corregir la planilla y volver a correr.'
    );
    process.exitCode = 1;
  } else if (result.aplicado) {
    console.log('\n✔ Planilla importada.');
  } else {
    console.log(
      '\nNada se guardó todavía. Si está bien, repetir con --aplicar.'
    );
  }
};

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
