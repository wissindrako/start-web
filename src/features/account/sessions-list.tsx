import { useMutation, useQuery } from '@tanstack/react-query';
import { MonitorIcon, SmartphoneIcon, XIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { authClient } from '@/features/auth/client';

function parseUserAgent(ua: string | null | undefined): {
  browser: string;
  os: string;
  isMobile: boolean;
} {
  if (!ua) return { browser: 'Unknown', os: 'Unknown', isMobile: false };

  const isMobile = /Mobile|Android|iPhone|iPad/i.test(ua);

  let browser = 'Unknown';
  if (/Edg\//i.test(ua)) browser = 'Edge';
  else if (/OPR\/|Opera\//i.test(ua)) browser = 'Opera';
  else if (/Chrome\//i.test(ua)) browser = 'Chrome';
  else if (/Firefox\//i.test(ua)) browser = 'Firefox';
  else if (/Safari\//i.test(ua) && /Version\//i.test(ua)) browser = 'Safari';

  let os = 'Unknown';
  if (/Windows NT 10\.0/i.test(ua)) os = 'Windows 10/11';
  else if (/Windows/i.test(ua)) os = 'Windows';
  else if (/Mac OS X/i.test(ua)) os = 'macOS';
  else if (/Android/i.test(ua)) os = 'Android';
  else if (/iPhone/i.test(ua)) os = 'iPhone';
  else if (/iPad/i.test(ua)) os = 'iPad';
  else if (/Linux/i.test(ua)) os = 'Linux';

  return { browser, os, isMobile };
}

export const SessionsList = () => {
  const { t } = useTranslation(['account']);
  const session = authClient.useSession();
  const currentSessionToken = session.data?.session?.token;

  const sessionsQuery = useQuery({
    queryKey: ['account', 'sessions'],
    queryFn: async () => {
      const result = await authClient.listSessions();
      if (result.error) throw result.error;
      return result.data ?? [];
    },
  });

  const revokeSession = useMutation({
    mutationFn: async (token: string) => {
      const result = await authClient.revokeSession({ token });
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      sessionsQuery.refetch();
      toast.success(t('account:sessions.revokeSuccess'));
    },
    onError: () => toast.error(t('account:sessions.revokeError')),
  });

  const revokeOtherSessions = useMutation({
    mutationFn: async () => {
      const result = await authClient.revokeOtherSessions();
      if (result.error) throw result.error;
    },
    onSuccess: () => {
      sessionsQuery.refetch();
      toast.success(t('account:sessions.revokeOthersSuccess'));
    },
    onError: () => toast.error(t('account:sessions.revokeOthersError')),
  });

  // listSessions returns flat session objects: { id, token, userAgent, ipAddress, ... }
  const sessions = sessionsQuery.data ?? [];
  const hasOtherSessions = sessions.some(
    (s) => s.token !== currentSessionToken
  );

  if (sessionsQuery.isLoading) {
    return (
      <div className="flex flex-col gap-2">
        <Skeleton className="h-14 rounded-lg" />
        <Skeleton className="h-14 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => {
          const { browser, os, isMobile } = parseUserAgent(s.userAgent);
          const isCurrent = s.token === currentSessionToken;
          const isRevoking =
            revokeSession.isPending && revokeSession.variables === s.token;

          return (
            <li
              key={s.id}
              className="flex items-center gap-3 rounded-lg border px-3 py-2.5"
            >
              <div className="text-muted-foreground">
                {isMobile ? (
                  <SmartphoneIcon className="size-4" />
                ) : (
                  <MonitorIcon className="size-4" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-sm font-medium">
                    {browser} · {os}
                  </span>
                  {isCurrent && (
                    <Badge variant="secondary" size="xs">
                      {t('account:sessions.current')}
                    </Badge>
                  )}
                </div>
                {s.ipAddress && (
                  <p className="text-xs text-muted-foreground">{s.ipAddress}</p>
                )}
              </div>
              {!isCurrent && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  onClick={() => revokeSession.mutate(s.token)}
                  loading={isRevoking}
                  aria-label={t('account:sessions.revokeAriaLabel')}
                >
                  <XIcon />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {hasOtherSessions && (
        <Button
          variant="outline"
          size="sm"
          className="self-start"
          onClick={() => revokeOtherSessions.mutate()}
          loading={revokeOtherSessions.isPending}
        >
          {t('account:sessions.revokeOthers')}
        </Button>
      )}
    </div>
  );
};
