import { createFileRoute } from '@tanstack/react-router';

import { PageExternalSystemNew } from '@/features/external-system/manager/page-external-system-new';

export const Route = createFileRoute('/manager/external-systems/new/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <PageExternalSystemNew />;
}
