import { createFileRoute } from '@tanstack/react-router';

import { PageRole } from '@/features/role/manager/page-role';

export const Route = createFileRoute('/manager/roles/$id/')({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return <PageRole params={params} />;
}
