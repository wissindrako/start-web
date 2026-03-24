import { getUiState } from '@bearstudio/ui-state';
import { zodResolver } from '@hookform/resolvers/zod';
import { ORPCError } from '@orpc/client';
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import dayjs from 'dayjs';
import {
  AlertCircleIcon,
  BanIcon,
  ContactIcon,
  PencilLineIcon,
  ShieldCheckIcon,
  Trash2Icon,
} from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { z } from 'zod';

import { orpc } from '@/lib/orpc/client';
import { useNavigateBack } from '@/hooks/use-navigate-back';

import { BackButton } from '@/components/back-button';
import { PageError } from '@/components/errors/page-error';
import {
  Form,
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import {
  DataList,
  DataListCell,
  DataListEmptyState,
  DataListErrorState,
  DataListLoadingState,
  DataListRow,
  DataListText,
} from '@/components/ui/datalist';
import {
  ResponsiveDrawer,
  ResponsiveDrawerContent,
  ResponsiveDrawerDescription,
  ResponsiveDrawerFooter,
  ResponsiveDrawerHeader,
  ResponsiveDrawerTitle,
} from '@/components/ui/responsive-drawer';
import { ResponsiveIconButton } from '@/components/ui/responsive-icon-button';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';

import { authClient } from '@/features/auth/client';
import { WithPermissions } from '@/features/auth/with-permission';
import { TIPO_DOCUMENTO_OPTIONS } from '@/features/personal-data/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageUser = (props: { params: { id: string } }) => {
  const queryClient = useQueryClient();
  const { navigateBack } = useNavigateBack();
  const session = authClient.useSession();
  const { t } = useTranslation(['user']);
  const userQuery = useQuery(
    orpc.user.getById.queryOptions({
      input: { id: props.params.id },
    })
  );

  const deleteUser = async () => {
    try {
      await orpc.user.deleteById.call({ id: props.params.id });
      await Promise.all([
        // Invalidate users list
        queryClient.invalidateQueries({
          queryKey: orpc.user.getAll.key(),
          type: 'all',
        }),
        // Remove user from cache
        queryClient.removeQueries({
          queryKey: orpc.user.getById.key({ input: { id: props.params.id } }),
        }),
      ]);

      toast.success(t('user:manager.detail.userDeleted'));

      // Redirect
      navigateBack();
    } catch {
      toast.error(t('user:manager.detail.deleteError'));
    }
  };

  const ui = getUiState((set) => {
    if (userQuery.status === 'pending') return set('pending');
    if (
      userQuery.status === 'error' &&
      userQuery.error instanceof ORPCError &&
      userQuery.error.code === 'NOT_FOUND'
    )
      return set('not-found');
    if (userQuery.status === 'error') return set('error');

    return set('default', { user: userQuery.data });
  });

  return (
    <PageLayout>
      <PageLayoutTopBar
        startActions={<BackButton />}
        endActions={
          <>
            {session.data?.user.id !== props.params.id && (
              <>
                <WithPermissions permissions={[{ user: ['update'] }]}>
                  {ui.when('default', ({ user }) => (
                    <BanUserButton
                      userId={props.params.id}
                      userName={user.name ?? user.email ?? '--'}
                      banned={!!user.banned}
                    />
                  ))}
                </WithPermissions>
                <WithPermissions permissions={[{ user: ['delete'] }]}>
                  <ConfirmResponsiveDrawer
                    onConfirm={() => deleteUser()}
                    title={t('user:manager.detail.confirmDeleteTitle', {
                      user:
                        userQuery.data?.name ?? userQuery.data?.email ?? '--',
                    })}
                    description={t(
                      'user:manager.detail.confirmDeleteDescription'
                    )}
                    confirmText={t('user:manager.detail.deleteButton.label')}
                    confirmVariant="destructive"
                  >
                    <ResponsiveIconButton
                      variant="ghost"
                      label={t('user:manager.detail.deleteButton.label')}
                      size="sm"
                    >
                      <Trash2Icon />
                    </ResponsiveIconButton>
                  </ConfirmResponsiveDrawer>
                </WithPermissions>
              </>
            )}
          </>
        }
      >
        <PageLayoutTopBarTitle>
          {ui
            .match('pending', () => <Skeleton className="h-4 w-48" />)
            .match(['not-found', 'error'], () => (
              <AlertCircleIcon className="size-4 text-muted-foreground" />
            ))
            .match('default', ({ user }) => <>{user.name || user.email}</>)
            .exhaustive()}
        </PageLayoutTopBarTitle>
      </PageLayoutTopBar>
      <PageLayoutContent>
        {ui
          .match('pending', () => <Spinner full />)
          .match('not-found', () => <PageError type="404" />)
          .match('error', () => <PageError type="unknown-server-error" />)
          .match('default', ({ user }) => (
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
              <Card className="relative flex-1">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage
                        src={user.image ?? undefined}
                        alt={user.name ?? ''}
                      />
                      <AvatarFallback variant="boring" name={user.name ?? ''} />
                    </Avatar>
                    <div className="flex flex-1 flex-col gap-0.5">
                      <CardTitle>
                        {user.name || (
                          <span className="text-xs text-muted-foreground">
                            {t('user:common.name.notAvailable')}
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{user.email}</CardDescription>
                    </div>
                    <WithPermissions permissions={[{ user: ['update'] }]}>
                      <Link
                        to="/manager/users/$id/update"
                        params={props.params}
                        className="-m-2 self-start"
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          render={<span />}
                          nativeButton={false}
                        >
                          <PencilLineIcon />
                          <span className="sr-only">
                            {t('user:manager.detail.editUser')}
                          </span>
                        </Button>
                        <span className="absolute inset-0" />
                      </Link>
                    </WithPermissions>
                    <WithPermissions permissions={[{ personalData: ['read'] }]}>
                      <Link
                        to="/manager/users/$id/personal-data"
                        params={props.params}
                        className="-m-2 self-start"
                      >
                        <Button
                          size="icon-sm"
                          variant="ghost"
                          render={<span />}
                          nativeButton={false}
                        >
                          <ContactIcon />
                          <span className="sr-only">
                            {t('user:manager.detail.personalDataButton')}
                          </span>
                        </Button>
                      </Link>
                    </WithPermissions>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="flex items-center gap-4">
                    <Badge
                      variant={user.role === 'admin' ? 'default' : 'secondary'}
                    >
                      {user.role ?? '-'}
                    </Badge>
                    {user.banned && (
                      <Badge variant="negative">
                        {t('user:manager.detail.bannedBadge')}
                      </Badge>
                    )}
                    <p className="text-sm text-muted-foreground">
                      {user.verifiedAt ? (
                        <>
                          {t('user:common.verifiedStatus.verifiedAt', {
                            time: dayjs(user.verifiedAt).format(
                              'DD/MM/YYYY [at] HH:mm'
                            ),
                          })}
                        </>
                      ) : (
                        <>{t('user:common.verifiedStatus.notVerified')}</>
                      )}
                    </p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex min-w-0 flex-2 flex-col gap-4">
                <WithPermissions permissions={[{ personalData: ['read'] }]}>
                  <PersonalDataCard userId={props.params.id} />
                </WithPermissions>
                <WithPermissions permissions={[{ session: ['list'] }]}>
                  <UserSessions userId={props.params.id} />
                </WithPermissions>
              </div>
            </div>
          ))
          .exhaustive()}
      </PageLayoutContent>
    </PageLayout>
  );
};

const PersonalDataCard = (props: { userId: string }) => {
  const { t } = useTranslation(['personal-data', 'user']);
  const personalDataQuery = useQuery(
    orpc.personalData.getByUserId.queryOptions({
      input: { userId: props.userId },
    })
  );

  const data = personalDataQuery.data;
  if (personalDataQuery.isPending) return null;
  if (!data) return null;

  const rows: { label: string; value: string | null | undefined }[] = [
    {
      label: t('personal-data:common.nombre.label'),
      value:
        [data.nombre, data.primerApellido, data.segundoApellido]
          .filter(Boolean)
          .join(' ') || null,
    },
    {
      label: t('personal-data:common.tipoDocumento.label'),
      value: TIPO_DOCUMENTO_OPTIONS.includes(data.tipoDocumento as never)
        ? t(`personal-data:common.tipoDocumento.options.${data.tipoDocumento}`)
        : data.tipoDocumento,
    },
    {
      label: t('personal-data:common.numeroDocumento.label'),
      value: data.numeroDocumento,
    },
    {
      label: t('personal-data:common.fechaNacimiento.label'),
      value: data.fechaNacimiento
        ? dayjs(data.fechaNacimiento).format('DD/MM/YYYY')
        : null,
    },
    {
      label: t('personal-data:common.genero.label'),
      value: data.genero
        ? t(`personal-data:common.genero.options.${data.genero}`)
        : null,
    },
    { label: t('personal-data:common.telefono.label'), value: data.telefono },
    {
      label: t('personal-data:common.telefonoAlternativo.label'),
      value: data.telefonoAlternativo,
    },
    { label: t('personal-data:common.pais.label'), value: data.pais },
    {
      label: t('personal-data:common.departamento.label'),
      value: data.departamento,
    },
    { label: t('personal-data:common.ciudad.label'), value: data.ciudad },
    { label: t('personal-data:common.direccion.label'), value: data.direccion },
    {
      label: t('personal-data:common.codigoPostal.label'),
      value: data.codigoPostal,
    },
  ].filter((r) => r.value);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">
          {t('user:manager.detail.personalDataTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {rows.map((row) => (
            <div key={row.label}>
              <dt className="text-xs text-muted-foreground">{row.label}</dt>
              <dd className="text-sm">{row.value}</dd>
            </div>
          ))}
        </dl>
      </CardContent>
    </Card>
  );
};

