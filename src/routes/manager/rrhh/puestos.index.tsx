import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhPuestos } from '@/features/rrhh/manager/page-rrhh-puestos';

export const Route = createFileRoute('/manager/rrhh/puestos/')({
  component: RouteComponent,
  validateSearch: zodValidator(
    z.object({
      dependenciaId: z.string().optional(),
      fecha: z.string().optional(),
      vacantes: z.boolean().optional(),
    })
  ),
});

function RouteComponent() {
  const search = Route.useSearch();
  return (
    <WithPermissions
      permissions={[{ organizacion: ['read'] }]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhPuestos search={search} />
    </WithPermissions>
  );
}
