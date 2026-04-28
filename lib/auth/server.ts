import type { User } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { isSupabaseAuthConfigured } from "@/lib/supabase/auth-config";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SUPABASE_TABLES } from "@/lib/supabase/table-names";
import { getErrorMessage, withTimeout } from "@/lib/utils/promise";
import {
  getRolePermissions,
  hasRequiredRole,
  isAppRole,
  type AppPermissionSet,
  type AppRole,
} from "@/lib/auth/roles";

const AUTH_USER_TIMEOUT_MS = 5_000;
const ROLE_LOOKUP_TIMEOUT_MS = 5_000;

export type AccessContext = {
  user: User;
  role: AppRole | null;
  permissions: AppPermissionSet;
};

export type AuthorizedAccessContext = AccessContext & {
  role: AppRole;
};

function normalizeEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase();
  return email || null;
}

function getBootstrapAdminEmails(): string[] {
  return (process.env.AUTH_ADMIN_EMAILS || "")
    .split(",")
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

function isBootstrapAdminEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  return getBootstrapAdminEmails().includes(normalized);
}

async function fetchStoredUserRole(userId: string): Promise<AppRole | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await withTimeout(
    supabase
      .from(SUPABASE_TABLES.userRoles)
      .select("role")
      .eq("user_id", userId)
      .maybeSingle(),
    ROLE_LOOKUP_TIMEOUT_MS,
    "Supabase 用户角色读取"
  );

  if (error) {
    throw new Error(`读取用户权限失败: ${error.message}`);
  }

  const role = data?.role != null ? String(data.role) : null;
  return role && isAppRole(role) ? role : null;
}

async function fetchCurrentUser(context: string): Promise<User | null> {
  const supabase = await createSupabaseServerClient();

  try {
    const {
      data: { user },
      error,
    } = await withTimeout(
      supabase.auth.getUser(),
      AUTH_USER_TIMEOUT_MS,
      `${context} Supabase Auth`
    );

    if (error) {
      console.warn(`[${context}] Supabase auth skipped:`, error.message);
      return null;
    }

    return user;
  } catch (error) {
    console.warn(`[${context}] Supabase auth skipped:`, getErrorMessage(error));
    return null;
  }
}

export async function ensureBootstrapAdmin(user: User): Promise<AppRole | null> {
  const existingRole = await fetchStoredUserRole(user.id);

  if (existingRole) {
    return existingRole;
  }

  if (!isBootstrapAdminEmail(user.email)) {
    return null;
  }

  const supabase = getSupabaseAdmin();
  const { error } = await withTimeout(
    supabase.from(SUPABASE_TABLES.userRoles).upsert(
      {
        user_id: user.id,
        email: normalizeEmail(user.email) || "",
        role: "admin",
        granted_by: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    ),
    ROLE_LOOKUP_TIMEOUT_MS,
    "Supabase 管理员初始化"
  );

  if (error) {
    throw new Error(`初始化管理员权限失败: ${error.message}`);
  }

  return "admin";
}

export async function getAccessContext(): Promise<AccessContext | null> {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const user = await fetchCurrentUser("getAccessContext");

  if (!user) {
    return null;
  }

  let role: AppRole | null = null;

  try {
    role = await ensureBootstrapAdmin(user);
  } catch (error) {
    console.warn(
      "[getAccessContext] Failed to resolve app role:",
      getErrorMessage(error)
    );
  }

  return {
    user,
    role,
    permissions: getRolePermissions(role),
  };
}

export async function requirePageRole(
  requiredRole: AppRole
): Promise<AuthorizedAccessContext> {
  const access = await getAccessContext();

  if (!access?.user) {
    redirect(`/login?next=${encodeURIComponent("/workbench")}`);
  }

  if (!hasRequiredRole(access.role, requiredRole)) {
    redirect("/unauthorized");
  }

  return access as AuthorizedAccessContext;
}

export async function requirePageRoleForPath(
  requiredRole: AppRole,
  nextPath: string
): Promise<AuthorizedAccessContext> {
  const access = await getAccessContext();

  if (!access?.user) {
    redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  }

  if (!hasRequiredRole(access.role, requiredRole)) {
    redirect("/unauthorized");
  }

  return access as AuthorizedAccessContext;
}

export async function getApiAccessContext(): Promise<AccessContext | null> {
  if (!isSupabaseAuthConfigured()) {
    return null;
  }

  const user = await fetchCurrentUser("getApiAccessContext");

  if (!user) {
    return null;
  }

  let role: AppRole | null = null;

  try {
    role = await ensureBootstrapAdmin(user);
  } catch (error) {
    console.warn(
      "[getApiAccessContext] Failed to resolve app role:",
      getErrorMessage(error)
    );
  }

  return {
    user,
    role,
    permissions: getRolePermissions(role),
  };
}

export async function hasApiRole(requiredRole: AppRole): Promise<boolean> {
  const access = await getApiAccessContext();
  return hasRequiredRole(access?.role ?? null, requiredRole);
}
