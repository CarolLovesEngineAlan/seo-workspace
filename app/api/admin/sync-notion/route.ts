import { NextResponse } from "next/server";
import { hasApiRole } from "@/lib/auth/server";
import { syncNotionToSupabase } from "@/lib/sync/sync-notion-to-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/admin/sync-notion
 * 管理员手动触发 Notion → Supabase 快照同步，使用 session 鉴权（需要 admin 角色）。
 */
export async function POST() {
  const isAdmin = await hasApiRole("admin");
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const result = await syncNotionToSupabase();
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    mode: result.mode,
    message: result.message,
    durationMs: result.durationMs,
    syncedAt: result.syncedAt,
    groupCount: result.groupCount,
    deletedCount: result.deletedCount,
  });
}
