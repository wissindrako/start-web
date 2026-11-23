import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhPersonal } from '@/features/rrhh/manager/page-rrhh-personal';

export const Route = createFileRoute('/manager/rrhh/personal/')({
  component: RouteComponent,
  validateSearch: zodValidator(
    z.object({
      busqueda: z.string().optional(),
      dependenciaId: z.string().optional(),
      fecha: z.string().optional(),
      todos: z.boolean().optional(),
    })
  ),
});

function RouteComponent() {
  const search = Route.useSearch();
  return (
    <WithPermissions
      permissions={[{ persona: ['read'] }]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhPersonal search={search} />
    </WithPermissions>
  );
}
