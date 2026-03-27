import { getUiState } from '@bearstudio/ui-state';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { PlusIcon, ShieldIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Badge } from '@/components/ui/badge';

import { orpc } from '@/lib/orpc/client';

import { Button } from '@/components/ui/button';
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
import { ResponsiveIconButtonLink } from '@/components/ui/responsive-icon-button-link';
import { SearchButton } from '@/components/ui/search-button';
import { SearchInput } from '@/components/ui/search-input';

import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageRoles = (props: { search: { searchTerm?: string } }) => {
  const router = useRouter();
  const { t } = useTranslation(['role']);

  const searchInputProps = {
    value: props.search.searchTerm ?? '',
    onChange: (value: string) =>
      router.navigate({
        to: '.',
        search: { searchTerm: value },
        replace: true,
      }),
  };

  const rolesQuery = useInfiniteQuery(
    orpc.role.getAll.infiniteOptions({
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
    if (rolesQuery.status === 'pending') return set('pending');
    if (rolesQuery.status === 'error') return set('error');

    const searchTerm = props.search.searchTerm;
    const items = rolesQuery.data?.pages.flatMap((p) => p.items) ?? [];
    if (!items.length && searchTerm) {
      return set('empty-search', { searchTerm });
    }
    if (!items.length) return set('empty');

    return set('default', {
      items,
      searchTerm,
      total: rolesQuery.data.pages[0]?.total ?? 0,
    });
  });

  return (
    <PageLayout>
      <PageLayoutTopBar
        endActions={
          <ResponsiveIconButtonLink
            label={t('role:manager.new.title')}
            variant="secondary"
            size="sm"
            to="/manager/roles/new"
          >
            <PlusIcon />
          </ResponsiveIconButtonLink>
        }
      >
        <PageLayoutTopBarTitle>
          {t('role:manager.list.title')}
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
              <DataListErrorState retry={() => rolesQuery.refetch()} />
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
                    {t('role:manager.list.searchResults', {
                      total,
                      searchTerm,
                    })}
                  </DataListRowResults>
                )}
                {items.map((item) => (
                  <DataListRow key={item.id} withHover>
                    <DataListCell className="flex-none">
                      <ShieldIcon className="size-4 text-muted-foreground" />
                    </DataListCell>
                    <DataListCell>
                      <DataListText className="flex items-center gap-2 font-medium">
                        <Link to="/manager/roles/$id" params={{ id: item.id }}>
                          {item.name}
                          <span className="absolute inset-0" />
                        </Link>
                        <Badge
                          variant={
                            item.scope === 'local' ? 'secondary' : 'outline'
                          }
                          className="relative z-10 text-xs"
                        >
                          {item.scope === 'external' && item.system
                            ? `${t('role:scopes.external')} · ${item.system}`
                            : t(`role:scopes.${item.scope}`)}
                        </Badge>
                      </DataListText>
                      {item.description && (
                        <DataListText className="text-xs text-muted-foreground">
                          {item.description}
                        </DataListText>
                      )}
                    </DataListCell>
                    <DataListCell>
                      <DataListText className="text-xs text-muted-foreground">
                        {t('role:manager.list.permissionsCount', {
                          count: item.permissions.length,
                        })}
                      </DataListText>
                    </DataListCell>
                    <DataListCell>
                      <DataListText className="text-xs text-muted-foreground">
                        {t('role:manager.list.usersCount', {
                          count: item._count.userAssignments,
                        })}
                      </DataListText>
                    </DataListCell>
                  </DataListRow>
                ))}
                <DataListRow>
                  <DataListCell className="flex-none">
                    <Button
                      size="xs"
                      variant="secondary"
                      disabled={!rolesQuery.hasNextPage}
                      onClick={() => rolesQuery.fetchNextPage()}
                      loading={rolesQuery.isFetchingNextPage}
                    >
                      {t('role:manager.list.loadMore')}
                    </Button>
                  </DataListCell>
                  <DataListCell>
                    <DataListText className="text-xs text-muted-foreground">
                      {t('role:manager.list.showing', {
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
