export const appRoles = ["viewer", "editor", "admin"] as const;

export type AppRole = (typeof appRoles)[number];

export type AppPermissionSet = {
  canRead: boolean;
  canWrite: boolean;
  canManageUsers: boolean;
};

const roleRank: Record<AppRole, number> = {
  viewer: 1,
  editor: 2,
  admin: 3,
};

export function isAppRole(value: string): value is AppRole {
  return (appRoles as readonly string[]).includes(value);
}

export function hasRequiredRole(
  currentRole: AppRole | null,
  requiredRole: AppRole
): boolean {
  if (!currentRole) {
    return false;
  }

  return roleRank[currentRole] >= roleRank[requiredRole];
}

export function getRolePermissions(role: AppRole | null): AppPermissionSet {
  if (role === "admin") {
    return {
      canRead: true,
      canWrite: true,
      canManageUsers: true,
    };
  }

  if (role === "editor") {
    return {
      canRead: true,
      canWrite: true,
      canManageUsers: false,
    };
  }

  if (role === "viewer") {
    return {
      canRead: true,
      canWrite: false,
      canManageUsers: false,
    };
  }

  return {
    canRead: false,
    canWrite: false,
    canManageUsers: false,
  };
}
