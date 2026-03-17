# Cómo agregar un nuevo módulo

Esta guía describe los pasos para agregar un módulo completo (CRUD) siguiendo los patrones del proyecto. Se usa el módulo `PersonalData` como ejemplo de referencia.

---

## Estructura de archivos resultante

```
prisma/
  schema.prisma                         ← modelo + relación

src/
  features/<modulo>/
    schema.ts                           ← tipos y schemas Zod
    manager/
      form-<modulo>.tsx                 ← formulario reutilizable
      page-<modulo>-update.tsx          ← página editar / upsert
      page-<modulo>.tsx                 ← (opcional) página detalle
      page-<modulo>s.tsx                ← (opcional) página listado

  server/
    routers/<modulo>.ts                 ← procedimientos ORPC (API)
    router.ts                           ← ← registrar aquí

  routes/
    manager/<entidad>/
      index.tsx                         ← ruta listado
      new.index.tsx                     ← ruta crear
      $id.index.tsx                     ← ruta detalle
      $id.update.index.tsx              ← ruta editar
      $id.<modulo>.index.tsx            ← ruta sub-módulo (ej. personal-data)

  locales/
    en/<modulo>.json                    ← traducciones inglés
    es/<modulo>.json                    ← traducciones español
    en/index.ts                         ← ← importar aquí
    es/index.ts                         ← ← importar aquí

  features/auth/permissions.ts         ← permisos Better Auth
  features/role/schema.ts              ← AVAILABLE_PERMISSIONS (UI de roles)
```

---

## Paso 1 — Prisma Schema

**Archivo:** `prisma/schema.prisma`

```prisma
model NombreModelo {
  id        String   @id @default(cuid())
  campo1    String?
  campo2    String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("nombre_tabla")
}
```

Si tiene relación con `User`:
```prisma
// Dentro del modelo User
miModelo MiModelo?

// Nuevo modelo
model MiModelo {
  id     String @id @default(cuid())
  userId String @unique
  user   User   @relation(fields: [userId], references: [id], onDelete: Cascade)
  // ...campos
  @@map("mi_tabla")
}
```

Aplicar la migración:
```bash
pnpm db:push
```

---

## Paso 2 — Zod Schema

**Archivo:** `src/features/<modulo>/schema.ts`

```typescript
import { z } from 'zod';
import { zu } from '@/lib/zod/zod-utils';

// Tipo completo (respuesta de la API)
export type MiModelo = z.infer<ReturnType<typeof zMiModelo>>;
export const zMiModelo = () =>
  z.object({
    id: z.string(),
    campo1: zu.fieldText.nullish(),
    campo2: zu.fieldText.nullish(),
    createdAt: z.date(),
    updatedAt: z.date(),
  });

// Tipo para formulario (sin id, timestamps, etc.)
export type FormFieldsMiModelo = z.infer<ReturnType<typeof zFormFieldsMiModelo>>;
export const zFormFieldsMiModelo = () =>
  z.object({
    campo1: zu.fieldText.nullish(),
    campo2: zu.fieldText.nullish(),
  });
```

**Utilidades Zod disponibles (`zu`):**
| Helper | Uso |
|---|---|
| `zu.fieldText.nullish()` | Texto opcional |
| `zu.fieldText.required({ error: '...' })` | Texto requerido con mensaje |
| `z.coerce.date().nullish()` | Fecha opcional (convierte string) |

---

## Paso 3 — Permisos

### 3a. Better Auth — `src/features/auth/permissions.ts`

Agregar el nuevo sujeto al `statement` y a los roles:

```typescript
const statement = {
  // ...existentes
  miModelo: ['read', 'create', 'update', 'delete'],
} as const;

const user = ac.newRole({
  // ...existentes
  miModelo: ['read', 'update'],  // qué puede hacer el rol user
});

const admin = ac.newRole({
  // ...existentes
  miModelo: ['read', 'create', 'update', 'delete'],  // admin puede todo
});
```

### 3b. UI de roles — `src/features/role/schema.ts`

```typescript
export const AVAILABLE_PERMISSIONS = [
  // ...existentes
  { subject: 'miModelo', actions: ['read', 'create', 'update', 'delete'] },
] as const;
```

---

## Paso 4 — Router ORPC

**Archivo:** `src/server/routers/<modulo>.ts`

