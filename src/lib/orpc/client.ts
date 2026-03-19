import { createORPCClient, onError, ORPCError } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { createORPCReactQueryUtils } from '@orpc/react-query';
import type { RouterClient } from '@orpc/server';

import { envClient } from '@/env/client';
import { openDemoModeDrawer } from '@/features/demo/demo-mode-drawer';

import type { Router } from './types';

const link = new RPCLink({
  url:
    typeof window === 'undefined'
      ? `${envClient.VITE_BASE_URL}/api/rpc`
      : `${window.location.origin}/api/rpc`,
  interceptors: [
    onError((error) => {
      if (error instanceof ORPCError && error.message === 'DEMO_MODE_ENABLED') {
        openDemoModeDrawer();
      }

      // When the server rejects the request due to auth (session revoked or
      // user banned), notify GuardAuthenticated to refetch the session so it
      // can show the appropriate screen (login redirect or banned page)
      // instead of a generic "unknown server error".
      if (
        error instanceof ORPCError &&
        (error.code === 'UNAUTHORIZED' || error.code === 'FORBIDDEN')
      ) {
        window.dispatchEvent(new CustomEvent('auth:session-invalid'));
      }
    }),
  ],
});

const orpcClient: RouterClient<Router> = createORPCClient(link);

export const orpc = createORPCReactQueryUtils(orpcClient);
