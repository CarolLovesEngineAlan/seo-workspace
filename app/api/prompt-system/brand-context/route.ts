import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { getBrandContext, upsertBrandContext } from "@/lib/supabase/prompt-system-repository";
import type { BrandContextUpdate } from "@/lib/types/prompt-system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const access = await getApiAccessContext();
  if (!access?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "viewer")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const data = await getBrandContext();
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const access = await getApiAccessContext();
  if (!access?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "editor")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as BrandContextUpdate;
    const data = await upsertBrandContext(body);
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
