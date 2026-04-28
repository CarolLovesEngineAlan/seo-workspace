import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { syncNotionToSupabase } from "@/lib/sync/sync-notion-to-supabase";

/**
 * Vercel Cron：GET /api/cron/notion-sync
 * 校验 Authorization: Bearer <CRON_SECRET>，与 .env / Vercel 环境变量一致。
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "CRON_SECRET is not configured" },
      { status: 500 }
    );
  }

  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await syncNotionToSupabase();
  if (!result.ok) {
    return NextResponse.json(
      { ok: false, error: result.error },
      { status: 500 }
    );
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
