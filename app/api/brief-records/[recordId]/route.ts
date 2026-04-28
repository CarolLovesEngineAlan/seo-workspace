import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";
import { updateBriefGenerationRecordMarkdown } from "@/lib/supabase/opportunity-repository";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ recordId: string }> }
) {
  const access = await getApiAccessContext();

  if (!access?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRequiredRole(access.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "需要配置 Supabase 才能更新 Brief Records。" },
      { status: 400 }
    );
  }

  const { recordId: raw } = await context.params;
  const recordId = decodeURIComponent(raw);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const briefMarkdown =
    typeof body === "object" &&
    body &&
    typeof (body as { briefMarkdown?: unknown }).briefMarkdown === "string"
      ? (body as { briefMarkdown: string }).briefMarkdown
      : "";

  try {
    const record = await updateBriefGenerationRecordMarkdown({
      id: recordId,
      briefMarkdown,
    });

    return NextResponse.json({
      ok: true,
      record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
