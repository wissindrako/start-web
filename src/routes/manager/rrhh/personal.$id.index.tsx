import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { PageError } from '@/components/errors/page-error';

import { WithPermissions } from '@/features/auth/with-permission';
import { PageRrhhPersona } from '@/features/rrhh/manager/page-rrhh-persona';

export const Route = createFileRoute('/manager/rrhh/personal/$id/')({
  component: RouteComponent,
  validateSearch: zodValidator(z.object({ fecha: z.string().optional() })),
});

function RouteComponent() {
  const { id } = Route.useParams();
  const { fecha } = Route.useSearch();
  return (
    <WithPermissions
      permissions={[{ persona: ['read'] }]}
      fallback={<PageError type="403" />}
    >
      <PageRrhhPersona id={id} fecha={fecha} />
    </WithPermissions>
  );
}
