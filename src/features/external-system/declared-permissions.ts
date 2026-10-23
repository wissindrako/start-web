type Module = { name: string; actions: string[] };
type Permission = { subject: string; action: string };

// Whether the system declares the permission among its modules. A role can
// keep one the system no longer has (e.g. its catalog dropped the module):
// it grants nothing until the system declares it again.
export const isDeclaredPermission = (modules: Module[], p: Permission) =>
  modules.some((m) => m.name === p.subject && m.actions.includes(p.action));

export const undeclaredPermissions = <T extends Permission>(
  modules: Module[],
  permissions: T[]
) => permissions.filter((p) => !isDeclaredPermission(modules, p));
