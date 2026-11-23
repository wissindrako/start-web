import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';

import { WithPermissions } from '@/features/auth/with-permission';
import {
  Estado,
  Field,
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

/** Who covers whose authority and for how long (vacations, trips…) */
export const PageRrhhDelegaciones = () => {
  const { t } = useTranslation(['rrhh']);
  const queryClient = useQueryClient();
  const [todas, setTodas] = useState(false);
  const fecha = hoyIso();
  const lista = useQuery(
    orpc.rrhh.delegaciones.queryOptions({ input: { fecha, todas } })
  );
  const onError = (error: Error) =>
    toast.error(
      error instanceof ORPCError && error.message
        ? error.message
        : t('rrhh:delegaciones.error')
    );
  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: orpc.rrhh.key() });

  const cerrar = useMutation(
    orpc.rrhh.cerrarDelegacion.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast.success(t('rrhh:delegaciones.ended'));
      },
      onError,
    })
  );

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>
          {t('rrhh:delegaciones.title')}
        </PageLayoutTopBarTitle>
        <label className="flex items-center gap-1 text-sm">
          <input
            type="checkbox"
            checked={todas}
            onChange={(event) => setTodas(event.target.checked)}
          />
          {t('rrhh:delegaciones.showAll')}
        </label>
      </PageLayoutTopBar>
      <PageLayoutContent containerClassName="py-4">
        <div className="flex flex-col gap-4">
          <WithPermissions permissions={[{ movilidad: ['update'] }]}>
            <NuevaDelegacion onSaved={refresh} onError={onError} />
          </WithPermissions>
          <Card>
            <CardContent className="pt-4">
              <Estado loading={lista.isPending} error={lista.isError} />
              {lista.data?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t('rrhh:common.empty')}
                </p>
              )}
              <ul className="flex flex-col divide-y text-sm">
                {lista.data?.map((d) => (
                  <li
                    key={d.id}
                    className="flex flex-wrap items-center gap-2 py-2"
                  >
                    <Link
                      to="/manager/rrhh/personal/$id"
                      params={{ id: d.delegante.id }}
                      className="font-medium underline"
                    >
                      {d.delegante.nombre}
                    </Link>
                    →
                    <Link
                      to="/manager/rrhh/personal/$id"
                      params={{ id: d.delegado.id }}
                      className="underline"
                    >
                      {d.delegado.nombre}
                    </Link>
                    <span className="text-muted-foreground">
                      <Periodo desde={d.desde} hasta={d.hasta} />
                      {d.motivo ? ` · ${d.motivo}` : ''}
                      {d.documento ? ` · ${d.documento}` : ''}
                    </span>
                    <Badge variant={d.vigente ? 'default' : 'secondary'}>
                      {d.vigente
                        ? t('rrhh:delegaciones.active')
                        : t('rrhh:delegaciones.finished')}
                    </Badge>
                    {d.vigente && (
                      <WithPermissions
                        permissions={[{ movilidad: ['update'] }]}
                      >
                        <Button
                          size="xs"
                          variant="secondary"
                          className="ms-auto"
                          loading={
                            cerrar.isPending && cerrar.variables?.id === d.id
                          }
                          onClick={() =>
                            cerrar.mutate({ id: d.id, hasta: fecha })
                          }
                        >
                          {t('rrhh:delegaciones.end')}
                        </Button>
                      </WithPermissions>
                    )}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </PageLayoutContent>
    </PageLayout>
  );
};

const NuevaDelegacion = (props: {
  onSaved: () => Promise<unknown>;
  onError: (error: Error) => void;
}) => {
  const { t } = useTranslation(['rrhh']);
  const personas = useQuery(
    orpc.rrhh.personas.queryOptions({ input: { soloVigentes: true } })
  );
  const [delegante, setDelegante] = useState('');
  const [delegado, setDelegado] = useState('');
  const [desde, setDesde] = useState(hoyIso);
  const [hasta, setHasta] = useState('');
  const [motivo, setMotivo] = useState('');
  const [documento, setDocumento] = useState('');
  const crear = useMutation(
    orpc.rrhh.crearDelegacion.mutationOptions({
      onSuccess: async () => {
        await props.onSaved();
        toast.success(t('rrhh:delegaciones.created'));
        setDelegante('');
        setDelegado('');
        setHasta('');
        setMotivo('');
        setDocumento('');
      },
      onError: props.onError,
    })
  );
  const selectPersona = (value: string, onChange: (value: string) => void) => (
    <NativeSelect
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{t('rrhh:delegaciones.choosePerson')}</option>
      {personas.data?.map((p) => (
        <option key={p.id} value={p.id}>
          {p.nombre}
          {p.asignaciones[0]
            ? ` · ${p.asignaciones[0].puesto.denominacion}`
            : ''}
        </option>
      ))}
    </NativeSelect>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('rrhh:delegaciones.new')}</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <Field label={t('rrhh:delegaciones.delegator')}>
          {selectPersona(delegante, setDelegante)}
        </Field>
        <Field label={t('rrhh:delegaciones.delegate')}>
          {selectPersona(delegado, setDelegado)}
        </Field>
        <Field label={t('rrhh:common.from')}>
          <Input
            type="date"
            size="sm"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
          />
        </Field>
        <Field label={t('rrhh:common.to')}>
          <Input
            type="date"
            size="sm"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
          />
        </Field>
        <Field label={t('rrhh:delegaciones.reason')}>
          <Input
            size="sm"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
          />
        </Field>
        <Field label={t('rrhh:delegaciones.document')}>
          <Input
            size="sm"
            value={documento}
            onChange={(e) => setDocumento(e.target.value)}
          />
        </Field>
        <div className="sm:col-span-2">
          <Button
            disabled={!delegante || !delegado || !desde}
            loading={crear.isPending}
            onClick={() =>
              crear.mutate({
                delegantePersonaId: delegante,
                delegadoPersonaId: delegado,
                desde,
                hasta: hasta || null,
                motivo: motivo || null,
                documento: documento || null,
              })
            }
          >
            {t('rrhh:common.save')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
