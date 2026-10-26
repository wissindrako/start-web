import { beforeEach, vi } from 'vitest';

import {
  mockDb,
  mockGetEffectivePermissions,
  mockGetSession,
  mockSatisfiesPermission,
  mockUserHasPermission,
  setupAuthenticatedUser,
} from '@/server/routers/test-utils';

vi.mock('@/server/auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => mockGetSession(...args),
      userHasPermission: (...args: unknown[]) => mockUserHasPermission(...args),
    },
  },
}));

vi.mock('@tanstack/react-start/server', () => ({
  getRequestHeaders: () => new Headers(),
}));

vi.mock('@/env/client', () => ({
  envClient: {
    VITE_IS_DEMO: false,
  },
}));

vi.mock('@/env/server', () => ({
  envServer: {
    LOGGER_LEVEL: 'error',
    LOGGER_PRETTY: false,
  },
}));

vi.mock('@/server/logger', () => ({
  logger: {
    child: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    }),
  },
}));

vi.mock('@/server/db', () => ({ db: mockDb }));

vi.mock('@/server/permissions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/server/permissions')>();
  mockSatisfiesPermission.mockImplementation(actual.satisfiesPermission);
  return {
    ...actual,
    getEffectivePermissions: (...args: unknown[]) =>
      mockGetEffectivePermissions(...args),
    satisfiesPermission: (
      ...args: Parameters<typeof actual.satisfiesPermission>
    ) => mockSatisfiesPermission(...args),
  };
});

beforeEach(() => {
  vi.clearAllMocks();
  setupAuthenticatedUser();
});
