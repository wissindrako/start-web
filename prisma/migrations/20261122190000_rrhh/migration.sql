-- Human resources: schemas personal, organizacion, movilidad and parametrica
-- (CLAUDE.md "Decisions"; structure modelled on rr-hh, not its data).
--
-- personal.persona is the former identidad.personal_data, moved with its rows.
-- Functions that answer "as of a date" live in prisma/ddl (pnpm db:funciones).

CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "movilidad";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "organizacion";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "parametrica";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "personal";

-- Genero moves with the person (was identidad."Genero")
ALTER TYPE "identidad"."Genero" SET SCHEMA "personal";

-- CreateEnum
CREATE TYPE "organizacion"."NivelDependencia" AS ENUM ('DIRECCION', 'UNIDAD', 'AREA');

-- CreateEnum
CREATE TYPE "movilidad"."TipoAsignacion" AS ENUM ('TITULAR', 'INTERINO', 'ROTACION', 'COMISION', 'SUPLENCIA');




-- identidad.personal_data becomes personal.persona, rows included. The
-- account becomes optional: a person may exist before having an account.
ALTER TABLE "identidad"."personal_data" DROP CONSTRAINT "personal_data_userId_fkey";
ALTER TABLE "identidad"."personal_data" SET SCHEMA "personal";
ALTER TABLE "personal"."personal_data" RENAME TO "persona";
ALTER TABLE "personal"."persona" RENAME CONSTRAINT "personal_data_pkey" TO "persona_pkey";
ALTER INDEX "personal"."personal_data_userId_key" RENAME TO "persona_userId_key";
ALTER TABLE "personal"."persona" ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "parametrica"."tipo_vinculo" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tipo_vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parametrica"."tipo_movimiento" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "tipo_movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacion"."dependencia" (
    "id" UUID NOT NULL,
    "codigo" TEXT NOT NULL,
    "sigla" TEXT,
    "nombre" TEXT NOT NULL,
    "nivel" "organizacion"."NivelDependencia" NOT NULL,
    "padre_id" UUID,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "dependencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "organizacion"."puesto" (
    "id" UUID NOT NULL,
    "dependencia_id" UUID NOT NULL,
    "tipo_vinculo_id" UUID NOT NULL,
    "numero" TEXT,
    "denominacion" TEXT NOT NULL,
    "es_jefatura" BOOLEAN NOT NULL DEFAULT false,
    "vigente_desde" DATE NOT NULL,
    "vigente_hasta" DATE,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "puesto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movilidad"."movimiento" (
    "id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "tipo_movimiento_id" UUID NOT NULL,
    "fecha_efectiva" DATE NOT NULL,
    "documento" TEXT,
    "observaciones" TEXT,
    "registrado_por_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "movimiento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movilidad"."asignacion" (
    "id" UUID NOT NULL,
    "persona_id" UUID NOT NULL,
    "puesto_id" UUID NOT NULL,
    "tipo" "movilidad"."TipoAsignacion" NOT NULL,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "movimiento_inicio_id" UUID,
    "movimiento_fin_id" UUID,
    "observaciones" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asignacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "movilidad"."delegacion" (
    "id" UUID NOT NULL,
    "delegante_persona_id" UUID NOT NULL,
    "delegado_persona_id" UUID NOT NULL,
    "motivo" TEXT,
    "documento" TEXT,
    "desde" DATE NOT NULL,
    "hasta" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "delegacion_pkey" PRIMARY KEY ("id")
);


-- CreateIndex
CREATE UNIQUE INDEX "tipo_vinculo_codigo_key" ON "parametrica"."tipo_vinculo"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "tipo_movimiento_codigo_key" ON "parametrica"."tipo_movimiento"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "dependencia_codigo_key" ON "organizacion"."dependencia"("codigo");

-- CreateIndex
CREATE INDEX "dependencia_padre_id_idx" ON "organizacion"."dependencia"("padre_id");

-- CreateIndex
CREATE INDEX "puesto_dependencia_id_idx" ON "organizacion"."puesto"("dependencia_id");

-- CreateIndex
CREATE INDEX "movimiento_persona_id_fecha_efectiva_idx" ON "movilidad"."movimiento"("persona_id", "fecha_efectiva");

-- CreateIndex
CREATE INDEX "asignacion_persona_id_desde_idx" ON "movilidad"."asignacion"("persona_id", "desde");

-- CreateIndex
CREATE INDEX "asignacion_puesto_id_desde_idx" ON "movilidad"."asignacion"("puesto_id", "desde");

-- CreateIndex
CREATE INDEX "delegacion_delegante_persona_id_desde_idx" ON "movilidad"."delegacion"("delegante_persona_id", "desde");

-- AddForeignKey
ALTER TABLE "personal"."persona" ADD CONSTRAINT "persona_userId_fkey" FOREIGN KEY ("userId") REFERENCES "identidad"."user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion"."dependencia" ADD CONSTRAINT "dependencia_padre_id_fkey" FOREIGN KEY ("padre_id") REFERENCES "organizacion"."dependencia"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion"."puesto" ADD CONSTRAINT "puesto_dependencia_id_fkey" FOREIGN KEY ("dependencia_id") REFERENCES "organizacion"."dependencia"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizacion"."puesto" ADD CONSTRAINT "puesto_tipo_vinculo_id_fkey" FOREIGN KEY ("tipo_vinculo_id") REFERENCES "parametrica"."tipo_vinculo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."movimiento" ADD CONSTRAINT "movimiento_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personal"."persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."movimiento" ADD CONSTRAINT "movimiento_tipo_movimiento_id_fkey" FOREIGN KEY ("tipo_movimiento_id") REFERENCES "parametrica"."tipo_movimiento"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_persona_id_fkey" FOREIGN KEY ("persona_id") REFERENCES "personal"."persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_puesto_id_fkey" FOREIGN KEY ("puesto_id") REFERENCES "organizacion"."puesto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_movimiento_inicio_id_fkey" FOREIGN KEY ("movimiento_inicio_id") REFERENCES "movilidad"."movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_movimiento_fin_id_fkey" FOREIGN KEY ("movimiento_fin_id") REFERENCES "movilidad"."movimiento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."delegacion" ADD CONSTRAINT "delegacion_delegante_persona_id_fkey" FOREIGN KEY ("delegante_persona_id") REFERENCES "personal"."persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movilidad"."delegacion" ADD CONSTRAINT "delegacion_delegado_persona_id_fkey" FOREIGN KEY ("delegado_persona_id") REFERENCES "personal"."persona"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Only one TITULAR per post at a time. `hasta` is the last day (inclusive),
-- so the range is closed: '[]'. Prisma does not model exclusion constraints;
-- it neither creates nor drops them.
ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_titular_unico"
  EXCLUDE USING gist (
    "puesto_id" WITH =,
    daterange("desde", "hasta", '[]') WITH &&
  ) WHERE ("tipo" = 'TITULAR');

ALTER TABLE "movilidad"."asignacion" ADD CONSTRAINT "asignacion_fechas"
  CHECK ("hasta" IS NULL OR "hasta" >= "desde");
ALTER TABLE "movilidad"."delegacion" ADD CONSTRAINT "delegacion_fechas"
  CHECK ("hasta" IS NULL OR "hasta" >= "desde");
ALTER TABLE "movilidad"."delegacion" ADD CONSTRAINT "delegacion_a_otra_persona"
  CHECK ("delegante_persona_id" <> "delegado_persona_id");
ALTER TABLE "organizacion"."dependencia" ADD CONSTRAINT "dependencia_fechas"
  CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde");
ALTER TABLE "organizacion"."puesto" ADD CONSTRAINT "puesto_fechas"
  CHECK ("vigente_hasta" IS NULL OR "vigente_hasta" >= "vigente_desde");

-- Starting catalogues (RR.HH. may add more). Fixed ids: v5 of the code.
INSERT INTO "parametrica"."tipo_vinculo" ("id", "codigo", "nombre", "descripcion", "orden") VALUES
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_vinculo:ITEM'), 'ITEM', 'Ítem de planta', 'Puesto permanente con número de ítem', 1),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_vinculo:EVENTUAL'), 'EVENTUAL', 'Personal eventual', 'Contrato eventual con número de contrato por gestión', 2),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_vinculo:CONSULTOR'), 'CONSULTOR', 'Consultor individual de línea', 'Consultoría individual de línea', 3);

INSERT INTO "parametrica"."tipo_movimiento" ("id", "codigo", "nombre", "descripcion", "orden") VALUES
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:ALTA'), 'ALTA', 'Alta', 'Ingreso a la entidad', 1),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:DESIGNACION'), 'DESIGNACION', 'Designación', 'Asignación a un puesto como titular', 2),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:INTERINATO'), 'INTERINATO', 'Interinato', 'Ejerce un puesto de forma interina', 3),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:ROTACION'), 'ROTACION', 'Rotación', 'Pasa temporalmente a otra dependencia', 4),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:COMISION'), 'COMISION', 'Comisión de servicio', 'Cumple funciones en otro puesto o entidad', 5),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:SUPLENCIA'), 'SUPLENCIA', 'Suplencia', 'Cubre a otra persona por un periodo', 6),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:CONCLUSION'), 'CONCLUSION', 'Conclusión', 'Termina un interinato, rotación, comisión o suplencia', 7),
  (uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8', 'tipo_movimiento:BAJA'), 'BAJA', 'Baja', 'Deja la entidad', 8);
