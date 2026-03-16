import { createFileRoute } from '@tanstack/react-router';

import { PageRoleNew } from '@/features/role/manager/page-role-new';

export const Route = createFileRoute('/manager/roles/new/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <PageRoleNew />;
}
