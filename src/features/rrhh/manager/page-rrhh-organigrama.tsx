import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import { Badge } from '@/components/ui/badge';

import { Estado, FechaInput, hoyIso } from '@/features/rrhh/manager/ui';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

type Nodo = {
  id: string;
  codigo: string;
  sigla: string | null;
  nombre: string;
  nivel: string;
  padreId: string | null;
  jefe: {
    id: string;
    nombre: string;
    tipo: string;
    porDelegacion: boolean;
  } | null;
  personas: number;
  puestos: number;
  vacantes: number;
};

/**
 * The org chart on a date (today by default): each dependency with who
 * exercises its head, and its people, posts and vacancies. Choosing another
 * date answers "how was it then".
 */
export const PageRrhhOrganigrama = (props: { fecha?: string }) => {
  const { t } = useTranslation(['rrhh']);
  const router = useRouter();
  const fecha = props.fecha ?? hoyIso();
  const query = useQuery(
    orpc.rrhh.organigrama.queryOptions({ input: { fecha } })
  );

  const nodos = query.data ?? [];
  const ids = new Set(nodos.map((n) => n.id));
  // Roots: no parent, or a parent not in force on that date
  const raices = nodos.filter((n) => !n.padreId || !ids.has(n.padreId));

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>
          {t('rrhh:organigrama.title')}
        </PageLayoutTopBarTitle>
        <FechaInput
          value={fecha}
          onChange={(value) =>
            router.navigate({
              to: '.',
              search: { fecha: value },
              replace: true,
            })
          }
        />
      </PageLayoutTopBar>
      <PageLayoutContent containerClassName="py-4">
        <p className="mb-3 text-sm text-muted-foreground">
          {t('rrhh:organigrama.help')}
        </p>
        <Estado loading={query.isPending} error={query.isError} />
        <ul className="flex flex-col gap-2">
          {raices.map((raiz) => (
            <Rama key={raiz.id} nodo={raiz} nodos={nodos} fecha={fecha} />
          ))}
        </ul>
      </PageLayoutContent>
    </PageLayout>
  );
};

/** One dependency and, nested under it, the ones that depend on it */
const Rama = (props: { nodo: Nodo; nodos: Nodo[]; fecha: string }) => {
  const { t } = useTranslation(['rrhh']);
  const { nodo, fecha } = props;
  const hijas = props.nodos.filter((n) => n.padreId === nodo.id);
  return (
    <li>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 rounded-md border bg-card px-3 py-2 text-sm">
        <span className="font-medium">{nodo.nombre}</span>
        {nodo.sigla && (
          <span className="text-muted-foreground">({nodo.sigla})</span>
        )}
        <Badge variant="secondary">{t(`rrhh:nivel.${nodo.nivel}`)}</Badge>
        <span className="basis-full text-xs">
          {nodo.jefe ? (
            <Link
              to="/manager/rrhh/personal/$id"
              params={{ id: nodo.jefe.id }}
              search={{ fecha }}
              className="underline"
            >
              {nodo.jefe.nombre}
            </Link>
          ) : (
            <span className="font-medium text-warning-600">
              {t('rrhh:common.headless')}
            </span>
          )}
          {nodo.jefe && nodo.jefe.tipo !== 'TITULAR' && (
            <> · {t(`rrhh:tipo.${nodo.jefe.tipo}`)}</>
          )}
          {nodo.jefe?.porDelegacion && <> · {t('rrhh:common.byDelegation')}</>}
        </span>
        <span className="text-xs text-muted-foreground">
          {nodo.personas} {t('rrhh:common.people')} · {nodo.puestos}{' '}
          {t('rrhh:common.posts')}
          {nodo.vacantes > 0 &&
            ` · ${nodo.vacantes} ${t('rrhh:common.vacancies')}`}
          {' · '}
          <Link
            to="/manager/rrhh/puestos"
            search={{ dependenciaId: nodo.id, fecha }}
            className="underline"
          >
            {t('rrhh:organigrama.seePosts')}
          </Link>
        </span>
      </div>
      {hijas.length > 0 && (
        <ul className="ms-5 mt-2 flex flex-col gap-2 border-s ps-3">
          {hijas.map((hija) => (
            <Rama key={hija.id} nodo={hija} nodos={props.nodos} fecha={fecha} />
          ))}
        </ul>
      )}
    </li>
  );
};
