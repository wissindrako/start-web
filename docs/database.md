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
| `pnpm db:reset` | Solo desarrollo: borra la base, aplica las migraciones y el seed |

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

## Shadow database (desarrollo)

`prisma migrate dev` compara contra una base auxiliar que borra y recrea en
cada ejecución. Se configura en `SHADOW_DATABASE_URL` (ver `.env.example`) y
debe ser **otra** base, a la que el usuario de la aplicación tenga acceso
total. Con el MySQL de Docker:

```sql
-- como root
CREATE DATABASE IF NOT EXISTS app_db_shadow;
GRANT ALL PRIVILEGES ON app_db_shadow.* TO 'app_user'@'%';
```

`pnpm db:deploy` no la usa: en CI y producción no hace falta.

## Bases creadas antes de las migraciones

Hasta octubre de 2026 el esquema se aplicaba con `db push`. Una base de esa
época ya tiene las tablas de la migración inicial (`20261024000000_init`):
hay que marcarla como aplicada en lugar de ejecutarla.

1. Comprueba que la base coincide con la migración inicial (no debe mostrar
   cambios; si los muestra, corrígelos antes):

   ```bash
   npx prisma migrate diff --from-url "$DATABASE_URL" \
     --to-migrations prisma/migrations \
     --shadow-database-url "$SHADOW_DATABASE_URL" --script
   ```

2. Márcala como aplicada (no ejecuta SQL ni toca datos):

   ```bash
   npx prisma migrate resolve --applied 20261024000000_init
   ```

3. Desde ahí, `pnpm db:deploy` aplica solo las migraciones nuevas.
