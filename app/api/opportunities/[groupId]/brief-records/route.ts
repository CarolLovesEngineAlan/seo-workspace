import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";
import { fetchBriefGenerationsByGroupId } from "@/lib/supabase/opportunity-repository";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const access = await getApiAccessContext();

  if (!access?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRequiredRole(access.role, "viewer")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "需要配置 Supabase 才能读取 brief 生成记录。" },
      { status: 400 }
    );
  }

  const { groupId: raw } = await context.params;
  const groupId = decodeURIComponent(raw);

  try {
    const records = await fetchBriefGenerationsByGroupId(groupId);
    return NextResponse.json({ ok: true, records });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