const UserSessions = (props: { userId: string }) => {
  const { t } = useTranslation(['user']);
  const sessionsQuery = useInfiniteQuery(
    orpc.user.getUserSessions.infiniteOptions({
      input: (cursor: string | undefined) => ({
        userId: props.userId,
        cursor,
        limit: 5,
      }),
      maxPages: 10,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );

  const ui = getUiState((set) => {
    if (sessionsQuery.status === 'pending') return set('pending');
    if (sessionsQuery.status === 'error') return set('error');

    const items = sessionsQuery.data?.pages.flatMap((p) => p.items) ?? [];
    if (!items.length) return set('empty');
    return set('default', {
      items,
    });
  });

  return (
    <WithPermissions permissions={[{ session: ['list'] }]}>
      <DataList>
        <DataListRow>
          <DataListCell>
            <h2 className="text-sm font-medium">
              {t('user:manager.detail.userSessions')}
            </h2>
          </DataListCell>

          <WithPermissions permissions={[{ session: ['revoke'] }]}>
            <DataListCell className="flex-none">
              {ui.when('default', () => (
                <RevokeAllSessionsButton userId={props.userId} />
              ))}
            </DataListCell>
          </WithPermissions>
        </DataListRow>
        {ui
          .match('pending', () => <DataListLoadingState />)
          .match('error', () => (
            <DataListErrorState retry={() => sessionsQuery.refetch()} />
          ))
          .match('empty', () => (
            <DataListEmptyState className="min-h-20">
              {t('user:manager.detail.noSessions')}
            </DataListEmptyState>
          ))
          .match('default', ({ items }) => (
            <>
              {items.map((item) => (
                <DataListRow
                  key={item.id}
                  className="max-md:flex-col max-md:py-2 max-md:[&>div]:py-1"
                >
                  <DataListCell>
                    <DataListText>
                      {t('user:manager.detail.session', { token: item.token })}
                    </DataListText>
                  </DataListCell>
                  <DataListCell>
                    <DataListText className="text-muted-foreground">
                      {t('user:manager.detail.sessionUpdated', {
                        time: dayjs(item.updatedAt).fromNow(),
                      })}
                    </DataListText>
                  </DataListCell>
                  <DataListCell>
                    <DataListText className="text-muted-foreground">
                      {t('user:manager.detail.sessionExpires', {
                        time: dayjs().to(item.expiresAt),
                      })}
                    </DataListText>
                  </DataListCell>
                  <WithPermissions permissions={[{ session: ['revoke'] }]}>
                    <DataListCell className="flex-none">
                      <RevokeSessionButton
                        userId={props.userId}
                        sessionToken={item.token}
                      />
                    </DataListCell>
                  </WithPermissions>
                </DataListRow>
              ))}
              <DataListRow>
                <DataListCell className="flex-none">
                  <Button
                    size="xs"
                    variant="secondary"
                    disabled={!sessionsQuery.hasNextPage}
                    onClick={() => sessionsQuery.fetchNextPage()}
                    loading={sessionsQuery.isFetchingNextPage}
                  >
                    {t('user:manager.list.loadMore')}
                  </Button>
                </DataListCell>
                <DataListCell>
                  <DataListText className="text-xs text-muted-foreground">
                    {t('user:manager.list.showing', {
                      count: items.length,
                      total: sessionsQuery.data?.pages[0]?.total,
                    })}
                  </DataListText>
                </DataListCell>
              </DataListRow>
            </>
          ))
          .exhaustive()}
      </DataList>
    </WithPermissions>
  );
};

const RevokeAllSessionsButton = (props: { userId: string }) => {
  const queryClient = useQueryClient();
  const currentSession = authClient.useSession();
  const { t } = useTranslation(['user']);
  const revokeAllSessions = useMutation(
    orpc.user.revokeUserSessions.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getUserSessions.key({
            input: { userId: props.userId },
            type: 'infinite',
          }),
        });
      },
      onError: () => {
        toast.error(t('user:manager.detail.revokeAllError'));
      },
    })
  );

  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={currentSession.data?.user.id === props.userId}
      loading={revokeAllSessions.isPending}
      onClick={() => {
        revokeAllSessions.mutate({
          id: props.userId,
        });
      }}
    >
      {t('user:manager.detail.revokeAllSessions')}
    </Button>
  );
};

