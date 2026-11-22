-- =============================================================================
-- Tests of the as-of-date functions (prisma/ddl/R__*.sql).
-- Run with `pnpm db:test-funciones`. Everything happens inside a transaction
-- that is rolled back: nothing stays in the database. A failed check raises
-- an exception with what was expected, and the command fails.
--
-- Case: DGE → UAF → Área de Sistemas
--   Ana   titular, head of the DGE
--   Beto  titular, head of the UAF; delegates to Ana 10–20/11
--   Carla titular, Sistemas technician; interim head of Sistemas 01/06–31/12
-- =============================================================================

BEGIN;

CREATE FUNCTION pg_temp.afirmar(condicion boolean, mensaje text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF condicion IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'FALLA: %', mensaje;
  END IF;
END;
$$;

INSERT INTO organizacion.dependencia (id, codigo, nombre, nivel, padre_id, vigente_desde, updated_at) VALUES
  ('00000000-0000-7000-8000-00000000d001', 'TEST-DGE', 'Dirección General Ejecutiva', 'DIRECCION', NULL, '2026-01-01', now()),
  ('00000000-0000-7000-8000-00000000d002', 'TEST-UAF', 'Unidad Administrativa Financiera', 'UNIDAD', '00000000-0000-7000-8000-00000000d001', '2026-01-01', now()),
  ('00000000-0000-7000-8000-00000000d003', 'TEST-SIS', 'Área de Sistemas', 'AREA', '00000000-0000-7000-8000-00000000d002', '2026-01-01', now());

INSERT INTO organizacion.puesto (id, dependencia_id, tipo_vinculo_id, numero, denominacion, es_jefatura, vigente_desde, updated_at)
SELECT v.id::uuid, v.dep::uuid, (SELECT id FROM parametrica.tipo_vinculo WHERE codigo = 'ITEM'), v.num, v.den, v.jef, '2026-01-01', now()
FROM (VALUES
  ('00000000-0000-7000-8000-00000000e001', '00000000-0000-7000-8000-00000000d001', '1',  'Director General Ejecutivo', true),
  ('00000000-0000-7000-8000-00000000e002', '00000000-0000-7000-8000-00000000d002', '20', 'Jefe de Unidad Administrativa Financiera', true),
  ('00000000-0000-7000-8000-00000000e003', '00000000-0000-7000-8000-00000000d003', '42', 'Responsable de Sistemas', true),
  ('00000000-0000-7000-8000-00000000e004', '00000000-0000-7000-8000-00000000d003', '43', 'Técnico de Sistemas', false)
) v(id, dep, num, den, jef);

INSERT INTO personal.persona (id, nombre, "primerApellido", "updatedAt") VALUES
  ('00000000-0000-7000-8000-00000000f001', 'Ana',   'Prueba', now()),
  ('00000000-0000-7000-8000-00000000f002', 'Beto',  'Prueba', now()),
  ('00000000-0000-7000-8000-00000000f003', 'Carla', 'Prueba', now());

INSERT INTO movilidad.asignacion (id, persona_id, puesto_id, tipo, desde, hasta, updated_at) VALUES
  ('00000000-0000-7000-8000-00000000a001', '00000000-0000-7000-8000-00000000f001', '00000000-0000-7000-8000-00000000e001', 'TITULAR',  '2026-01-01', NULL, now()),
  ('00000000-0000-7000-8000-00000000a002', '00000000-0000-7000-8000-00000000f002', '00000000-0000-7000-8000-00000000e002', 'TITULAR',  '2026-01-01', NULL, now()),
  ('00000000-0000-7000-8000-00000000a003', '00000000-0000-7000-8000-00000000f003', '00000000-0000-7000-8000-00000000e004', 'TITULAR',  '2026-01-01', NULL, now()),
  ('00000000-0000-7000-8000-00000000a004', '00000000-0000-7000-8000-00000000f003', '00000000-0000-7000-8000-00000000e003', 'INTERINO', '2026-06-01', '2026-12-31', now());

INSERT INTO movilidad.delegacion (id, delegante_persona_id, delegado_persona_id, motivo, desde, hasta) VALUES
  ('00000000-0000-7000-8000-00000000b001', '00000000-0000-7000-8000-00000000f002', '00000000-0000-7000-8000-00000000f001', 'Vacación', '2026-11-10', '2026-11-20');

DO $$
DECLARE
  carla   constant uuid := '00000000-0000-7000-8000-00000000f003';
  ana     constant uuid := '00000000-0000-7000-8000-00000000f001';
  beto    constant uuid := '00000000-0000-7000-8000-00000000f002';
  sis     constant uuid := '00000000-0000-7000-8000-00000000d003';
  n       int;
  r       record;
BEGIN
  -- asignaciones_en_fecha
  SELECT count(*) INTO n FROM movilidad.asignaciones_en_fecha('2026-03-15') WHERE persona_id = carla;
  PERFORM pg_temp.afirmar(n = 1, format('15/03: Carla con 1 asignación, tiene %s', n));
  SELECT count(*) INTO n FROM movilidad.asignaciones_en_fecha('2026-07-15') WHERE persona_id = carla;
  PERFORM pg_temp.afirmar(n = 2, format('15/07: Carla titular e interina (2), tiene %s', n));
  SELECT count(*) INTO n FROM movilidad.asignaciones_en_fecha('2026-12-31') WHERE persona_id = carla;
  PERFORM pg_temp.afirmar(n = 2, format('31/12 (último día, inclusive): Carla con 2, tiene %s', n));
  SELECT count(*) INTO n FROM movilidad.asignaciones_en_fecha('2027-01-01') WHERE persona_id = carla;
  PERFORM pg_temp.afirmar(n = 1, format('01/01/2027: el interinato terminó, Carla con 1, tiene %s', n));

  -- jefatura_en_fecha
  SELECT count(*) INTO n FROM movilidad.jefatura_en_fecha(sis, '2026-03-15');
  PERFORM pg_temp.afirmar(n = 0, 'Sistemas en marzo: acéfala (sin fila)');
  SELECT * INTO r FROM movilidad.jefatura_en_fecha(sis, '2026-07-15');
  PERFORM pg_temp.afirmar(r.persona_id = carla AND r.tipo = 'INTERINO', 'Sistemas en julio: Carla interina');

  -- jefe_inmediato_en_fecha
  SELECT count(*) INTO n FROM movilidad.jefe_inmediato_en_fecha(carla, '2026-03-15') WHERE jefe_persona_id = beto;
  PERFORM pg_temp.afirmar(n = 1, 'Carla en marzo: Sistemas acéfala, el jefe es Beto (sube a la UAF)');
  SELECT count(*) INTO n FROM movilidad.jefe_inmediato_en_fecha(carla, '2026-07-15') WHERE jefe_persona_id = beto AND NOT por_delegacion;
  PERFORM pg_temp.afirmar(n = 2, format('Carla en julio: Beto por sus 2 puestos, hay %s', n));
  SELECT count(*) INTO n FROM movilidad.jefe_inmediato_en_fecha(carla, '2026-11-15') WHERE jefe_persona_id = ana AND por_delegacion;
  PERFORM pg_temp.afirmar(n = 2, format('Carla el 15/11: Beto delegó en Ana (2), hay %s', n));
  SELECT count(*) INTO n FROM movilidad.jefe_inmediato_en_fecha(carla, '2026-11-21') WHERE jefe_persona_id = beto;
  PERFORM pg_temp.afirmar(n = 2, 'Carla el 21/11: terminó la delegación, vuelve Beto');
  SELECT * INTO r FROM movilidad.jefe_inmediato_en_fecha(ana, '2026-07-15');
  PERFORM pg_temp.afirmar(FOUND AND r.jefe_persona_id IS NULL, 'Ana (DGE) no tiene jefe');

  -- Constraints
  BEGIN
    INSERT INTO movilidad.asignacion (id, persona_id, puesto_id, tipo, desde, updated_at)
    VALUES (gen_random_uuid(), carla, '00000000-0000-7000-8000-00000000e002', 'TITULAR', '2026-08-01', now());
    PERFORM pg_temp.afirmar(false, 'Un segundo titular superpuesto debía rechazarse');
  EXCEPTION WHEN exclusion_violation THEN
    NULL; -- expected
  END;
  INSERT INTO movilidad.asignacion (id, persona_id, puesto_id, tipo, desde, hasta, updated_at)
  VALUES (gen_random_uuid(), carla, '00000000-0000-7000-8000-00000000e002', 'INTERINO', '2026-08-01', '2026-08-15', now());
  BEGIN
    INSERT INTO movilidad.asignacion (id, persona_id, puesto_id, tipo, desde, hasta, updated_at)
    VALUES (gen_random_uuid(), carla, '00000000-0000-7000-8000-00000000e004', 'COMISION', '2026-08-10', '2026-08-01', now());
    PERFORM pg_temp.afirmar(false, 'Una asignación que termina antes de empezar debía rechazarse');
  EXCEPTION WHEN check_violation THEN
    NULL; -- expected
  END;

  RAISE NOTICE 'movilidad: todas las pruebas pasaron';
END;
$$;

ROLLBACK;
