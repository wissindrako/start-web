import { z } from 'zod';

import {
  isValidDomain,
  normalizeDomain,
} from '@/features/access-settings/domains';
import { zAccessSettings } from '@/features/access-settings/schema';
import { Permission } from '@/features/auth/permissions';
import {
  ACCESS_SETTINGS_ID,
  getAccessSettings,
  reloadAccessSettings,
} from '@/server/access-settings';
import { protectedProcedure, publicProcedure } from '@/server/orpc';

const tags = ['access-settings'];

const permission: Permission = { systemConfig: ['update'] };

export default {
  // Public: the login pages and the manager show what they imply
  get: publicProcedure()
    .route({ method: 'GET', path: '/access-settings', tags })
    .output(zAccessSettings())
    .handler(() => getAccessSettings()),

  update: protectedProcedure({ permission })
    .route({ method: 'PUT', path: '/access-settings', tags })
    .input(
      zAccessSettings().extend({
        allowedDomains: z
          .array(
            z
              .string()
              .transform(normalizeDomain)
              .refine(isValidDomain, { error: 'Invalid domain' })
          )
          .max(50)
          .transform((domains) => [...new Set(domains)]),
      })
    )
    .output(zAccessSettings())
    .handler(async ({ context, input }) => {
      await context.db.accessSettings.upsert({
        where: { id: ACCESS_SETTINGS_ID },
        create: { id: ACCESS_SETTINGS_ID, ...input },
        update: input,
      });
      reloadAccessSettings();
      context.logger.info(
        {
          signupEnabled: input.signupEnabled,
          allowedDomains: input.allowedDomains,
          twoFactorRequired: input.twoFactorRequired,
        },
        'Access settings updated'
      );
      return await getAccessSettings();
    }),
};
