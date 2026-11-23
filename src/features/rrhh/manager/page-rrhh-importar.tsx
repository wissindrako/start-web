import { useMutation } from '@tanstack/react-query';
import { FileSpreadsheetIcon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

type Result = Awaited<ReturnType<typeof orpc.rrhh.importar.call>>;

const SHEETS = [
  'dependencias',
  'puestos',
  'personas',
  'asignaciones',
  'delegaciones',
] as const;

/**
 * RR.HH.'s spreadsheet: choose the file, check it (nothing is saved) and,
 * if there are no errors, import it. Same logic as pnpm rrhh:importar.
 */
export const PageRrhhImportar = () => {
  const { t } = useTranslation(['rrhh']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const run = useMutation(
    orpc.rrhh.importar.mutationOptions({
      onSuccess: (data) => {
        setResult(data);
        if (data.aplicado) toast.success(t('rrhh:importar.imported'));
      },
      onError: () => toast.error(t('rrhh:importar.error')),
    })
  );

  const check = (aplicar: boolean) => {
    if (file) run.mutate({ archivo: file, aplicar });
  };
  const canApply =
    !!result && !result.aplicado && result.errores.length === 0 && !!file;

  return (
    <PageLayout>
      <PageLayoutTopBar>
        <PageLayoutTopBarTitle>
          {t('rrhh:importar.title')}
        </PageLayoutTopBarTitle>
      </PageLayoutTopBar>
      <PageLayoutContent containerClassName="py-4">
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('rrhh:importar.fileTitle')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                {t('rrhh:importar.help')}
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx"
                className="hidden"
                onChange={(event) => {
                  setFile(event.target.files?.[0] ?? null);
                  setResult(null);
                }}
              />
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => inputRef.current?.click()}
                >
                  <FileSpreadsheetIcon />
                  {file ? file.name : t('rrhh:importar.choose')}
                </Button>
                <Button
                  type="button"
                  disabled={!file}
                  loading={run.isPending && !run.variables?.aplicar}
                  onClick={() => check(false)}
                >
                  {t('rrhh:importar.check')}
                </Button>
                <Button
                  type="button"
                  disabled={!canApply}
                  loading={run.isPending && !!run.variables?.aplicar}
                  onClick={() => check(true)}
                >
                  <UploadIcon />
                  {t('rrhh:importar.apply')}
                </Button>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card>
              <CardHeader>
                <CardTitle>
                  {result.aplicado
                    ? t('rrhh:importar.doneTitle')
                    : t('rrhh:importar.previewTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <table className="w-full max-w-xl text-sm">
                  <thead>
                    <tr className="text-left text-muted-foreground">
                      <th className="py-1 font-medium">
                        {t('rrhh:importar.sheet')}
                      </th>
                      <th className="py-1 text-right font-medium">
                        {t('rrhh:importar.new')}
                      </th>
                      <th className="py-1 text-right font-medium">
                        {t('rrhh:importar.changed')}
                      </th>
                      <th className="py-1 text-right font-medium">
                        {t('rrhh:importar.same')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {SHEETS.map((sheet) => (
                      <tr key={sheet} className="border-t">
                        <td className="py-1">{t(`rrhh:sheets.${sheet}`)}</td>
                        <td className="py-1 text-right tabular-nums">
                          {result.resumen[sheet].nuevas}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {result.resumen[sheet].cambian}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {result.resumen[sheet].iguales}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {result.errores.length > 0 ? (
                  <Issues
                    title={t('rrhh:importar.errors', {
                      count: result.errores.length,
                    })}
                    issues={result.errores}
                    tone="error"
                  />
                ) : (
                  !result.aplicado && (
                    <p className="text-sm">{t('rrhh:importar.readyToApply')}</p>
                  )
                )}
                {result.avisos.length > 0 && (
                  <Issues
                    title={t('rrhh:importar.warnings', {
                      count: result.avisos.length,
                    })}
                    issues={result.avisos}
                    tone="warning"
                  />
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </PageLayoutContent>
    </PageLayout>
  );
};

const Issues = (props: {
  title: string;
  issues: Result['errores'];
  tone: 'error' | 'warning';
}) => {
  const { t } = useTranslation(['rrhh']);
  return (
    <div className="flex flex-col gap-1">
      <p
        className={
          props.tone === 'error'
            ? 'text-sm font-medium text-negative-600'
            : 'text-sm font-medium text-warning-600'
        }
      >
        {props.title}
      </p>
      <ul className="max-h-80 overflow-auto rounded-md border p-2 text-sm">
        {props.issues.map((issue, index) => (
          // eslint-disable-next-line @eslint-react/no-array-index-key -- issues have no id; the list never reorders
          <li key={index} className="py-0.5">
            <span className="text-muted-foreground">
              {issue.hoja}
              {issue.fila > 0 &&
                ` · ${t('rrhh:importar.row', { row: issue.fila })}`}
              {': '}
            </span>
            {issue.mensaje}
          </li>
        ))}
      </ul>
    </div>
  );
};
