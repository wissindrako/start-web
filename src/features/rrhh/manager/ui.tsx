import { ComponentProps } from 'react';
import { useTranslation } from 'react-i18next';

import { cn } from '@/lib/tailwind/utils';

import { Input } from '@/components/ui/input';

/** Today in Bolivia as YYYY-MM-DD (the date the server uses by default) */
export const hoyIso = () =>
  new Date().toLocaleDateString('en-CA', { timeZone: 'America/La_Paz' });

/** Day-only dates come from the server as UTC midnight: show them in UTC */
export const fmt = (value: Date | string | null | undefined) => {
  if (!value) return '';
  const date = new Date(value);
  return date.toLocaleDateString('es-BO', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
};

export const Periodo = (props: {
  desde: Date | string;
  hasta: Date | string | null;
}) => {
  const { t } = useTranslation(['rrhh']);
  return (
    <span className="tabular-nums">
      {fmt(props.desde)} –{' '}
      {props.hasta ? fmt(props.hasta) : t('rrhh:common.open')}
    </span>
  );
};

export const FechaInput = (props: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) => {
  const { t } = useTranslation(['rrhh']);
  return (
    <Input
      type="date"
      size="sm"
      aria-label={t('rrhh:common.date')}
      value={props.value}
      onChange={(event) => props.onChange(event.target.value || hoyIso())}
      className={cn('w-40', props.className)}
    />
  );
};

/** A plain <select> styled like the inputs (long lists, simple forms) */
export const NativeSelect = ({
  className,
  ...props
}: ComponentProps<'select'>) => (
  <select
    className={cn(
      'h-8 rounded-md border border-input bg-background px-2 text-sm shadow-xs outline-none focus-visible:ring-2 focus-visible:ring-ring',
      className
    )}
    {...props}
  />
);

export const Field = (props: {
  label: string;
  help?: string;
  children: React.ReactNode;
}) => (
  <label className="flex flex-col gap-1 text-sm">
    <span className="font-medium">{props.label}</span>
    {props.children}
    {props.help && (
      <span className="text-xs text-muted-foreground">{props.help}</span>
    )}
  </label>
);

export const Estado = (props: { loading: boolean; error: boolean }) => {
  const { t } = useTranslation(['rrhh']);
  if (props.loading)
    return (
      <p className="p-4 text-sm text-muted-foreground">
        {t('rrhh:common.loading')}
      </p>
    );
  if (props.error)
    return (
      <p className="p-4 text-sm text-negative-600">{t('rrhh:common.error')}</p>
    );
  return null;
};
