import type { User } from "@supabase/supabase-js";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { SUPABASE_TABLES } from "@/lib/supabase/table-names";
import { isAppRole, type AppRole } from "@/lib/auth/roles";

export type ManagedUserAccess = {
  id: string;
  email: string;
  displayName: string | null;
  role: AppRole | null;
  createdAt: string | null;
  lastSignInAt: string | null;
};

type UserRoleRow = {
  user_id: string;
  role: string;
};

function toDisplayName(user: User): string | null {
  const fullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name.trim()
      : "";
  const name =
    typeof user.user_metadata?.name === "string"
      ? user.user_metadata.name.trim()
      : "";

  return fullName || name || null;
}

async function fetchUserRolesMap(): Promise<Map<string, AppRole>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.userRoles)
    .select("user_id, role");

  if (error) {
    throw new Error(`读取用户角色失败: ${error.message}`);
  }

  const map = new Map<string, AppRole>();
  for (const row of (data ?? []) as UserRoleRow[]) {
    if (isAppRole(row.role)) {
      map.set(row.user_id, row.role);
    }
  }

  return map;
}

export async function listManagedUsers(): Promise<ManagedUserAccess[]> {
  const supabase = getSupabaseAdmin();
  const rolesMap = await fetchUserRolesMap();

  const users: User[] = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw new Error(`读取 Supabase Auth 用户失败: ${error.message}`);
    }

    users.push(...(data.users ?? []));

    if ((data.users ?? []).length < perPage) {
      break;
    }

    page += 1;
  }

  return users
    .map((user) => ({
      id: user.id,
      email: user.email || "",
      displayName: toDisplayName(user),
      role: rolesMap.get(user.id) ?? null,
      createdAt: user.created_at || null,
      lastSignInAt: user.last_sign_in_at || null,
    }))
    .sort((left, right) => (right.createdAt || "").localeCompare(left.createdAt || ""));
}

export async function setManagedUserRole(params: {
  userId: string;
  email: string;
  role: AppRole | null;
  grantedBy: string;
}): Promise<AppRole | null> {
  const supabase = getSupabaseAdmin();

  if (params.role === null) {
    const { error } = await supabase
      .from(SUPABASE_TABLES.userRoles)
      .delete()
      .eq("user_id", params.userId);

    if (error) {
      throw new Error(`移除用户权限失败: ${error.message}`);
    }

    return null;
  }

  const { error } = await supabase.from(SUPABASE_TABLES.userRoles).upsert(
    {
      user_id: params.userId,
      email: params.email.trim().toLowerCase(),
      role: params.role,
      granted_by: params.grantedBy,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );

  if (error) {
    throw new Error(`更新用户权限失败: ${error.message}`);
  }

  return params.role;
}
