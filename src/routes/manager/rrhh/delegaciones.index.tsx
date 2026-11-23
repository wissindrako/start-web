import { createFileRoute } from '@tanstack/react-router';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhDelegaciones } from '@/features/rrhh/manager/page-rrhh-delegaciones';

export const Route = createFileRoute('/manager/rrhh/delegaciones/')({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <WithPermissions
      permissions={[{ movilidad: ['read'] }]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhDelegaciones />
    </WithPermissions>
  );
}
