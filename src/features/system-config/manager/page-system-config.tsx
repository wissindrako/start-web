import { uploadFile } from '@better-upload/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';

import {
  Form,
  FormField,
  FormFieldController,
  FormFieldLabel,
} from '@/components/form';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';

import { envClient } from '@/env/client';
import { FormFieldsSystemConfig } from '@/features/system-config/schema';
import {
  PageLayout,
  PageLayoutContent,
  PageLayoutTopBar,
  PageLayoutTopBarTitle,
} from '@/layout/manager/page-layout';

export const PageSystemConfig = () => {
  const { t } = useTranslation(['system-config']);
  const queryClient = useQueryClient();

  const configQuery = useQuery(orpc.systemConfig.get.queryOptions());

  const form = useForm<FormFieldsSystemConfig>({
    values: {
      systemName: configQuery.data?.systemName ?? '',
    },
  });

  const update = useMutation(
    orpc.systemConfig.update.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.systemConfig.get.key(),
          type: 'all',
        });
        toast.success(t('system-config:manager.update.saveSuccess'));
      },
      onError: () => {
        toast.error(t('system-config:manager.update.saveError'));
      },
    })
  );

  return (
    <Form
      {...form}
      onSubmit={(values) => {
        update.mutate({
          systemName: values.systemName || null,
          logoUrl: configQuery.data?.logoUrl ?? null,
        });
      }}
    >
      <PageLayout>
        <PageLayoutTopBar
          endActions={
            <Button
              size="sm"
              type="submit"
              className="min-w-20"
              loading={update.isPending}
            >
              {t('system-config:manager.update.saveButton')}
            </Button>
          }
        >
          <PageLayoutTopBarTitle>
            {t('system-config:manager.update.title')}
          </PageLayoutTopBarTitle>
        </PageLayoutTopBar>
        <PageLayoutContent containerClassName="py-4">
          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>
                  {t('system-config:manager.update.brandingTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-6">
                <FormField>
                  <FormFieldLabel>
                    {t('system-config:manager.update.systemNameLabel')}
                  </FormFieldLabel>
                  <FormFieldController
                    type="text"
                    control={form.control}
                    name="systemName"
                    placeholder={t(
                      'system-config:manager.update.systemNamePlaceholder'
                    )}
                  />
                </FormField>
                {configQuery.isPending ? (
                  <Skeleton className="h-20 w-full" />
                ) : (
                  <LogoUpload
                    currentLogoUrl={configQuery.data?.logoUrl ?? null}
                    currentSystemName={configQuery.data?.systemName ?? null}
                    onLogoChange={(logoUrl) => {
                      update.mutate({
                        systemName: form.getValues('systemName') || null,
                        logoUrl,
                      });
                    }}
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </PageLayoutContent>
      </PageLayout>
    </Form>
  );
};

const LogoUpload = (props: {
  currentLogoUrl: string | null;
  currentSystemName: string | null;
  onLogoChange: (logoUrl: string | null) => void;
}) => {
  const { t } = useTranslation(['system-config']);
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const handleFileChange = async (file: File) => {
    setIsUploading(true);
    try {
      setPreview(URL.createObjectURL(file));
      const result = await uploadFile({ file, route: 'systemLogo' });
      const baseUrl = envClient.VITE_S3_BUCKET_PUBLIC_URL;
      const logoUrl = `${baseUrl}/${result.file.objectInfo.key}`;
      props.onLogoChange(logoUrl);
    } catch {
      toast.error(t('system-config:manager.update.logoUploadError'));
      setPreview(null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const displayLogo = preview ?? props.currentLogoUrl;

  return (
    <div className="flex flex-col gap-2">
      <Label>{t('system-config:manager.update.logoLabel')}</Label>
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-40 items-center justify-center rounded-md border bg-muted">
          {displayLogo ? (
            <img
              src={displayLogo}
              alt="logo"
              className="h-full w-full object-contain p-2"
            />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            {t('system-config:manager.update.logoHint')}
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              loading={isUploading}
              onClick={() => inputRef.current?.click()}
            >
              <UploadIcon className="mr-1.5 size-3.5" />
              {t('system-config:manager.update.logoUploadButton')}
            </Button>
            {displayLogo && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={isUploading}
                onClick={() => {
                  setPreview(null);
                  props.onLogoChange(null);
                }}
              >
                <Trash2Icon className="size-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFileChange(file);
        }}
      />
    </div>
  );
};
