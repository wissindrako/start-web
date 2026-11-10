import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  KeyRoundIcon,
  MailIcon,
  ServerIcon,
  ShieldCheckIcon,
  UsersIcon,
} from 'lucide-react';
import { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import { PageError } from '@/components/errors/page-error';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

const Stat = (props: {
  label: string;
  value: number;
  detail?: string;
  icon: ReactNode;
}) => (
  <Card className="gap-1 py-4">
    <CardContent className="flex flex-col gap-1 px-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {props.icon}
        {props.label}
      </div>
      <div className="text-2xl font-semibold tabular-nums">{props.value}</div>
      {!!props.detail && (
        <div className="text-xs text-muted-foreground">{props.detail}</div>
      )}
    </CardContent>
  </Card>
);

const StatusRow = (props: { label: string; value: string; ok: boolean }) => (
  <div className="flex items-center justify-between gap-3 py-1.5 text-sm">
    <span className="text-muted-foreground">{props.label}</span>
    <Badge variant={props.ok ? 'positive' : 'warning'}>{props.value}</Badge>
  </div>
);

export const PageDashboard = () => {
  const { t } = useTranslation(['dashboard']);
  const query = useQuery(orpc.dashboard.summary.queryOptions());
  const data = query.data;

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>{t('dashboard:title')}</PageLayoutTopBarTitle>
      </PageLayoutTopBar>
      <PageLayoutContent containerClassName="max-w-5xl">
        {query.isError && <PageError type="unknown-server-error" />}
        {query.isPending && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 8 }, (_, index) => (
              <Skeleton key={index} className="h-24" />
            ))}
          </div>
        )}
        {!!data && (
          <div className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {!!data.users && (
                <>
                  <Stat
                    icon={<UsersIcon className="size-3.5" />}
                    label={t('dashboard:users.total')}
                    value={data.users.total}
                    detail={t('dashboard:users.totalDetail', {
                      verified: data.users.verified,
                      recent: data.users.newLast30Days,
                    })}
                  />
                  <Stat
                    icon={<KeyRoundIcon className="size-3.5" />}
                    label={t('dashboard:users.sessions')}
                    value={data.users.activeSessions}
                    detail={t('dashboard:users.sessionsDetail', {
                      count: data.users.activeUsers,
                    })}
                  />
                  <Stat
                    icon={<MailIcon className="size-3.5" />}
                    label={t('dashboard:users.invitations')}
                    value={data.users.pendingInvitations}
                  />
                  <Stat
                    icon={<ShieldCheckIcon className="size-3.5" />}
                    label={t('dashboard:users.twoFactor')}
                    value={data.users.twoFactor}
                    detail={
                      data.users.banned
                        ? t('dashboard:users.banned', {
                            count: data.users.banned,
                          })
                        : undefined
                    }
                  />
                </>
              )}
              {!!data.systems && (
                <Stat
                  icon={<ServerIcon className="size-3.5" />}
                  label={t('dashboard:systems.total')}
                  value={data.systems.length}
                />
              )}
              {!!data.roles && (
                <Stat
                  icon={<ShieldCheckIcon className="size-3.5" />}
                  label={t('dashboard:roles.total')}
                  value={data.roles.local + data.roles.external}
                  detail={t('dashboard:roles.detail', {
                    local: data.roles.local,
                    external: data.roles.external,
                  })}
                />
              )}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {!!data.systems && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dashboard:systems.title')}</CardTitle>
                    <CardDescription>
                      {t('dashboard:systems.description')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-col divide-y">
                    {!data.systems.length && (
                      <p className="text-sm text-muted-foreground">
                        {t('dashboard:systems.empty')}
                      </p>
                    )}
                    {data.systems.map((system) => (
                      <Link
                        key={system.id}
                        to="/manager/external-systems/$id/update"
                        params={{ id: system.id }}
                        className="flex flex-col gap-1 py-2 hover:opacity-80"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium">
                            {system.label ?? system.name}
                          </span>
                          <Badge
                            size="xs"
                            variant={system.oidc ? 'positive' : 'secondary'}
                          >
                            {t('dashboard:systems.oidc')}
                          </Badge>
                          <Badge
                            size="xs"
                            variant={system.service ? 'positive' : 'secondary'}
                          >
                            {t('dashboard:systems.service')}
                          </Badge>
                        </div>
                        <span className="text-xs text-muted-foreground">
                          {t('dashboard:systems.detail', {
                            modules: system.modules,
                            roles: system.roles,
                          })}
                          {system.catalogSyncedAt
                            ? ' · ' +
                              t('dashboard:systems.synced', {
                                date: dayjs(system.catalogSyncedAt).format(
                                  'DD/MM/YYYY HH:mm'
                                ),
                              })
                            : ''}
                        </span>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>{t('dashboard:status.title')}</CardTitle>
                  <CardDescription>
                    {t('dashboard:status.description')}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col divide-y">
                  <StatusRow
                    label={t('dashboard:status.mail')}
                    ok={data.services.mail === 'smtp'}
                    value={t(
                      `dashboard:status.mailValues.${data.services.mail}`
                    )}
                  />
                  <StatusRow
                    label={t('dashboard:status.storage')}
                    ok={data.services.storage}
                    value={
                      data.services.storage
                        ? t('dashboard:status.storageOn')
                        : t('dashboard:status.storageOff')
                    }
                  />
                  <StatusRow
                    label={t('dashboard:status.signup')}
                    ok
                    value={
                      data.access.signupEnabled
                        ? t('dashboard:status.signupOpen')
                        : t('dashboard:status.signupInvite')
                    }
                  />
                  <StatusRow
                    label={t('dashboard:status.twoFactor')}
                    ok
                    value={t(
                      `dashboard:status.twoFactorValues.${data.access.twoFactorRequired}`
                    )}
                  />
                  <StatusRow
                    label={t('dashboard:status.domains')}
                    ok
                    value={
                      data.access.allowedDomains
                        ? t('dashboard:status.domainsCount', {
                            count: data.access.allowedDomains,
                          })
                        : t('dashboard:status.domainsAny')
                    }
                  />
                </CardContent>
              </Card>

              {!!data.users && (
                <Card>
                  <CardHeader>
                    <CardTitle>{t('dashboard:users.recentTitle')}</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col divide-y">
                    {data.users.recent.map((user) => (
                      <Link
                        key={user.id}
                        to="/manager/users/$id"
                        params={{ id: user.id }}
                        className="flex items-center justify-between gap-3 py-2 hover:opacity-80"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-medium">
                            {user.name || user.email}
                          </span>
                          <span className="truncate text-xs text-muted-foreground">
                            {user.email}
                          </span>
                        </div>
                        <span className="shrink-0 text-xs text-muted-foreground">
                          {dayjs(user.createdAt).format('DD/MM/YYYY')}
                        </span>
                      </Link>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
};
