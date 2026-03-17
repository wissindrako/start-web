import { createFileRoute } from '@tanstack/react-router';

import { PagePersonalDataUpdate } from '@/features/personal-data/manager/page-personal-data-update';

export const Route = createFileRoute('/manager/users/$id/personal-data/')({
  component: RouteComponent,
});

function RouteComponent() {
  const params = Route.useParams();
  return <PagePersonalDataUpdate params={params} />;
}
