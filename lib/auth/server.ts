import type { User } from "@supabase/supabase-js";
import {
  getRolePermissions,
  type AppPermissionSet,
  type AppRole,
} from "@/lib/auth/roles";

export type AccessContext = {
  user: User;
  role: AppRole | null;
  permissions: AppPermissionSet;
};

export type AuthorizedAccessContext = AccessContext & {
  role: AppRole;
};

const GUEST_USER = {
  id: "guest",
  email: "guest@local",
  app_metadata: {},
  user_metadata: {},
  aud: "authenticated",
  created_at: new Date(0).toISOString(),
} as unknown as User;

const GUEST_CONTEXT: AuthorizedAccessContext = {
  user: GUEST_USER,
  role: "admin",
  permissions: getRolePermissions("admin"),
};

export async function ensureBootstrapAdmin(_user: User): Promise<AppRole | null> {
  return "admin";
}

export async function getAccessContext(): Promise<AccessContext | null> {
  return GUEST_CONTEXT;
}

export async function requirePageRole(
  _requiredRole: AppRole
): Promise<AuthorizedAccessContext> {
  return GUEST_CONTEXT;
}

export async function requirePageRoleForPath(
  _requiredRole: AppRole,
  _nextPath: string
): Promise<AuthorizedAccessContext> {
  return GUEST_CONTEXT;
}

export async function getApiAccessContext(): Promise<AccessContext | null> {
  return GUEST_CONTEXT;
}

export async function hasApiRole(_requiredRole: AppRole): Promise<boolean> {
  return true;
}
