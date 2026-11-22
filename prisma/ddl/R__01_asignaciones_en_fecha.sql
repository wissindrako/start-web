-- =============================================================================
-- R__01_asignaciones_en_fecha.sql
-- Every assignment in force on a date: titular, interim, rotation, commission
-- and cover, all of them (unlike rr-hh's movilidad_en_fecha, which keeps one
-- per person with DISTINCT ON). A person may have several at once.
--
-- Repeatable: applied by `pnpm db:funciones` (also after `pnpm db:deploy`);
-- CREATE OR REPLACE, so it can run any number of times.
--
-- Examples:
--   SELECT * FROM movilidad.asignaciones_en_fecha();               -- today
--   SELECT * FROM movilidad.asignaciones_en_fecha('2026-03-15')
--   WHERE persona_id = '…';
-- =============================================================================

CREATE OR REPLACE FUNCTION movilidad.asignaciones_en_fecha(p_fecha date DEFAULT current_date)
RETURNS TABLE (
  asignacion_id   uuid,
  persona_id      uuid,
  puesto_id       uuid,
  dependencia_id  uuid,
  tipo            movilidad."TipoAsignacion",
  denominacion    text,
  es_jefatura     boolean,
  desde           date,
  hasta           date
)
LANGUAGE sql STABLE AS $$
  SELECT a.id, a.persona_id, a.puesto_id, p.dependencia_id, a.tipo,
         p.denominacion, p.es_jefatura, a.desde, a.hasta
  FROM movilidad.asignacion a
  JOIN organizacion.puesto p ON p.id = a.puesto_id
  WHERE a.desde <= p_fecha
    AND (a.hasta IS NULL OR a.hasta >= p_fecha)
  ORDER BY a.persona_id, a.desde;
$$;

COMMENT ON FUNCTION movilidad.asignaciones_en_fecha(date) IS
  'Asignaciones vigentes en la fecha (todas: titular, interino, rotación, comisión, suplencia). hasta es el último día, inclusive; NULL = vigente.';
