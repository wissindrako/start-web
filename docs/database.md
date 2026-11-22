# Base de datos y migraciones

El esquema vive en `prisma/schema.prisma` y cada cambio queda registrado como
una migración SQL en `prisma/migrations/`, que se versiona con el código. Así
cada entorno (local, CI, producción) llega al mismo esquema aplicando las
mismas migraciones en orden, y cada cambio se revisa como cualquier otro
código.

> No uses `prisma db push`: cambia la base sin dejar migración, y la próxima
> `pnpm db:migrate` detecta la diferencia ("drift") y pide borrar la base.

## Comandos

| Comando | Para qué |
|---|---|
| `pnpm db:migrate --name <nombre>` | En desarrollo: crea la migración de tus cambios en el esquema y la aplica |
| `pnpm db:deploy` | En CI y producción: aplica las migraciones pendientes (no crea ninguna ni borra datos) |
| `pnpm db:status` | Muestra qué migraciones faltan aplicar |
| `pnpm db:init` | Base nueva: aplica todas las migraciones y carga el seed |
| `pnpm db:reset` | Solo desarrollo: borra la base, aplica las migraciones y el seed (configurado en `package.json`, clave `prisma.seed`) |

## Cambiar el esquema

1. Edita `prisma/schema.prisma`.
2. `pnpm db:migrate --name agregar_tabla_x` (nombre corto, en snake_case).
3. Revisa el SQL generado en `prisma/migrations/<fecha>_agregar_tabla_x/`,
   sobre todo si renombra o borra columnas: Prisma no distingue un renombre
   de "borrar y crear", así que en ese caso edita el SQL a mano antes de
   aplicarlo (`pnpm db:migrate --create-only` lo genera sin aplicarlo).
4. Commitea el esquema y la carpeta de la migración juntos.

Las migraciones ya aplicadas en algún entorno no se editan: un cambio nuevo
es una migración nueva.

## Base de datos en desarrollo

PostgreSQL 17 en Docker, en el puerto **5441** (registrado en
`D:/javascript/ports.json`):

```bash
docker compose up -d postgres   # solo la base; MinIO y Maildev son opcionales
pnpm db:deploy                  # base nueva: crea las tablas
```

## Shadow database (desarrollo)

`prisma migrate dev` compara contra una base auxiliar que borra y recrea en
cada ejecución. Se configura en `SHADOW_DATABASE_URL` (ver `.env.example`) y
debe ser **otra** base. El contenedor de PostgreSQL la crea la primera vez
que arranca (`<base>_shadow`, con `docker/postgres-init/shadow.sh`).

`pnpm db:deploy` no la usa: en CI y producción no hace falta.

## Ids: UUID

Las columnas `id` y las claves foráneas son `uuid` en PostgreSQL (`@db.Uuid`).
Las filas nuevas reciben un **UUID v7** (ordenable por tiempo, lo genera Prisma
con `@default(uuid(7))`); Better Auth genera las suyas con `crypto.randomUUID()`
(UUID v4) para las tablas cuyo `id` no tiene default (clientes y tokens OAuth…).

La migración `20261122154324_uuid_ids` convirtió los ids antiguos (cuid) de
forma determinista, para que las relaciones siguieran cuadrando sin tablas
intermedias:

```sql
uuid_generate_v5('6ba7b811-9dad-11d1-80b4-00c04fd430c8'::uuid, '<id antiguo>')
```

`6ba7b811-9dad-11d1-80b4-00c04fd430c8` es el namespace URL de `uuid-ossp`
(la extensión se crea en la propia migración). Un valor que ya era un UUID se
dejó igual. Por eso un sistema externo que haya guardado un id antiguo —por
ejemplo una aplicación cliente con el `sub` que le dio el OIDC— puede calcular
el nuevo con esa misma expresión (o con cualquier librería UUID v5 y el mismo
namespace). Las filas únicas de configuración (`system_config`,
`access_settings`, `mail_settings`) usan el id fijo
`00000000-0000-0000-0000-000000000001`. Los pocos ids que Better Auth deriva
de un valor (el `jti` de una client assertion, las reservas de verificación)
también se convierten a UUID v5 con ese namespace en
`src/server/db/uuid-ids.ts`, para que sigan siendo deterministas.