const RevokeSessionButton = (props: {
  userId: string;
  sessionToken: string;
}) => {
  const queryClient = useQueryClient();
  const currentSession = authClient.useSession();
  const { t } = useTranslation(['user']);
  const revokeSession = useMutation(
    orpc.user.revokeUserSession.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getUserSessions.key({
            input: { userId: props.userId },
            type: 'infinite',
          }),
        });
      },
      onError: () => {
        toast.error(t('user:manager.detail.revokeError'));
      },
    })
  );
  return (
    <Button
      size="xs"
      variant="secondary"
      disabled={currentSession.data?.session.token === props.sessionToken}
      loading={revokeSession.isPending}
      onClick={() => {
        revokeSession.mutate({
          id: props.userId,
          sessionToken: props.sessionToken,
        });
      }}
    >
      {t('user:manager.detail.revokeSession')}
    </Button>
  );
};

const zBanForm = () =>
  z.object({
    reason: z.string().optional(),
    banExpires: z.date().optional(),
  });
type BanFormFields = z.infer<ReturnType<typeof zBanForm>>;

const BanUserButton = (props: {
  userId: string;
  userName: string;
  banned: boolean;
}) => {
  const queryClient = useQueryClient();
  const { t } = useTranslation(['user']);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<BanFormFields>({
    resolver: zodResolver(zBanForm()),
    defaultValues: { reason: '', banExpires: undefined },
  });

  const banUser = useMutation(
    orpc.user.banUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getById.key({ input: { id: props.userId } }),
        });
        toast.success(t('user:manager.detail.banned'));
        setIsOpen(false);
        form.reset();
      },
      onError: () => {
        toast.error(t('user:manager.detail.banError'));
      },
    })
  );

  const unbanUser = useMutation(
    orpc.user.unbanUser.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getById.key({ input: { id: props.userId } }),
        });
        toast.success(t('user:manager.detail.unbanned'));
        setIsOpen(false);
      },
      onError: () => {
        toast.error(t('user:manager.detail.unbanError'));
      },
    })
  );

  const handleConfirm = form.handleSubmit((values) => {
    banUser.mutate({
      id: props.userId,
      reason: values.reason || undefined,
      banExpires: values.banExpires,
    });
  });

  const isPending = banUser.isPending || unbanUser.isPending;

  return (
    <>
      <ResponsiveIconButton
        variant="ghost"
        label={
          props.banned
            ? t('user:manager.detail.unbanButton')
            : t('user:manager.detail.banButton')
        }
        size="sm"
        loading={isPending}
        onClick={() => setIsOpen(true)}
      >
        {props.banned ? <ShieldCheckIcon /> : <BanIcon />}
      </ResponsiveIconButton>

      <ResponsiveDrawer open={isOpen} onOpenChange={setIsOpen}>
        <ResponsiveDrawerContent className="sm:max-w-sm">
          <ResponsiveDrawerHeader>
            <ResponsiveDrawerTitle>
              {props.banned
                ? t('user:manager.detail.confirmUnbanTitle', {
                    user: props.userName,
                  })
                : t('user:manager.detail.confirmBanTitle', {
                    user: props.userName,
                  })}
            </ResponsiveDrawerTitle>
            <ResponsiveDrawerDescription>
              {props.banned
                ? t('user:manager.detail.confirmUnbanDescription')
                : t('user:manager.detail.confirmBanDescription')}
            </ResponsiveDrawerDescription>
          </ResponsiveDrawerHeader>

          {!props.banned && (
            <Form {...form}>
              <div className="flex flex-col gap-4 px-4 pb-2 sm:px-6">
                <FormField>
                  <FormFieldLabel>
                    {t('user:manager.detail.banReasonLabel')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="textarea"
                    control={form.control}
                    name="reason"
                    placeholder={t('user:manager.detail.banReasonPlaceholder')}
                    rows={3}
                  />
                </FormField>
                <FormField>
                  <FormFieldLabel>
                    {t('user:manager.detail.banExpiresLabel')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="date"
                    control={form.control}
                    name="banExpires"
                  />
                </FormField>
              </div>
            </Form>
          )}

          <ResponsiveDrawerFooter>
            <Button
              variant="secondary"
              className="max-sm:w-full"
              onClick={() => {
                setIsOpen(false);
                form.reset();
              }}
            >
              {t('user:manager.detail.cancelButton')}
            </Button>
            <Button
              variant={props.banned ? 'default' : 'destructive'}
              className="max-sm:w-full"
              loading={isPending}
              onClick={() => {
                if (props.banned) {
                  unbanUser.mutate({ id: props.userId });
                } else {
                  handleConfirm();
                }
              }}
            >
              {props.banned
                ? t('user:manager.detail.unbanButton')
                : t('user:manager.detail.banButton')}
            </Button>
          </ResponsiveDrawerFooter>
        </ResponsiveDrawerContent>
      </ResponsiveDrawer>
    </>
  );
};
