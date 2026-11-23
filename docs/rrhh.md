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

**Pruebas:** `pnpm db:test-funciones` corre `prisma/ddl/tests/*.test.sql`. Cada archivo arma su caso dentro de una
transacción que se descarta al final (no deja nada en la base) y falla con `FALLA: …` si un resultado no es el esperado.
`movilidad.test.sql` cubre: titular más interina en dos puestos, el último día inclusive, el fin de un interinato,
jefatura acéfala que sube a la unidad, delegación por vacación y su fin, la directora sin jefe, el rechazo de un segundo
titular superpuesto y de fechas invertidas. También corre en CI (paso "SQL functions", sobre una base vacía).
Al cambiar o agregar una función, agregar su caso ahí.

## Rol y permisos

| Permiso | Para qué |
|---|---|
| `persona:read` / `persona:update` | Ver / editar personas |
| `organizacion:read` / `organizacion:update` | Ver / editar dependencias y puestos |
| `movilidad:read` / `movilidad:update` | Ver / registrar asignaciones, movimientos y delegaciones |

Roles locales (los crea `pnpm db:roles`, o `pnpm db:seed` en una base nueva):
- **RR.HH.**: los seis permisos, más entrar al panel. Ve solo la sección "Recursos humanos" (no usuarios, roles ni
  sistemas). Los roles de los sistemas (p. ej. SIGECON) no los asigna RR.HH.
- **RR.HH. (consulta)**: solo lectura (p. ej. auditoría).
- **admin**: también los tiene.

## Importar la planilla

Pantalla **Recursos humanos → Importar planilla** (`/manager/rrhh/importar`, pide los tres `…:update`) o, desde la
consola, `pnpm rrhh:importar <planilla.xlsx> [--aplicar]`. La misma lógica en los dos (`src/server/rrhh/planilla.ts` lee
y revisa; `src/server/rrhh/importar.ts` compara con la base y guarda):

1. **Revisar:** muestra por hoja cuántas filas son nuevas, cambian o quedan iguales, los **errores** fila por fila y los
   avisos. No guarda nada.
2. **Importar:** solo si no hay errores; guarda todo o nada (una transacción). Cada asignación nueva registra también
   su movimiento (designación, interinato…, con el documento) y quién importó.
3. Se puede repetir: cada fila se reconoce por su clave (código de dependencia, código de puesto, C.I., persona + puesto
   + desde), así que no duplica. **Nunca borra**: lo que no está en la planilla queda como está; cerrar algo es poner su
   fecha de fin.

**Formato** (una hoja por tabla, encabezados en la fila 1; los obligatorios llevan `*`):

| Hoja | Columnas |
|---|---|
| Dependencias | Código*, Sigla, Nombre*, Nivel* (Dirección, Unidad, Área), Depende de (código), Vigente desde*, Vigente hasta, Orden, Observaciones |
| Puestos | Código de puesto*, Tipo de vínculo* (Ítem de planta, Eventual, Consultor), N° ítem o contrato, Denominación*, Código de dependencia*, ¿Jefatura?* (Sí/No), Vigente desde*, Vigente hasta, Observaciones |
| Personas | C.I.*, Complemento / expedido, Nombres*, Primer apellido*, Segundo apellido, Fecha de nacimiento, Género (M/F), Celular, Correo institucional |
| Asignaciones | C.I.*, Código de puesto*, Tipo* (Titular, Interino, Rotación, Comisión, Suplencia), Desde*, Hasta, Tipo de movimiento, Documento, Observaciones |
| Delegaciones | C.I. de quien delega*, C.I. de quien la recibe*, Desde*, Hasta, Motivo, Documento (opcional) |

Revisa: obligatorios, valores de las listas, fechas (de Excel o `DD/MM/AAAA`; fin no antes del inicio), claves
repetidas, referencias entre hojas, que el organigrama no dé vueltas, un solo titular por puesto y periodo (también
contra lo que ya está en la base) y que la cuenta con ese correo no esté vinculada a otra persona. El **correo
institucional** vincula a la persona con su cuenta si ya existe; si no, queda guardado (aviso).

La planilla de la UCE se genera en SIGECON (`scripts/datos-uce/plantilla-rrhh.py`, ver su
`docs/fuentes-organigrama-2026.md` §5); la copia con nombres y C.I. no va a ningún repositorio.

**Probado (22/11/2026):** 10 pruebas unitarias del lector (`planilla.unit.spec.ts`); la planilla real de la UCE da 23
dependencias, 190 puestos, 177 personas y 177 asignaciones, con 12 errores que RR.HH. debe completar (10 ítems vacantes
sin dependencia, 2 asignaciones sin fecha de ingreso). Con esos huecos llenados a modo de prueba, importada en una copia
de la base: la segunda importación da todo "iguales"; al 20/11 hay 164 asignaciones vigentes (13 contratos vencieron el
17–18/11) y todas tienen jefe inmediato salvo la DGE.

## Pendiente

- Pantallas de consulta y trámite: personal, ficha de la persona, registrar movimiento, organigrama, puestos,
  delegaciones y consulta a una fecha.
- Los códigos de dependencia son provisionales: la UCE pasará los oficiales.
- API para que los sistemas (SIGECON) consulten los cargos vigentes de un usuario.
