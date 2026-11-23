-- Keys RR.HH.'s spreadsheet imports by (pnpm rrhh:importar): the post code, the
-- C.I. of the person, and person + post + start for assignments (and the same
-- for delegations), so importing twice never duplicates anything; and the
-- institutional email that links a person to their account.
-- puesto is still empty when this runs (no rows to fill the new column).


-- DropIndex
DROP INDEX "movilidad"."asignacion_persona_id_desde_idx";

-- DropIndex
DROP INDEX "movilidad"."delegacion_delegante_persona_id_desde_idx";

-- AlterTable
ALTER TABLE "organizacion"."puesto" ADD COLUMN     "codigo" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "personal"."persona" ADD COLUMN     "complementoDocumento" TEXT,
ADD COLUMN     "correo" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "asignacion_persona_id_puesto_id_desde_key" ON "movilidad"."asignacion"("persona_id", "puesto_id", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "delegacion_delegante_persona_id_delegado_persona_id_desde_key" ON "movilidad"."delegacion"("delegante_persona_id", "delegado_persona_id", "desde");

-- CreateIndex
CREATE UNIQUE INDEX "puesto_codigo_key" ON "organizacion"."puesto"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "persona_numeroDocumento_key" ON "personal"."persona"("numeroDocumento");

