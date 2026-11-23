import { createFileRoute } from '@tanstack/react-router';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhImportar } from '@/features/rrhh/manager/page-rrhh-importar';

export const Route = createFileRoute('/manager/rrhh/importar/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <WithPermissions
      permissions={[
        {
          persona: ['update'],
          organizacion: ['update'],
          movilidad: ['update'],
        },
      ]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhImportar />
    </WithPermissions>
  );
}
