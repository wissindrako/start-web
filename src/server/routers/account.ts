import { ORPCError } from '@orpc/client';
import { z } from 'zod';

import { zPassword } from '@/features/access-settings/schema';
import { zFormFieldsOnboarding } from '@/features/auth/schema';
import {
  zFormFieldsPersonalData,
  zPersonalData,
} from '@/features/personal-data/schema';
import { zUser } from '@/features/user/schema';
import { protectedProcedure } from '@/server/orpc';
import { hasPassword, setPassword, verifyPassword } from '@/server/passwords';

const tags = ['account'];

export default {
  submitOnboarding: protectedProcedure({
    permission: null,
  })
    .route({
      method: 'POST',
      path: '/account/submit-onboarding',
      tags,
    })
    .input(zFormFieldsOnboarding())
    .output(z.void())
    .handler(async ({ context, input }) => {
      context.logger.info('Update user');
      await context.db.user.update({
        where: { id: context.user.id },
        data: {
          ...input,
          verifiedAt: new Date(),
        },
      });
    }),

  updateInfo: protectedProcedure({
    permission: null,
  })
    .route({
      method: 'POST',
      path: '/account/info',
      tags,
    })
    .input(
      zUser().pick({
        name: true,
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      context.logger.info('Update user');
      await context.db.user.update({
        where: { id: context.user.id },
        data: {
          name: input.name ?? '',
        },
      });
    }),

  passwordStatus: protectedProcedure({ permission: null })
    .route({ method: 'GET', path: '/account/password', tags })
    .input(z.object({}))
    .output(z.object({ hasPassword: z.boolean() }))
    .handler(async ({ context }) => ({
      hasPassword: await hasPassword(context.user.id),
    })),

  // Creates or changes the own password. Changing it asks for the current
  // one; creating it does not (the person signed in with an email code).
  setPassword: protectedProcedure({ permission: null })
    .route({ method: 'POST', path: '/account/password', tags })
    .input(
      z.object({
        currentPassword: z.string().optional(),
        newPassword: zPassword(),
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      if (
        (await hasPassword(context.user.id)) &&
        !(await verifyPassword(context.user.id, input.currentPassword ?? ''))
      ) {
        throw new ORPCError('BAD_REQUEST', {
          message: 'The current password is not correct',
          data: { reason: 'wrongPassword' },
        });
      }
      await setPassword(context.user.id, input.newPassword);
      context.logger.info('Password set');
    }),

  updateImage: protectedProcedure({ permission: null })
    .route({ method: 'POST', path: '/account/image', tags })
    .input(
      z.object({
        image: z.string().nullable(),
        imageThumbnail: z.string().nullable(),
      })
    )
    .output(z.void())
    .handler(async ({ context, input }) => {
      context.logger.info('Update account image');
      await context.db.user.update({
        where: { id: context.user.id },
        data: { image: input.image, imageThumbnail: input.imageThumbnail },
      });
    }),

  getPersonalData: protectedProcedure({ permission: null })
    .route({ method: 'GET', path: '/account/personal-data', tags })
    .input(z.object({}))
    .output(zPersonalData().nullable())
    .handler(async ({ context }) => {
      return await context.db.personalData.findUnique({
        where: { userId: context.user.id },
      });
    }),

  upsertPersonalData: protectedProcedure({ permission: null })
    .route({ method: 'POST', path: '/account/personal-data', tags })
    .input(zFormFieldsPersonalData())
    .output(zPersonalData())
    .handler(async ({ context, input }) => {
      context.logger.info('Upsert account personal data');
      return await context.db.personalData.upsert({
        where: { userId: context.user.id },
        update: input,
        create: { userId: context.user.id, ...input },
      });
    }),
};
