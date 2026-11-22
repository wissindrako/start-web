-- =============================================================================
-- R__02_jefatura_en_fecha.sql
-- Who exercises the head of a dependency on a date: the person assigned to
-- its head post (es_jefatura), preferring whoever covers the titular
-- (suplencia, then interino, rotación or comisión, then titular). If that
-- person delegated their authority for that date, the delegate is returned
-- (por_delegacion = true, delegante_persona_id = who delegated).
-- No row: the head is vacant on that date.
--
-- Depends on R__01. Repeatable (`pnpm db:funciones`).
--
-- Example:
--   SELECT * FROM movilidad.jefatura_en_fecha('<dependencia_id>', '2026-11-20');
-- =============================================================================

CREATE OR REPLACE FUNCTION movilidad.jefatura_en_fecha(
  p_dependencia uuid,
  p_fecha date DEFAULT current_date
)
RETURNS TABLE (
  persona_id            uuid,
  asignacion_id         uuid,
  tipo                  movilidad."TipoAsignacion",
  por_delegacion        boolean,
  delegante_persona_id  uuid
)
LANGUAGE sql STABLE AS $$
  WITH quien_ejerce AS (
    SELECT a.persona_id, a.asignacion_id, a.tipo
    FROM movilidad.asignaciones_en_fecha(p_fecha) a
    WHERE a.dependencia_id = p_dependencia
      AND a.es_jefatura
    ORDER BY CASE a.tipo
               WHEN 'SUPLENCIA' THEN 1
               WHEN 'INTERINO'  THEN 2
               WHEN 'ROTACION'  THEN 3
               WHEN 'COMISION'  THEN 3
               ELSE 4               -- TITULAR
             END,
             a.desde DESC
    LIMIT 1
  ),
  delegacion AS (
    SELECT d.delegado_persona_id, d.delegante_persona_id
    FROM movilidad.delegacion d
    JOIN quien_ejerce q ON q.persona_id = d.delegante_persona_id
    WHERE d.desde <= p_fecha
      AND (d.hasta IS NULL OR d.hasta >= p_fecha)
    ORDER BY d.desde DESC
    LIMIT 1
  )
  SELECT COALESCE(d.delegado_persona_id, q.persona_id),
         q.asignacion_id,
         q.tipo,
         d.delegado_persona_id IS NOT NULL,
         d.delegante_persona_id
  FROM quien_ejerce q
  LEFT JOIN delegacion d ON true;
$$;

COMMENT ON FUNCTION movilidad.jefatura_en_fecha(uuid, date) IS
  'Quién ejerce la jefatura de la dependencia en la fecha (suplente o interino antes que el titular; si delegó, el delegado). Sin fila: acéfala.';
