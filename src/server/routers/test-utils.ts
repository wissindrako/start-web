import { vi } from 'vitest';

const hoisted = vi.hoisted(() => ({
  mockGetSession: vi.fn(),
  mockUserHasPermission: vi.fn(),
  mockGetEffectivePermissions: vi.fn(),
  mockSatisfiesPermission: vi.fn(),
}));

export const mockGetSession = hoisted.mockGetSession;
export const mockUserHasPermission = hoisted.mockUserHasPermission;
// Effective permissions of the authenticated user (see mockUserPermissions)
export const mockGetEffectivePermissions = hoisted.mockGetEffectivePermissions;
// Spy on the route permission check (wraps the real implementation)
export const mockSatisfiesPermission = hoisted.mockSatisfiesPermission;

import type { Mock } from 'vitest';

import { AVAILABLE_PERMISSIONS } from '@/features/role/schema';
import type { PrismaClient } from '@/server/db/generated/client';

type ModelKeys = {
  [K in keyof PrismaClient]: PrismaClient[K] extends { findMany: unknown }
    ? K
    : never;
}[keyof PrismaClient];

type MockedModel<T> = { [K in keyof T]: Mock };
type MockedDb = { [K in ModelKeys]: MockedModel<PrismaClient[K]> };

// Auto-mock @/server/db: any model property returns a proxy where
// every method is a vi.fn(), so tests don't need to declare the shape.
export const mockDb: MockedDb = new Proxy({} as ExplicitAny, {
  get(target: Record<string, Record<string, unknown>>, model: string) {
    if (!(model in target)) {
      target[model] = new Proxy({} as ExplicitAny, {
        get(methodTarget: Record<string, unknown>, method: string) {
          if (!(method in methodTarget)) {
            methodTarget[method] = vi.fn();
          }
          return methodTarget[method];
        },
      });
    }
    return target[model];
  },
});

export const mockUser = { id: 'user-1', name: 'Test User' };
export const mockSession = { id: 'session-1' };

export function setupAuthenticatedUser() {
  mockGetSession.mockResolvedValue({
    user: mockUser,
    session: mockSession,
  });
  mockUserHasPermission.mockResolvedValue({ success: true, error: false });
  mockUserPermissions('all');
}

const ALL_PERMISSIONS = AVAILABLE_PERMISSIONS.flatMap((p) =>
  p.actions.map((action) => ({ subject: p.subject, action }))
);

/**
 * Sets what the authenticated user can do: 'all' (every permission of the
 * catalog) or a `{ subject: actions[] }` map (`{}` = nothing).
 */
export function mockUserPermissions(
  permissions: 'all' | Record<string, string[]>
) {
  const list =
    permissions === 'all'
      ? ALL_PERMISSIONS
      : Object.entries(permissions).flatMap(([subject, actions]) =>
          actions.map((action) => ({ subject, action }))
        );

  mockGetEffectivePermissions.mockResolvedValue({
    roles: [],
    permissions: list.map((p) => ({ ...p, source: 'role' as const })),
    denied: [],
  });
}
