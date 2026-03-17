import { RejectUpload, route } from '@better-upload/server';

import i18n from '@/lib/i18n';

import { auth } from '@/server/auth';

export const userAvatar = route({
  fileTypes: ['image/png', 'image/jpeg', 'image/webp'],
  maxFileSize: 1024 * 1024 * 5, // 5MB
  onBeforeUpload: async ({ req, file }) => {
    const session = await auth.api.getSession(req);
    if (!session?.user) {
      throw new RejectUpload(
        i18n.t('user:manager.uploadErrors.NOT_AUTHENTICATED')
      );
    }

    const fileExtension =
      file.type === 'image/jpeg'
        ? 'jpg'
        : (file.type.split('/').at(-1) as string);
    return {
      objectInfo: {
        key: `users/${crypto.randomUUID()}.${fileExtension}`,
      },
    };
  },
});
