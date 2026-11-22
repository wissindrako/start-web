-- =============================================================================
-- R__03_jefe_inmediato_en_fecha.sql
-- Immediate superior of a person on a date, for each assignment they hold
-- (someone in two units has two superiors). The superior is whoever
-- exercises the head of the person's dependency; if the person is that head,
-- or the head is vacant, or it is the person themselves, it goes up the tree
-- until it finds one. jefe_persona_id NULL: nobody above (e.g. the DGE).
--
-- Depends on R__01 and R__02. Repeatable (`pnpm db:funciones`).
--
-- Example:
--   SELECT * FROM movilidad.jefe_inmediato_en_fecha('<persona_id>');
-- =============================================================================

CREATE OR REPLACE FUNCTION movilidad.jefe_inmediato_en_fecha(
  p_persona uuid,
  p_fecha date DEFAULT current_date
)
RETURNS TABLE (
  asignacion_id    uuid,
  dependencia_id   uuid,
  jefe_persona_id  uuid,
  por_delegacion   boolean
)
LANGUAGE plpgsql STABLE AS $$
DECLARE
  a         record;
  dep       uuid;
  jefe      uuid;
  delegado  boolean;
  vueltas   int;
BEGIN
  FOR a IN
    SELECT * FROM movilidad.asignaciones_en_fecha(p_fecha) x
    WHERE x.persona_id = p_persona
  LOOP
    -- The head of a dependency answers to the head of the one above
    IF a.es_jefatura THEN
      SELECT d.padre_id INTO dep FROM organizacion.dependencia d WHERE d.id = a.dependencia_id;
    ELSE
      dep := a.dependencia_id;
    END IF;

    jefe := NULL;
    delegado := false;
    vueltas := 0;
    WHILE dep IS NOT NULL AND vueltas < 50 LOOP
      SELECT j.persona_id, j.por_delegacion INTO jefe, delegado
      FROM movilidad.jefatura_en_fecha(dep, p_fecha) j;
      EXIT WHEN FOUND AND jefe IS DISTINCT FROM p_persona;
      jefe := NULL;
      delegado := false;
      SELECT d.padre_id INTO dep FROM organizacion.dependencia d WHERE d.id = dep;
      vueltas := vueltas + 1;
    END LOOP;

    asignacion_id   := a.asignacion_id;
    dependencia_id  := dep;
    jefe_persona_id := jefe;
    por_delegacion  := COALESCE(delegado, false);
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION movilidad.jefe_inmediato_en_fecha(uuid, date) IS
  'Jefe inmediato de la persona en la fecha, por cada asignación vigente; sube por el organigrama si la jefatura está acéfala o es la propia persona.';
