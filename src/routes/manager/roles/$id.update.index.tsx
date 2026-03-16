import { createFileRoute } from '@tanstack/react-router';

import { PageRoleUpdate } from '@/features/role/manager/page-role-update';

export const Route = createFileRoute('/manager/roles/$id/update/')({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return <PageRoleUpdate params={params} />;
}
