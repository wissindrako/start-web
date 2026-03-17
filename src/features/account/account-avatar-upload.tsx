import { uploadFile } from '@better-upload/client';
import { useMutation } from '@tanstack/react-query';
import { ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { orpc } from '@/lib/orpc/client';
import { resizeImageToSquare } from '@/lib/utils/resize-image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

import { envClient } from '@/env/client';
import { authClient } from '@/features/auth/client';

const PROFILE_SIZE = 400;
const THUMBNAIL_SIZE = 80;

export const AccountAvatarUpload = () => {
  const { t } = useTranslation(['account']);
  const session = authClient.useSession();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateImage = useMutation(
    orpc.account.updateImage.mutationOptions({
      onSuccess: async () => {
        await session.refetch();
        toast.success(t('account:avatar.updated'));
      },
      onError: () => {
        toast.error(t('account:avatar.updateError'));
      },
    })
  );

  const removeImage = useMutation(
    orpc.account.updateImage.mutationOptions({
      onSuccess: async () => {
        setPreview(null);
        await session.refetch();
        toast.success(t('account:avatar.removed'));
      },
      onError: () => {
        toast.error(t('account:avatar.updateError'));
      },
    })
  );

  const handleFileChange = async (file: File) => {
    setIsUploading(true);
    try {
      const [profileFile, thumbnailFile] = await Promise.all([
        resizeImageToSquare(file, PROFILE_SIZE),
        resizeImageToSquare(file, THUMBNAIL_SIZE),
      ]);

      setPreview(URL.createObjectURL(profileFile));

      const [profileResult, thumbnailResult] = await Promise.all([
        uploadFile({ file: profileFile, route: 'userAvatar' }),
        uploadFile({ file: thumbnailFile, route: 'userAvatar' }),
      ]);

      const baseUrl = envClient.VITE_S3_BUCKET_PUBLIC_URL;
      const imageUrl = `${baseUrl}/${profileResult.file.objectInfo.key}`;
      const thumbnailUrl = `${baseUrl}/${thumbnailResult.file.objectInfo.key}`;

      await updateImage.mutateAsync({
        image: imageUrl,
        imageThumbnail: thumbnailUrl,
      });
    } catch {
      toast.error(t('account:avatar.uploadError'));
      setPreview(null);
    } finally {
      setIsUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const currentImage = session.data?.user.image ?? null;
  const displayImage = preview ?? currentImage;

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20 rounded-md">
        <AvatarImage src={displayImage ?? undefined} className="object-cover" />
        <AvatarFallback className="rounded-md text-lg">
          {!displayImage && (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t('account:avatar.hint')}
        </p>
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            loading={isUploading}
            disabled={isUploading || removeImage.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <UploadIcon className="mr-1.5 size-3.5" />
            {t('account:avatar.uploadButton')}
          </Button>

          {displayImage && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={removeImage.isPending}
              disabled={isUploading || removeImage.isPending}
              onClick={() =>
                removeImage.mutate({ image: null, imageThumbnail: null })
              }
            >
              <Trash2Icon className="size-3.5" />
            </Button>
          )}
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
