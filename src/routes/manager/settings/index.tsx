import { createFileRoute } from '@tanstack/react-router';

import { PageSystemConfig } from '@/features/system-config/manager/page-system-config';

export const Route = createFileRoute('/manager/settings/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <PageSystemConfig />;
}
