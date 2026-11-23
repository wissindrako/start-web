import { ORPCError } from '@orpc/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

import {
  Field,
  hoyIso,
  NativeSelect,
  Periodo,
} from '@/features/rrhh/manager/ui';

type Tipo = 'TITULAR' | 'INTERINO' | 'ROTACION' | 'COMISION' | 'SUPLENCIA';
const TIPOS: Tipo[] = [
  'TITULAR',
  'INTERINO',
  'ROTACION',
  'COMISION',
  'SUPLENCIA',
];

/** What each movement usually does: which assignment it opens, and if it closes all */
const SUGERENCIA: Record<string, { abre: Tipo | null; cierraTodo?: boolean }> =
  {
    ALTA: { abre: 'TITULAR' },
    DESIGNACION: { abre: 'TITULAR' },
    INTERINATO: { abre: 'INTERINO' },
    ROTACION: { abre: 'ROTACION' },
    COMISION: { abre: 'COMISION' },
    SUPLENCIA: { abre: 'SUPLENCIA' },
    CONCLUSION: { abre: null },
    BAJA: { abre: null, cierraTodo: true },
  };

type Vigente = {
  id: string;
  tipo: string;
  desde: Date | string;
  hasta: Date | string | null;
  puesto: { codigo: string; denominacion: string };
};

/**
 * One HR act for a person: what kind, from which day, under which document;
 * which current posts it closes and which one it opens.
 */
export const FormMovimiento = (props: {
  persona: { id: string; nombre: string };
  vigentes: Vigente[];
  onClose: () => void;
}) => {
  const { t } = useTranslation(['rrhh']);
  const queryClient = useQueryClient();
  const opciones = useQuery(orpc.rrhh.opciones.queryOptions());

  const [tipoMovimiento, setTipoMovimiento] = useState('DESIGNACION');
  const [fecha, setFecha] = useState(hoyIso);
  const [documento, setDocumento] = useState('');
  const [observaciones, setObservaciones] = useState('');
  const [cerrar, setCerrar] = useState<string[]>([]);
  const [abre, setAbre] = useState<Tipo | null>('TITULAR');
  const [puestoId, setPuestoId] = useState('');
  const [hasta, setHasta] = useState('');

  const elegirTipo = (codigo: string) => {
    setTipoMovimiento(codigo);
    const sugerencia = SUGERENCIA[codigo];
    if (!sugerencia) return;
    setAbre(sugerencia.abre);
    if (sugerencia.cierraTodo) setCerrar(props.vigentes.map((v) => v.id));
  };

  const guardar = useMutation(
    orpc.rrhh.registrarMovimiento.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: orpc.rrhh.key() });
        toast.success(t('rrhh:movimiento.saved'));
        props.onClose();
      },
      onError: (error) =>
        toast.error(
          error instanceof ORPCError && error.message
            ? error.message
            : t('rrhh:movimiento.error')
        ),
    })
  );

  const valid = !!fecha && (cerrar.length > 0 || (!!abre && !!puestoId));

  return (
    <Dialog open onOpenChange={(open) => !open && props.onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {t('rrhh:movimiento.title')} · {props.persona.nombre}
          </DialogTitle>
        </DialogHeader>
        <DialogBody className="-mx-1 flex max-h-[65vh] flex-col gap-4 overflow-y-auto px-1">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={t('rrhh:movimiento.type')}>
              <NativeSelect
                value={tipoMovimiento}
                onChange={(event) => elegirTipo(event.target.value)}
              >
                {opciones.data?.tiposMovimiento.map((m) => (
                  <option key={m.codigo} value={m.codigo}>
                    {m.nombre}
                  </option>
                ))}
              </NativeSelect>
            </Field>
            <Field
              label={t('rrhh:movimiento.effective')}
              help={t('rrhh:movimiento.effectiveHelp')}
            >
              <Input
                type="date"
                size="sm"
                value={fecha}
                onChange={(event) => setFecha(event.target.value)}
              />
            </Field>
          </div>
          <Field label={t('rrhh:movimiento.document')}>
            <Input
              size="sm"
              value={documento}
              onChange={(event) => setDocumento(event.target.value)}
            />
          </Field>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="font-medium">
              {t('rrhh:movimiento.closes')}
            </legend>
            <span className="text-xs text-muted-foreground">
              {t('rrhh:movimiento.closesHelp')}
            </span>
            {props.vigentes.length === 0 && (
              <span className="text-muted-foreground">
                {t('rrhh:movimiento.nothingToClose')}
              </span>
            )}
            {props.vigentes.map((v) => (
              <label key={v.id} className="flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={cerrar.includes(v.id)}
                  onChange={(event) =>
                    setCerrar((current) =>
                      event.target.checked
                        ? [...current, v.id]
                        : current.filter((id) => id !== v.id)
                    )
                  }
                />
                <span>
                  {v.puesto.denominacion} ({v.puesto.codigo}) ·{' '}
                  {t(`rrhh:tipo.${v.tipo}`)} ·{' '}
                  <Periodo desde={v.desde} hasta={v.hasta} />
                </span>
              </label>
            ))}
          </fieldset>

          <fieldset className="flex flex-col gap-2 text-sm">
            <legend className="font-medium">
              {t('rrhh:movimiento.opens')}
            </legend>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <NativeSelect
                aria-label={t('rrhh:common.post')}
                value={puestoId}
                disabled={!abre}
                onChange={(event) => setPuestoId(event.target.value)}
              >
                <option value="">{t('rrhh:movimiento.choosePost')}</option>
                {opciones.data?.puestos.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.codigo} · {p.denominacion} · {p.dependencia}
                  </option>
                ))}
              </NativeSelect>
              <NativeSelect
                aria-label={t('rrhh:movimiento.opensType')}
                value={abre ?? ''}
                onChange={(event) =>
                  setAbre((event.target.value || null) as Tipo | null)
                }
              >
                <option value="">—</option>
                {TIPOS.map((tipo) => (
                  <option key={tipo} value={tipo}>
                    {t(`rrhh:tipo.${tipo}`)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            {abre && (
              <Field label={t('rrhh:movimiento.opensTo')}>
                <Input
                  type="date"
                  size="sm"
                  className="w-40"
                  value={hasta}
                  onChange={(event) => setHasta(event.target.value)}
                />
              </Field>
            )}
          </fieldset>

          <Field label={t('rrhh:movimiento.notes')}>
            <Input
              size="sm"
              value={observaciones}
              onChange={(event) => setObservaciones(event.target.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" onClick={props.onClose}>
            {t('rrhh:common.cancel')}
          </Button>
          <Button
            disabled={!valid}
            loading={guardar.isPending}
            onClick={() =>
              guardar.mutate({
                personaId: props.persona.id,
                tipoMovimiento,
                fecha,
                documento: documento || null,
                observaciones: observaciones || null,
                cerrar,
                abrir:
                  abre && puestoId
                    ? { puestoId, tipo: abre, hasta: hasta || null }
                    : null,
              })
            }
          >
            {t('rrhh:common.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
