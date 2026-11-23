import { useQuery } from '@tanstack/react-query';
import { Link, useRouter } from '@tanstack/react-router';
import { ArrowRightLeftIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { orpc } from '@/lib/orpc/client';

import { BackButton } from '@/components/back-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { WithPermissions } from '@/features/auth/with-permission';
import { FormMovimiento } from '@/features/rrhh/manager/form-movimiento';
import {
  Estado,
  FechaInput,
  fmt,
  hoyIso,
  Periodo,
} from '@/features/rrhh/manager/ui';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

/** A person's file: data, posts on a date with their superior, history */
export const PageRrhhPersona = (props: { id: string; fecha?: string }) => {
  const { t } = useTranslation(['rrhh']);
  const router = useRouter();
  const fecha = props.fecha ?? hoyIso();
  const [moving, setMoving] = useState(false);
  const ficha = useQuery(
    orpc.rrhh.persona.queryOptions({ input: { id: props.id, fecha } })
  );
  const p = ficha.data;
  const vigentes = p?.asignaciones.filter((a) => a.vigente) ?? [];

  return (
    <PageLayout>
      <PageLayoutTopBar
        startActions={<BackButton />}
        endActions={
          <WithPermissions permissions={[{ movilidad: ['update'] }]}>
            <Button size="sm" disabled={!p} onClick={() => setMoving(true)}>
              <ArrowRightLeftIcon />
              {t('rrhh:persona.registerMovement')}
            </Button>
          </WithPermissions>
        }
      >
        <PageLayoutTopBarTitle>{p?.nombre ?? '…'}</PageLayoutTopBarTitle>
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
        <Estado loading={ficha.isPending} error={ficha.isError} />
        {p && (
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>{t('rrhh:persona.current')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {vigentes.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {t('rrhh:personal.noPost')}
                  </p>
                )}
                {vigentes.map((a) => (
                  <div key={a.id} className="flex flex-col gap-0.5 text-sm">
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="font-medium">
                        {a.puesto.denominacion}
                      </span>
                      <span className="text-muted-foreground">
                        · {a.puesto.dependencia.nombre} · {a.puesto.codigo}
                      </span>
                      <Badge variant="secondary">
                        {t(`rrhh:tipo.${a.tipo}`)}
                      </Badge>
                      {a.puesto.esJefatura && (
                        <Badge>{t('rrhh:common.head')}</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      <Periodo desde={a.desde} hasta={a.hasta} />
                    </span>
                    <span className="text-xs">
                      {t('rrhh:persona.boss')}:{' '}
                      {a.jefe ? (
                        <Link
                          to="/manager/rrhh/personal/$id"
                          params={{ id: a.jefe.id }}
                          search={{ fecha }}
                          className="underline"
                        >
                          {a.jefe.nombre}
                          {a.jefe.puesto ? ` (${a.jefe.puesto})` : ''}
                        </Link>
                      ) : (
                        t('rrhh:persona.noBoss')
                      )}
                      {a.jefe?.porDelegacion &&
                        ` · ${t('rrhh:common.byDelegation')}`}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('rrhh:persona.data')}</CardTitle>
              </CardHeader>
              <CardContent>
                <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1 text-sm">
                  <dt className="text-muted-foreground">
                    {t('rrhh:persona.ci')}
                  </dt>
                  <dd>
                    {p.datos.ci} {p.datos.complemento}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t('rrhh:persona.birth')}
                  </dt>
                  <dd>
                    {fmt(p.datos.fechaNacimiento) || t('rrhh:common.none')}
                  </dd>
                  <dt className="text-muted-foreground">
                    {t('rrhh:persona.gender')}
                  </dt>
                  <dd>{p.datos.genero ?? t('rrhh:common.none')}</dd>
                  <dt className="text-muted-foreground">
                    {t('rrhh:persona.phone')}
                  </dt>
                  <dd>{p.datos.telefono ?? t('rrhh:common.none')}</dd>
                  <dt className="text-muted-foreground">
                    {t('rrhh:persona.email')}
                  </dt>
                  <dd>{p.datos.correo ?? t('rrhh:common.none')}</dd>
                  <dt className="text-muted-foreground">
                    {t('rrhh:common.account')}
                  </dt>
                  <dd>{p.cuenta?.email ?? t('rrhh:common.noAccount')}</dd>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('rrhh:persona.history')}</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="flex flex-col gap-2 text-sm">
                  {p.asignaciones.map((a) => (
                    <li
                      key={a.id}
                      className={a.vigente ? '' : 'text-muted-foreground'}
                    >
                      <Periodo desde={a.desde} hasta={a.hasta} />
                      {' · '}
                      <span className="font-medium">
                        {a.puesto.denominacion}
                      </span>
                      {' · '}
                      {a.puesto.dependencia.sigla ??
                        a.puesto.dependencia.nombre}
                      {' · '}
                      {t(`rrhh:tipo.${a.tipo}`)}
                      {a.inicio && (
                        <span className="block text-xs text-muted-foreground">
                          {t('rrhh:persona.startedBy')}: {a.inicio.tipo}
                          {a.inicio.documento ? ` · ${a.inicio.documento}` : ''}
                          {a.fin && (
                            <>
                              {' — '}
                              {t('rrhh:persona.endedBy')}: {a.fin.tipo}
                              {a.fin.documento ? ` · ${a.fin.documento}` : ''}
                            </>
                          )}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle>{t('rrhh:persona.movements')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {p.movimientos.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('rrhh:persona.noMovements')}
                    </p>
                  )}
                  <ul className="flex flex-col gap-1 text-sm">
                    {p.movimientos.map((m) => (
                      <li key={m.id}>
                        <span className="tabular-nums">
                          {fmt(m.fechaEfectiva)}
                        </span>{' '}
                        · {m.tipo}
                        {m.documento ? ` · ${m.documento}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle>{t('rrhh:persona.delegations')}</CardTitle>
                </CardHeader>
                <CardContent>
                  {p.delegaciones.length === 0 && (
                    <p className="text-sm text-muted-foreground">
                      {t('rrhh:persona.noDelegations')}
                    </p>
                  )}
                  <ul className="flex flex-col gap-1 text-sm">
                    {p.delegaciones.map((d) => (
                      <li key={d.id}>
                        {d.sentido === 'dada'
                          ? t('rrhh:persona.gave')
                          : t('rrhh:persona.received')}{' '}
                        {d.otraPersona.nombre} ·{' '}
                        <Periodo desde={d.desde} hasta={d.hasta} />
                        {d.motivo ? ` · ${d.motivo}` : ''}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
        {p && moving && (
          <FormMovimiento
            persona={{ id: p.id, nombre: p.nombre }}
            vigentes={vigentes}
            onClose={() => setMoving(false)}
          />
        )}
      </PageLayoutContent>
    </PageLayout>
  );
};
