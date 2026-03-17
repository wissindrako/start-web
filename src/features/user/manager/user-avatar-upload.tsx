import { uploadFile } from '@better-upload/client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImageIcon, Trash2Icon, UploadIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';

import { envClient } from '@/env/client';
import { orpc } from '@/lib/orpc/client';
import { resizeImageToSquare } from '@/lib/utils/resize-image';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';

// Profile size: 400×400 — used in detail and edit views
const PROFILE_SIZE = 400;
// Thumbnail size: 80×80 — used in lists and cards
const THUMBNAIL_SIZE = 80;

export const UserAvatarUpload = (props: {
  userId: string;
  currentImage: string | null | undefined;
  currentThumbnail: string | null | undefined;
  userName: string | null | undefined;
}) => {
  const { t } = useTranslation(['user']);
  const queryClient = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const updateImage = useMutation(
    orpc.user.updateImage.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getById.key({ input: { id: props.userId } }),
        });
        toast.success(t('user:manager.update.avatarUpdated'));
      },
      onError: () => {
        toast.error(t('user:manager.update.avatarUpdateError'));
      },
    })
  );

  const removeImage = useMutation(
    orpc.user.updateImage.mutationOptions({
      onSuccess: async () => {
        setPreview(null);
        await queryClient.invalidateQueries({
          queryKey: orpc.user.getById.key({ input: { id: props.userId } }),
        });
        toast.success(t('user:manager.update.avatarRemoved'));
      },
      onError: () => {
        toast.error(t('user:manager.update.avatarUpdateError'));
      },
    })
  );

  const handleFileChange = async (file: File) => {
    setIsUploading(true);
    try {
      // Resize to two sizes in parallel
      const [profileFile, thumbnailFile] = await Promise.all([
        resizeImageToSquare(file, PROFILE_SIZE),
        resizeImageToSquare(file, THUMBNAIL_SIZE),
      ]);

      // Preview immediately with the profile version
      setPreview(URL.createObjectURL(profileFile));

      // Upload both to S3 in parallel
      const [profileResult, thumbnailResult] = await Promise.all([
        uploadFile({ file: profileFile, route: 'userAvatar' }),
        uploadFile({ file: thumbnailFile, route: 'userAvatar' }),
      ]);

      const baseUrl = envClient.VITE_S3_BUCKET_PUBLIC_URL;
      const imageUrl = `${baseUrl}/${profileResult.file.objectInfo.key}`;
      const thumbnailUrl = `${baseUrl}/${thumbnailResult.file.objectInfo.key}`;

      await updateImage.mutateAsync({
        id: props.userId,
        image: imageUrl,
        imageThumbnail: thumbnailUrl,
      });
    } catch {
      toast.error(t('user:manager.update.avatarUploadError'));
      setPreview(null);
    } finally {
      setIsUploading(false);
      // Reset input so same file can be re-selected
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const displayImage = preview ?? props.currentImage ?? null;
  const initials = (props.userName ?? '?')
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-20 rounded-md">
        <AvatarImage src={displayImage ?? undefined} className="object-cover" />
        <AvatarFallback className="rounded-md text-lg">
          {displayImage ? null : (
            <ImageIcon className="size-8 text-muted-foreground" />
          )}
          {!displayImage && initials}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">
          {t('user:manager.update.avatarHint')}
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
            {t('user:manager.update.avatarUploadButton')}
          </Button>

          {(displayImage || props.currentImage) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              loading={removeImage.isPending}
              disabled={isUploading || removeImage.isPending}
              onClick={() =>
                removeImage.mutate({
                  id: props.userId,
                  image: null,
                  imageThumbnail: null,
                })
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
