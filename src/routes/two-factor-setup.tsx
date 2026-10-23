import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useEffect } from 'react';

import { PageError } from '@/components/errors/page-error';
import { Spinner } from '@/components/ui/spinner';

import { authClient, takeSignedOAuthQuery } from '@/features/auth/client';
import { PageTwoFactorSetup } from '@/features/auth/page-two-factor-setup';

// Where the authorization flow of an external system sends users who must
// set up two-factor authentication first (oauthProvider's postLogin)
export const Route = createFileRoute('/two-factor-setup')({
  component: RouteComponent,
  errorComponent: () => <PageError type="error-boundary" />,
});

function RouteComponent() {
  const session = authClient.useSession();
  const router = useRouter();
  // Taken off the URL: requests made while setting it up must not resume
  // the flow (an effect, since it rewrites the URL the router listens to)
  useEffect(() => {
    takeSignedOAuthQuery();
  }, []);

  const signedOut = !session.isPending && !session.data?.user;
  useEffect(() => {
    if (signedOut) router.navigate({ to: '/login', replace: true });
  }, [signedOut, router]);

  if (session.isPending || signedOut) {
    return <Spinner full className="opacity-60" />;
  }

  return (
    <PageTwoFactorSetup
      onDone={async () => {
        const signedQuery = takeSignedOAuthQuery();
        if (!signedQuery) {
          await router.navigate({ to: '/', replace: true });
          return;
        }
        // Back to the authorization, which now goes on to the system
        const { data, error } = await authClient.$fetch<{
          redirect?: boolean;
          url?: string;
        }>('/oauth2/continue', {
          method: 'POST',
          body: { postLogin: true, oauth_query: signedQuery },
        });
        if (error || !data?.url) throw error ?? new Error('No redirect');
        window.location.href = data.url;
      }}
    />
  );
}
