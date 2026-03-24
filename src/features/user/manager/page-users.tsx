import { getUiState } from '@bearstudio/ui-state';
import {
  useInfiniteQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import dayjs from 'dayjs';
import { BadgeCheckIcon, PlusIcon, RefreshCwIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ConfirmResponsiveDrawer } from '@/components/ui/confirm-responsive-drawer';
import {
  DataList,
  DataListCell,
  DataListEmptyState,
  DataListErrorState,
  DataListLoadingState,
  DataListRow,
  DataListRowResults,
  DataListText,
} from '@/components/ui/datalist';
import { ResponsiveIconButton } from '@/components/ui/responsive-icon-button';
import { ResponsiveIconButtonLink } from '@/components/ui/responsive-icon-button-link';
import { SearchButton } from '@/components/ui/search-button';
import { SearchInput } from '@/components/ui/search-input';

import { authClient } from '@/features/auth/client';
import { WithPermissions } from '@/features/auth/with-permission';
import { User } from '@/features/user/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

const getDisplayName = (user: User): string => {
  const { nombre, primerApellido, segundoApellido } = user.personalData ?? {};
  const fullName = [nombre, primerApellido, segundoApellido]
    .filter(Boolean)
    .join(' ');
  return fullName || user.name || user.email;
};

export const PageUsers = (props: { search: { searchTerm?: string } }) => {
  const { t } = useTranslation(['user']);
  const router = useRouter();

  const searchInputProps = {
    value: props.search.searchTerm ?? '',
    onChange: (value: string) =>
      router.navigate({
        to: '.',
        search: { searchTerm: value },
        replace: true,
      }),
  };

  const usersQuery = useInfiniteQuery(
    orpc.user.getAll.infiniteOptions({
      input: (cursor: string | undefined) => ({
        searchTerm: props.search.searchTerm,
        cursor,
      }),
      initialPageParam: undefined,
      maxPages: 10,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
    })
  );

  const ui = getUiState((set) => {
    if (usersQuery.status === 'pending') return set('pending');
    if (usersQuery.status === 'error') return set('error');
    const searchTerm = props.search.searchTerm;
    const items = usersQuery.data?.pages.flatMap((p) => p.items) ?? [];
    if (!items.length && searchTerm) {
      return set('empty-search', { searchTerm });
    }
    if (!items.length) return set('empty');
    return set('default', {
      items,
      searchTerm,
      total: usersQuery.data.pages[0]?.total ?? 0,
    });
  });

  return (
    <PageLayout>
      <PageLayoutTopBar
        endActions={
          <>
            <ResponsiveIconButton
              label={t('user:manager.list.refreshButton')}
              variant="ghost"
              size="sm"
              loading={usersQuery.isFetching}
              onClick={() => usersQuery.refetch()}
            >
              <RefreshCwIcon />
            </ResponsiveIconButton>
            <ResponsiveIconButtonLink
              label={t('user:manager.list.newButton')}
              variant="secondary"
              size="sm"
              to="/manager/users/new"
            >
              <PlusIcon />
            </ResponsiveIconButtonLink>
          </>
        }
      >
        <PageLayoutTopBarTitle>
          {t('user:manager.list.title')}
        </PageLayoutTopBarTitle>
        <SearchButton
          {...searchInputProps}
          className="-mx-2 md:hidden"
          size="icon-sm"
        />
        <SearchInput
          {...searchInputProps}
          size="sm"
          className="max-w-2xs max-md:hidden"
        />
      </PageLayoutTopBar>
      <PageLayoutContent className="pb-20">
        <DataList>
          {ui
            .match('pending', () => <DataListLoadingState />)
            .match('error', () => (
              <DataListErrorState retry={() => usersQuery.refetch()} />
            ))
            .match('empty', () => <DataListEmptyState />)
            .match('empty-search', ({ searchTerm }) => (
              <DataListEmptyState searchTerm={searchTerm} />
            ))
            .match('default', ({ items, searchTerm, total }) => (
              <>
                {!!searchTerm && (
                  <DataListRowResults
                    withClearButton
                    onClear={() => {
                      router.navigate({
                        to: '.',
                        search: { searchTerm: '' },
                        replace: true,
                      });
                    }}
                  >
                    {t('user:manager.list.searchResults', {
                      total,
                      searchTerm,
                    })}
                  </DataListRowResults>
                )}
                {items.map((item) => (
                  <DataListRow key={item.id} withHover>
                    <DataListCell className="flex-none">
                      <Avatar>
                        <AvatarImage
                          src={item.imageThumbnail ?? item.image ?? undefined}
                          alt={item.name ?? ''}
                        />
                        <AvatarFallback
                          variant="boring"
                          name={item.name ?? ''}
                        />
                      </Avatar>
                    </DataListCell>
                    <DataListCell>
                      <DataListText className="font-medium">
                        <Link to="/manager/users/$id" params={{ id: item.id }}>
                          {getDisplayName(item)}
                          <span className="absolute inset-0" />
                        </Link>
                      </DataListText>
                      <DataListText className="text-xs text-muted-foreground">
                        {item.email}
                        {item.personalData?.numeroDocumento && (
                          <> · {item.personalData.numeroDocumento}</>
                        )}
                      </DataListText>
                    </DataListCell>
                    <DataListCell className="flex-none max-sm:hidden">
                      <Badge
                        variant={item.verifiedAt ? 'default' : 'secondary'}
                      >
                        {item.verifiedAt
                          ? t('user:common.verifiedStatus.verifiedAt', {
                              time: dayjs(item.verifiedAt).fromNow(),
                            })
                          : t('user:common.verifiedStatus.notVerified')}
                      </Badge>
                    </DataListCell>
                    <WithPermissions permissions={[{ user: ['update'] }]}>
                      <DataListCell className="relative z-10 flex-none">
                        <VerifyUserButton item={item} />
                      </DataListCell>
                    </WithPermissions>
                  </DataListRow>
                ))}
                <DataListRow>
                  <DataListCell className="flex-none">
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={!usersQuery.hasNextPage}
                      onClick={() => usersQuery.fetchNextPage()}
                      loading={usersQuery.isFetchingNextPage}
                    >
                      {t('user:manager.list.loadMore')}
                    </Button>
                  </DataListCell>
                  <DataListCell>
                    <DataListText className="text-xs text-muted-foreground">
                      {t('user:manager.list.showing', {
                        count: items.length,
                        total,
                      })}
                    </DataListText>
                  </DataListCell>
                </DataListRow>
              </>
            ))
            .exhaustive()}
        </DataList>
      </PageLayoutContent>
    </PageLayout>
  );
};

const VerifyUserButton = ({ item }: { item: User }) => {
  const { t } = useTranslation(['user']);
  const queryClient = useQueryClient();
  const session = authClient.useSession();

  const setVerified = useMutation(
    orpc.user.setVerified.mutationOptions({
      onSuccess: async (updatedUser) => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getAll.key(),
          type: 'all',
        });
        toast.success(
          updatedUser.verifiedAt
            ? t('user:manager.detail.verified')
            : t('user:manager.detail.unverified')
        );
      },
      onError: () => {
        toast.error(t('user:manager.detail.verifyError'));
      },
    })
  );

  if (session.data?.user.id === item.id) return null;

  const userName = item.name ?? item.email;

  return (
    <ConfirmResponsiveDrawer
      onConfirm={() =>
        setVerified.mutate({ id: item.id, verified: !item.verifiedAt })
      }
      title={
        item.verifiedAt
          ? t('user:manager.list.confirmUnverifyTitle', { user: userName })
          : t('user:manager.list.confirmVerifyTitle', { user: userName })
      }
      description={
        item.verifiedAt
          ? t('user:manager.list.confirmUnverifyDescription')
          : t('user:manager.list.confirmVerifyDescription')
      }
      confirmText={
        item.verifiedAt
          ? t('user:manager.detail.unverifyButton')
          : t('user:manager.detail.verifyButton')
      }
    >
      <ResponsiveIconButton
        variant="ghost"
        size="sm"
        label={
          item.verifiedAt
            ? t('user:manager.detail.unverifyButton')
            : t('user:manager.detail.verifyButton')
        }
        loading={setVerified.isPending}
      >
        <BadgeCheckIcon />
      </ResponsiveIconButton>
    </ConfirmResponsiveDrawer>
  );
};
