import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { PlusIcon, ServerIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import {
  DataList,
  DataListCell,
  DataListEmptyState,
  DataListErrorState,
  DataListLoadingState,
  DataListRow,
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

export const PageExternalSystems = (props: {
  search: { searchTerm?: string };
}) => {
  const router = useRouter();
  const { t } = useTranslation(['external-system']);

  const searchInputProps = {
    value: props.search.searchTerm ?? '',
    onChange: (value: string) =>
      router.navigate({
        to: '.',
        search: { searchTerm: value },
        replace: true,
      }),
  };

  const systemsQuery = useQuery(
    orpc.externalSystem.getAll.queryOptions({
      input: { searchTerm: props.search.searchTerm ?? '' },
    })
  );

  if (systemsQuery.status === 'pending') {
    return (
      <PageLayout>
        <PageLayoutTopBar>
          <PageLayoutTopBarTitle>
            {t('external-system:manager.list.title')}
          </PageLayoutTopBarTitle>
        </PageLayoutTopBar>
        <PageLayoutContent>
          <DataList>
            <DataListLoadingState />
          </DataList>
        </PageLayoutContent>
      </PageLayout>
    );
  }

  if (systemsQuery.status === 'error') {
    return (
      <PageLayout>
        <PageLayoutTopBar>
          <PageLayoutTopBarTitle>
            {t('external-system:manager.list.title')}
          </PageLayoutTopBarTitle>
        </PageLayoutTopBar>
        <PageLayoutContent>
          <DataList>
            <DataListErrorState retry={() => systemsQuery.refetch()} />
          </DataList>
        </PageLayoutContent>
      </PageLayout>
    );
  }

  const items = systemsQuery.data ?? [];

  return (
    <PageLayout>
      <PageLayoutTopBar
        endActions={
          <ResponsiveIconButtonLink
            label={t('external-system:manager.new.title')}
            variant="secondary"
            size="sm"
            to="/manager/external-systems/new"
          >
            <PlusIcon />
          </ResponsiveIconButtonLink>
        }
      >
        <PageLayoutTopBarTitle>
          {t('external-system:manager.list.title')}
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
          {items.length === 0 ? (
            <DataListEmptyState searchTerm={props.search.searchTerm} />
          ) : (
            items.map((item) => (
              <DataListRow key={item.id} withHover>
                <DataListCell className="flex-none">
                  <ServerIcon className="size-4 text-muted-foreground" />
                </DataListCell>
                <DataListCell>
                  <DataListText className="font-medium">
                    <Link
                      to="/manager/external-systems/$id/update"
                      params={{ id: item.id }}
                    >
                      {item.label ?? item.name}
                      <span className="absolute inset-0" />
                    </Link>
                  </DataListText>
                  {item.label && (
                    <DataListText className="text-xs text-muted-foreground">
                      {item.name}
                    </DataListText>
                  )}
                </DataListCell>
                <DataListCell>
                  <DataListText className="text-xs text-muted-foreground">
                    {t('external-system:manager.list.modulesCount', {
                      count: item.modules.length,
                    })}
                  </DataListText>
                </DataListCell>
              </DataListRow>
            ))
          )}
        </DataList>
      </PageLayoutContent>
    </PageLayout>
  );
};
