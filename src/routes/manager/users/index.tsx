import { createFileRoute, stripSearchParams } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import { PageUsers } from '@/features/user/manager/page-users';

export const Route = createFileRoute('/manager/users/')({
  component: RouteComponent,
  validateSearch: zodValidator(
    z.object({
      searchTerm: z.string().prefault(''),
      roleId: z.string().optional(),
    })
  ),
  search: {
    middlewares: [stripSearchParams({ searchTerm: '', roleId: undefined })],
  },
});

function RouteComponent() {
  const search = Route.useSearch();
  return <PageUsers search={search} />;
}
