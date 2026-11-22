# Recursos humanos: personas, organigrama y movilidad

Datos de RR.HH. que comparten todos los sistemas de la entidad: quién es cada persona, cómo está organizada la
entidad y qué puesto ocupó cada quien y cuándo. La estructura toma como modelo `D:\javascript\rr-hh\rrhh-db`
(sus esquemas y sus funciones por fecha, no sus datos). Decisiones en `CLAUDE.md` → "Decisions (database layout)".

## Esquemas y tablas

| Esquema | Tabla | Qué guarda |
|---|---|---|
| `personal` | `persona` | La persona: nombre, documento, contacto. Es el ancla estable (no cambia aunque cambie de puesto). Puede existir **sin cuenta** (`userId` nulo); al borrar la cuenta, la persona queda |
| `organizacion` | `dependencia` | Cajas del organigrama: DGE → unidad → área (`nivel`), con `padre_id`, código, sigla y vigencia |
| `organizacion` | `puesto` | Puesto de la estructura: ítem de planta o puesto eventual (`tipo_vinculo`), número, denominación, dependencia y si es la **jefatura** de esa dependencia |
| `movilidad` | `asignacion` | Persona ↔ puesto por un periodo: **la movilidad**. Tipo: titular, interino, rotación, comisión o suplencia |
| `movilidad` | `movimiento` | El acto de RR.HH. (memorándum, resolución) que abre o cierra asignaciones |
| `movilidad` | `delegacion` | Quién cubre la autoridad de otra persona por un periodo (vacación, viaje) |
| `parametrica` | `tipo_vinculo`, `tipo_movimiento` | Catálogos que RR.HH. puede ampliar (se cargan con valores iniciales) |

`persona` es la antigua `identidad.personal_data`, movida con sus filas; en el código el modelo sigue llamándose
`PersonalData`.

## Reglas

- **Fechas:** `hasta` es el último día, **inclusive**; `NULL` = vigente (no se usa `1900-01-01`).
- **Nunca se sobrescribe:** un cambio cierra una asignación (`hasta`) y abre otra. Así se puede responder qué puesto
  tenía alguien en cualquier fecha.
- **Varias a la vez:** una persona puede ser titular de un puesto e interina en otro, o estar en dos dependencias
  (rotación), cada una con sus fechas.
- **Un solo titular por puesto y periodo:** lo asegura la base (restricción de exclusión `asignacion_titular_unico`).
  Interino, rotación, comisión y suplencia pueden convivir con el titular.
- Al registrar una rotación, RR.HH. decide si la titularidad de origen sigue vigente (dos asignaciones) o se cierra.

## Consultas por fecha (`prisma/ddl`)

Funciones SQL en archivos repetibles, como `ddl/R__*.sql` de rr-hh. `pnpm db:funciones` las aplica (también corre
después de `pnpm db:deploy`); se pueden correr las veces que haga falta.

| Función | Devuelve |
|---|---|
| `movilidad.asignaciones_en_fecha(fecha)` | **Todas** las asignaciones vigentes ese día, con puesto, dependencia y si es jefatura |
| `movilidad.jefatura_en_fecha(dependencia, fecha)` | Quién ejerce la jefatura: suplente o interino antes que el titular; si delegó, el delegado. Sin fila: acéfala |
| `movilidad.jefe_inmediato_en_fecha(persona, fecha)` | El jefe inmediato **por cada asignación** de la persona; si la jefatura está acéfala o es la propia persona, sube por el organigrama |

```sql
SELECT * FROM movilidad.asignaciones_en_fecha();                   -- hoy
SELECT * FROM movilidad.asignaciones_en_fecha('2026-03-15');
SELECT * FROM movilidad.jefe_inmediato_en_fecha('<persona_id>', '2026-11-20');
```

Probado (22/11/2026) con un caso de ejemplo en una transacción descartada: titular más interina en dos puestos,
jefatura acéfala que sube a la unidad, delegación por vacación, la directora sin jefe y el rechazo de un segundo
titular superpuesto.

## Pendiente

- Permisos y rol de RR.HH. en este centro, y pantallas para personas, organigrama, puestos y movimientos.
- Carga inicial desde la planilla de cargos de la UCE (`docs/datos/cargos-uce.xlsx` en SIGECON, sin personas; la
  versión con nombres no va a los repositorios).
- API para que los sistemas (SIGECON) consulten los cargos vigentes de un usuario.
