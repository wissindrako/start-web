import { createFileRoute } from '@tanstack/react-router';

import { PageExternalSystemUpdate } from '@/features/external-system/manager/page-external-system-update';

export const Route = createFileRoute('/manager/external-systems/$id/update/')({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return <PageExternalSystemUpdate params={params} />;
}
