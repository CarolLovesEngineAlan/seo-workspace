import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { isAppRole } from "@/lib/auth/roles";
import { setManagedUserRole } from "@/lib/auth/admin";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ userId: string }> }
) {
  const access = await getApiAccessContext();

  if (!access?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (access.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { userId: raw } = await context.params;
  const userId = decodeURIComponent(raw);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const email =
    typeof body === "object" &&
    body &&
    typeof (body as { email?: unknown }).email === "string"
      ? (body as { email: string }).email
      : "";
  const rawRole =
    typeof body === "object" && body ? (body as { role?: unknown }).role : undefined;

  if (!email.trim()) {
    return NextResponse.json({ error: "缺少用户 email。" }, { status: 400 });
  }

  if (rawRole !== null && (typeof rawRole !== "string" || !isAppRole(rawRole))) {
    return NextResponse.json({ error: "无效的角色。" }, { status: 400 });
  }

  try {
    const role = await setManagedUserRole({
      userId,
      email,
      role: rawRole === null ? null : rawRole,
      grantedBy: access.user.id,
    });
    return NextResponse.json({ ok: true, role });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