```typescript
import { ORPCError } from '@orpc/client';
import { z } from 'zod';
import { zMiModelo } from '@/features/<modulo>/schema';
import { protectedProcedure } from '@/server/orpc';

const tags = ['mi-modulo'];

export default {
  getAll: protectedProcedure({ permission: { miModelo: ['read'] } })
    .route({ method: 'GET', path: '/mi-modulo', tags })
    .input(z.object({ /* filtros */ }).prefault({}))
    .output(z.object({ items: z.array(zMiModelo()), total: z.number() }))
    .handler(async ({ context, input }) => {
      return { items: await context.db.miModelo.findMany(), total: 0 };
    }),

  getById: protectedProcedure({ permission: { miModelo: ['read'] } })
    .route({ method: 'GET', path: '/mi-modulo/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(zMiModelo())
    .handler(async ({ context, input }) => {
      const item = await context.db.miModelo.findUnique({ where: { id: input.id } });
      if (!item) throw new ORPCError('NOT_FOUND');
      return item;
    }),

  create: protectedProcedure({ permission: { miModelo: ['create'] } })
    .route({ method: 'POST', path: '/mi-modulo', tags })
    .input(z.object({ campo1: z.string().nullish() }))
    .output(zMiModelo())
    .handler(async ({ context, input }) => {
      return await context.db.miModelo.create({ data: input });
    }),

  updateById: protectedProcedure({ permission: { miModelo: ['update'] } })
    .route({ method: 'POST', path: '/mi-modulo/{id}', tags })
    .input(z.object({ id: z.string(), campo1: z.string().nullish() }))
    .output(zMiModelo())
    .handler(async ({ context, input }) => {
      const { id, ...data } = input;
      return await context.db.miModelo.update({ where: { id }, data });
    }),

  deleteById: protectedProcedure({ permission: { miModelo: ['delete'] } })
    .route({ method: 'DELETE', path: '/mi-modulo/{id}', tags })
    .input(z.object({ id: z.string() }))
    .output(z.void())
    .handler(async ({ context, input }) => {
      await context.db.miModelo.delete({ where: { id: input.id } });
    }),

  // Patrón upsert (usado en relaciones 1:1 con User)
  upsertByUserId: protectedProcedure({ permission: { miModelo: ['update'] } })
    .route({ method: 'POST', path: '/mi-modulo/user/{userId}', tags })
    .input(z.object({ userId: z.string(), campo1: z.string().nullish() }))
    .output(zMiModelo())
    .handler(async ({ context, input }) => {
      const { userId, ...data } = input;
      return await context.db.miModelo.upsert({
        where: { userId },
        update: data,
        create: { userId, ...data },
      });
    }),
};
```

**Contexto disponible en handlers:**
- `context.db` → cliente Prisma
- `context.user` → usuario autenticado (`{ id, email, role, ... }`)
- `context.session` → sesión actual
- `context.logger` → logger con `.info()`, `.warn()`, `.error()`

---

## Paso 5 — Registrar el router

**Archivo:** `src/server/router.ts`

```typescript
import miModuloRouter from './routers/mi-modulo';

export const router = {
  // ...existentes
  miModulo: miModuloRouter,
};
```

---

## Paso 6 — Componente de formulario

**Archivo:** `src/features/<modulo>/manager/form-<modulo>.tsx`

```typescript
import { useFormContext } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { FormField, FormFieldController, FormFieldLabel } from '@/components/form';
import { FormFieldsMiModelo } from '@/features/<modulo>/schema';

export const FormMiModelo = () => {
  const { t } = useTranslation(['mi-modulo']);
  const form = useFormContext<FormFieldsMiModelo>();

  return (
    <div className="flex flex-col gap-4">
      <FormField>
        <FormFieldLabel>{t('mi-modulo:common.campo1.label')}</FormFieldLabel>
        <FormFieldController type="text" control={form.control} name="campo1" />
      </FormField>
    </div>
  );
};
```

**Tipos de `FormFieldController`:** `text`, `email`, `tel`, `date`, `number`, `password`, `textarea`, `select`, `checkbox`.

---

## Paso 7 — Componente de página

**Archivo:** `src/features/<modulo>/manager/page-<modulo>-update.tsx`

