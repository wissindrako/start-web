import { z } from 'zod';

import { protectedProcedure, publicProcedure } from '@/server/orpc';

const tags = ['system-config'];

// The singleton row of the system config (see prisma/schema.prisma)
const SINGLETON_ID = '00000000-0000-0000-0000-000000000001';

const zSystemConfigOutput = z.object({
  systemName: z.string().nullish(),
  logoUrl: z.string().nullish(),
});

export default {
  get: publicProcedure()
    .route({ method: 'GET', path: '/system-config', tags })
    .output(zSystemConfigOutput)
    .handler(async ({ context }) => {
      const config = await context.db.systemConfig.findUnique({
        where: { id: SINGLETON_ID },
      });
      return {
        systemName: config?.systemName ?? null,
        logoUrl: config?.logoUrl ?? null,
      };
    }),

  update: protectedProcedure({
    permission: { systemConfig: ['update'] },
  })
    .route({ method: 'POST', path: '/system-config', tags })
    .input(
      z.object({
        systemName: z.string().trim().nullish(),
        logoUrl: z.string().nullish(),
      })
    )
    .output(zSystemConfigOutput)
    .handler(async ({ context, input }) => {
      context.logger.info('Updating system config');
      return await context.db.systemConfig.upsert({
        where: { id: SINGLETON_ID },
        create: {
          id: SINGLETON_ID,
          systemName: input.systemName ?? null,
          logoUrl: input.logoUrl ?? null,
        },
        update: {
          systemName: input.systemName ?? null,
          logoUrl: input.logoUrl ?? null,
        },
      });
    }),
};
