import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhOrganigrama } from '@/features/rrhh/manager/page-rrhh-organigrama';

export const Route = createFileRoute('/manager/rrhh/organigrama/')({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({ fecha: z.string().optional() })),
});

function RouteComponent() {
  const { fecha } = Route.useSearch();
  return (
    <WithPermissions
      permissions={[{ organizacion: ['read'] }]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhOrganigrama fecha={fecha} />
    </WithPermissions>
  );
}
