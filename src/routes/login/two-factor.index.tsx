import { createFileRoute } from '@tanstack/react-router';
import { fallback, zodValidator } from '@tanstack/zod-adapter';
import { z } from 'zod';

import PageLoginTwoFactor from '@/features/auth/page-login-two-factor';

export const Route = createFileRoute('/login/two-factor/')({
  component: RouteComponent,
  validateSearch: zodValidator(
    z.object({
      redirect: fallback(z.string(), '').optional(),
    })
  ),
});

function RouteComponent() {
  return <PageLoginTwoFactor />;
}
