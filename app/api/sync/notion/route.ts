import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/api/cron-auth";
import { syncNotionToSupabase } from "@/lib/sync/sync-notion-to-supabase";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * 与 Cron 共用 syncNotionToSupabase，手动触发 Notion -> Supabase 快照同步。
 * GET/POST 均需 Authorization: Bearer <CRON_SECRET>
 */
export async function GET(request: Request) {
  return handleSync(request);
}

export async function POST(request: Request) {
  return handleSync(request);
}

async function handleSync(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
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