```typescript
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';
import { BackButton } from '@/components/back-button';
import { Form } from '@/components/form';
import { PreventNavigation } from '@/components/prevent-navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FormMiModelo } from './form-mi-modulo';
import { FormFieldsMiModelo, zFormFieldsMiModelo } from '@/features/<modulo>/schema';
import { PageLayout, PageLayoutContent, PageLayoutTopBar, PageLayoutTopBarTitle } from '@/layout/manager/page-layout';

export const PageMiModuloUpdate = (props: { params: { id: string } }) => {
  const { t } = useTranslation(['mi-modulo']);
  const { navigateBack } = useNavigateBack();
  const queryClient = useQueryClient();

  const query = useQuery(
    orpc.miModulo.getById.queryOptions({ input: { id: props.params.id } })
  );

  const form = useForm<FormFieldsMiModelo>({
    resolver: zodResolver(zFormFieldsMiModelo()),
    values: { campo1: query.data?.campo1 ?? null },
  });

  const update = useMutation(
    orpc.miModulo.updateById.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.miModulo.getById.key({ input: { id: props.params.id } }),
        });
        toast.success(t('mi-modulo:manager.update.saveSuccess'));
        navigateBack({ ignoreBlocker: true });
      },
      onError: () => toast.error(t('mi-modulo:manager.update.saveError')),
    })
  );

  return (
    <>
      <PreventNavigation shouldBlock={form.formState.isDirty} />
      <Form {...form} onSubmit={(values) => update.mutate({ id: props.params.id, ...values })}>
        <PageLayout>
          <PageLayoutTopBar
            startActions={<BackButton />}
            endActions={
              <Button size="sm" type="submit" loading={update.isPending}>
                {t('mi-modulo:manager.update.saveButton.label')}
              </Button>
            }
          >
            <PageLayoutTopBarTitle>{t('mi-modulo:manager.update.title')}</PageLayoutTopBarTitle>
          </PageLayoutTopBar>
          <PageLayoutContent containerClassName="py-4">
            <Card>
              <CardContent><FormMiModelo /></CardContent>
            </Card>
          </PageLayoutContent>
        </PageLayout>
      </Form>
    </>
  );
};
```

---

## Paso 8 — Rutas TanStack Router

**Archivo:** `src/routes/manager/<entidad>/$id.<modulo>.index.tsx`

```typescript
import { createFileRoute } from '@tanstack/react-router';
import { PageMiModuloUpdate } from '@/features/<modulo>/manager/page-<modulo>-update';

export const Route = createFileRoute('/manager/<entidad>/$id/<modulo>/')({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return <PageMiModuloUpdate params={params} />;
}
```

**Convenciones de nombres de archivo → URL:**
| Archivo | URL generada |
|---|---|
| `index.tsx` | `/manager/entidad/` |
| `new.index.tsx` | `/manager/entidad/new` |
| `$id.index.tsx` | `/manager/entidad/:id` |
| `$id.update.index.tsx` | `/manager/entidad/:id/update` |
| `$id.mi-modulo.index.tsx` | `/manager/entidad/:id/mi-modulo` |

---

## Paso 9 — Traducciones

**Archivos:** `src/locales/en/<modulo>.json` y `src/locales/es/<modulo>.json`

```json
{
  "common": {
    "campo1": { "label": "Campo 1", "required": "Campo 1 es requerido" },
    "campo2": { "label": "Campo 2" }
  },
  "manager": {
    "list": {
      "title": "Mi Módulo",
      "newButton": "Nuevo",
      "loadMore": "Cargar más",
      "showing": "Mostrando {{count}} de {{total}}"
    },
    "update": {
      "title": "Editar",
      "cardTitle": "Información",
      "saveButton": { "label": "Guardar" },
      "saveSuccess": "Guardado correctamente",
      "saveError": "Error al guardar"
    },
    "new": {
      "title": "Nuevo",
      "createButton": { "label": "Crear" },
      "createError": "Error al crear"
    }
  }
}
```

Registrar en los índices de locales:

**`src/locales/en/index.ts`** y **`src/locales/es/index.ts`**:
```typescript
import miModulo from './mi-modulo.json' with { type: 'json' };

export default {
  // ...existentes
  miModulo,
} as const;
```

---

## Checklist rápido

- [ ] `prisma/schema.prisma` — modelo + relación
- [ ] `pnpm db:push` — migrar DB
- [ ] `src/features/<modulo>/schema.ts` — schemas Zod
- [ ] `src/features/auth/permissions.ts` — statement + roles
- [ ] `src/features/role/schema.ts` — AVAILABLE_PERMISSIONS
- [ ] `src/server/routers/<modulo>.ts` — procedimientos ORPC
- [ ] `src/server/router.ts` — registrar router
- [ ] `src/features/<modulo>/manager/form-<modulo>.tsx` — formulario
- [ ] `src/features/<modulo>/manager/page-<modulo>-update.tsx` — página
- [ ] `src/routes/manager/...` — ruta TanStack
- [ ] `src/locales/en/<modulo>.json` + `es/<modulo>.json` — traducciones
- [ ] `src/locales/en/index.ts` + `es/index.ts` — registrar namespace

---

## Módulos de referencia

| Módulo | Tipo | Archivos clave |
|---|---|---|
| `user` | CRUD completo + sesiones | `src/features/user/`, `src/server/routers/user.ts` |
| `book` | CRUD + relación genre | `src/features/book/`, `src/server/routers/book.ts` |
| `role` | CRUD + permisos dinámicos | `src/features/role/`, `src/server/routers/role.ts` |
| `personal-data` | Upsert 1:1 con User | `src/features/personal-data/`, `src/server/routers/personal-data.ts` |
