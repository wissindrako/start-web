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

export type PuestosSearch = {
  dependenciaId?: string;
  fecha?: string;
  vacantes?: boolean;
};

/** Posts of the structure with who holds them on a date, or vacant */
export const PageRrhhPuestos = (props: { search: PuestosSearch }) => {
  const { t } = useTranslation(['rrhh']);
  const router = useRouter();
  const fecha = props.search.fecha ?? hoyIso();
  const set = (patch: Partial<PuestosSearch>) =>
    router.navigate({
      to: '.',
      search: (prev) => ({ ...prev, ...patch }),
      replace: true,
    });
  const opciones = useQuery(orpc.rrhh.opciones.queryOptions());
  const puestos = useQuery(
    orpc.rrhh.puestos.queryOptions({
      input: {
        dependenciaId: props.search.dependenciaId,
        fecha,
        soloVacantes: !!props.search.vacantes,
      },
    })
  );

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>{t('rrhh:puestos.title')}</PageLayoutTopBarTitle>
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
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={!!props.search.vacantes}
            onChange={(event) =>
              set({ vacantes: event.target.checked || undefined })
            }
          />
          {t('rrhh:puestos.onlyVacant')}
        </label>
      </PageLayoutTopBar>
      <PageLayoutContent className="pb-20">
        <Estado loading={puestos.isPending} error={puestos.isError} />
        {puestos.data && (
          <DataList>
            <DataListRowResults>
              {t('rrhh:puestos.count', { count: puestos.data.length })}
            </DataListRowResults>
            {puestos.data.length === 0 && <DataListEmptyState />}
            {puestos.data.map((p) => (
              <DataListRow key={p.id}>
                <DataListCell className="flex-none basis-24">
                  <DataListText className="text-xs text-muted-foreground tabular-nums">
                    {p.codigo}
                  </DataListText>
                </DataListCell>
                <DataListCell>
                  <DataListText className="font-medium">
                    {p.denominacion}
                    {p.esJefatura && (
                      <Badge className="ms-1 text-xs">
                        {t('rrhh:common.head')}
                      </Badge>
                    )}
                  </DataListText>
                  <DataListText className="text-xs text-muted-foreground">
                    {p.dependencia.nombre} · {p.vinculo}
                  </DataListText>
                </DataListCell>
                <DataListCell>
                  {p.ocupantes.length === 0 ? (
                    <Badge variant="secondary">{t('rrhh:common.vacant')}</Badge>
                  ) : (
                    p.ocupantes.map((o) => (
                      <DataListText key={o.personaId} className="text-sm">
                        <Link
                          to="/manager/rrhh/personal/$id"
                          params={{ id: o.personaId }}
                          search={{ fecha }}
                          className="underline"
                        >
                          {o.nombre}
                        </Link>
                        {o.tipo !== 'TITULAR' && (
                          <> · {t(`rrhh:tipo.${o.tipo}`)}</>
                        )}
                        {o.hasta && (
                          <span className="text-xs text-muted-foreground">
                            {' '}
                            (<Periodo desde={fecha} hasta={o.hasta} />)
                          </span>
                        )}
                      </DataListText>
                    ))
                  )}
                </DataListCell>
              </DataListRow>
            ))}
          </DataList>
        )}
      </PageLayoutContent>
    </PageLayout>
  );
};
