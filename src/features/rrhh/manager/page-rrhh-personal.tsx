import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import { Badge } from '@/components/ui/badge';
import {
  DataList,
  DataListCell,
  DataListEmptyState,
  DataListRow,
  DataListRowResults,
  DataListText,
} from '@/components/ui/datalist';
import { SearchInput } from '@/components/ui/search-input';

import {
  Estado,
  FechaInput,
  hoyIso,
  NativeSelect,
  Periodo,
} from '@/features/rrhh/manager/ui';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export type PersonalSearch = {
  busqueda?: string;
  dependenciaId?: string;
  fecha?: string;
  todos?: boolean;
};

/** People with their posts on a date; search by name or C.I. */
export const PageRrhhPersonal = (props: { search: PersonalSearch }) => {
  const { t } = useTranslation(['rrhh']);
  const router = useRouter();
  const fecha = props.search.fecha ?? hoyIso();
  const set = (patch: Partial<PersonalSearch>) =>
    router.navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    });

  const opciones = useQuery(orpc.rrhh.opciones.queryOptions());
  const personas = useQuery(
    orpc.rrhh.personas.queryOptions({
      input: {
        busqueda: props.search.busqueda || undefined,
        dependenciaId: props.search.dependenciaId,
        fecha,
        soloVigentes: !props.search.todos,
      },
    })
  );

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>
          {t('rrhh:personal.title')}
        </PageLayoutTopBarTitle>
        <FechaInput value={fecha} onChange={(value) => set({ fecha: value })} />
        <NativeSelect
          className="max-w-2xs"
          aria-label={t('rrhh:common.dependency')}
          value={props.search.dependenciaId ?? ''}
          onChange={(event) =>
            set({ dependenciaId: event.target.value || undefined })
          }
        >
          <option value="">{t('rrhh:common.allDependencies')}</option>
          {opciones.data?.dependencias.map((d) => (
            <option key={d.id} value={d.id}>
              {d.nombre}
            </option>
          ))}
        </NativeSelect>
        <SearchInput
          size="sm"
          className="max-w-2xs"
          placeholder={t('rrhh:common.search')}
          value={props.search.busqueda ?? ''}
          onChange={(value) => set({ busqueda: value || undefined })}
        />
      </PageLayoutTopBar>
      <PageLayoutContent className="pb-20">
        <label className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={!!props.search.todos}
            onChange={(event) =>
              set({ todos: event.target.checked || undefined })
            }
          />
          {t('rrhh:personal.includeWithout')}
        </label>
        <Estado loading={personas.isPending} error={personas.isError} />
        {personas.data && (
          <DataList>
            <DataListRowResults>
              {t('rrhh:personal.count', { count: personas.data.length })}
            </DataListRowResults>
            {personas.data.length === 0 && <DataListEmptyState />}
            {personas.data.map((p) => (
              <DataListRow key={p.id} withHover>
                <DataListCell>
                  <DataListText className="font-medium">
                    <Link
                      to="/manager/rrhh/personal/$id"
                      params={{ id: p.id }}
                      search={{ fecha }}
                    >
                      {p.nombre}
                      <span className="absolute inset-0" />
                    </Link>
                  </DataListText>
                  <DataListText className="text-xs text-muted-foreground">
                    C.I. {p.ci}
                    {p.complemento ? ` ${p.complemento}` : ''}
                    {p.correo ? ` · ${p.correo}` : ''}
                  </DataListText>
                </DataListCell>
                <DataListCell className="flex-[2]">
                  {p.asignaciones.length === 0 && (
                    <DataListText className="text-xs text-muted-foreground">
                      {t('rrhh:personal.noPost')}
                    </DataListText>
                  )}
                  {p.asignaciones.map((a) => (
                    <DataListText key={a.id} className="text-xs">
                      <span className="font-medium">
                        {a.puesto.denominacion}
                      </span>
                      {' · '}
                      {a.puesto.dependencia.sigla ??
                        a.puesto.dependencia.nombre}
                      {a.tipo !== 'TITULAR' && (
                        <Badge variant="secondary" className="ms-1 text-xs">
                          {t(`rrhh:tipo.${a.tipo}`)}
                        </Badge>
                      )}
                      {a.puesto.esJefatura && (
                        <Badge className="ms-1 text-xs">
                          {t('rrhh:common.head')}
                        </Badge>
                      )}
                      {a.hasta && (
                        <span className="ms-1 text-muted-foreground">
                          (<Periodo desde={a.desde} hasta={a.hasta} />)
                        </span>
                      )}
                    </DataListText>
                  ))}
                </DataListCell>
              </DataListRow>
            ))}
          </DataList>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
};