## Esquemas por dominio

Las tablas no están en `public`: cada dominio tiene su esquema, con nombre en
español (`schemas` en el `datasource` y `@@schema` en cada modelo y enum):

| Esquema | Qué guarda |
|---|---|
| `identidad` | Cuentas, sesiones, verificaciones, invitaciones, 2FA y todo lo de OAuth/OIDC (Better Auth) |
| `acceso` | Sistemas externos y sus módulos, roles, permisos y sus asignaciones |
| `configuracion` | Ajustes del sistema, de acceso y de correo |
| `demo` | Tablas de ejemplo de la plantilla (libros) |
| `personal` | La persona (antes `identidad.personal_data`) |
| `organizacion` | Organigrama: dependencias y puestos |
| `movilidad` | Asignaciones persona ↔ puesto con fechas, movimientos y delegaciones |
| `parametrica` | Catálogos de RR.HH. (tipos de vínculo y de movimiento) |

Los cuatro últimos son de RR.HH.: ver [rrhh.md](rrhh.md). En `public` quedan
solo `_prisma_migrations` y las extensiones `uuid-ossp` y `btree_gist`. Un
modelo nuevo **debe** llevar `@@schema("…")`; Prisma no deja omitirlo. El SQL
escrito a mano tiene que calificar las tablas (`identidad."user"`,
`acceso.role`), igual que los sistemas que escriben en esta base (los scripts de
SIGECON).

**Funciones SQL** (consultas por fecha de RR.HH.): en `prisma/ddl/R__NN_*.sql`,
con `CREATE OR REPLACE`. `pnpm db:deploy` las aplica después de las
migraciones; tras `pnpm db:migrate` (desarrollo) correr `pnpm db:funciones`.

## Venir de MySQL (hasta noviembre de 2026)

nucleo-admin usó MySQL hasta el 10/11/2026. La migración inicial
(`20261110000000_init`) es de PostgreSQL y reemplaza a la de MySQL. Para
pasar los datos de una base MySQL existente (usuarios, roles, sistemas
externos con sus clientes OAuth y secretos, claves de firma…), sin volver a
registrar los sistemas conectados:

1. En `.env`, apuntar `DATABASE_URL` a PostgreSQL y dejar los datos de la
   base vieja en `MYSQL_SOURCE_CONTAINER`, `MYSQL_SOURCE_DATABASE`,
   `MYSQL_SOURCE_USERNAME` y `MYSQL_SOURCE_PASSWORD` (ver `.env.example`).
2. `docker compose up -d postgres` y `pnpm db:deploy` (tablas vacías, sin seed).
   No correr el seed antes de copiar: si la base ya tiene usuarios, la copia se detiene.
3. `pnpm db:from-mysql`: copia cada tabla y columna que exista en las dos
   bases, en una transacción. MySQL solo se lee. Si PostgreSQL ya tiene
   usuarios se detiene; `--replace` la vacía antes.
4. Detener el servidor de desarrollo, `pnpm gen:prisma` y volver a levantarlo.

Better Auth guarda listas de OAuth como texto JSON; en PostgreSQL eso lo
hace `src/server/db/oauth-lists.ts` (ver CLAUDE.md, "Moving the database from
MySQL to PostgreSQL"). Las búsquedas usan `mode: 'insensitive'`, porque
PostgreSQL distingue mayúsculas y MySQL no.

## Correo y archivos (opcionales)

- **Correo:** sin configuración (Manager o `EMAIL_SERVER` y `EMAIL_FROM`) los
  correos se escriben en el log. En desarrollo, si el servidor de correo no
  responde (Maildev apagado), también van al log; el código de ingreso fijo
  (`000000`) sigue funcionando. El correo de prueba del Manager sí falla.
- **Archivos (S3 / MinIO):** sin `S3_HOST`, las claves y
  `VITE_S3_BUCKET_PUBLIC_URL`, se ocultan las subidas (avatar, logo, portada)
  y `/api/upload` responde 503.
