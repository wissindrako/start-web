import { createFileRoute } from '@tanstack/react-router';

import { PageInvitations } from '@/features/invitation/manager/page-invitations';

export const Route = createFileRoute('/manager/users/invitations/')({
  component: RouteComponent,
});

function RouteComponent() {
  return <PageInvitations />;
}
