import { createFileRoute } from '@tanstack/react-router';

import { PageAccountPersonalData } from '@/features/account/app/page-account-personal-data';

export const Route = createFileRoute('/app/account/personal-data/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <PageAccountPersonalData />;
}
