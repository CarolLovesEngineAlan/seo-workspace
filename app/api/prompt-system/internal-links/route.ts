import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { listInternalLinks, createInternalLink } from "@/lib/supabase/prompt-system-repository";
import type { PsPageCategory, PsLinkPriority, PsInternalLinkCreate } from "@/lib/types/prompt-system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await getApiAccessContext();
  if (!access?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "viewer")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") as PsPageCategory | null;
  const priority = searchParams.get("priority") as PsLinkPriority | null;

  try {
    const data = await listInternalLinks({
      category: category ?? undefined,
      priority: priority ?? undefined,
    });
    return NextResponse.json({ ok: true, data });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const access = await getApiAccessContext();
  if (!access?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "editor")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const body = (await request.json()) as PsInternalLinkCreate;
    if (!body.pageTitle?.trim()) {
      return NextResponse.json({ error: "pageTitle is required" }, { status: 422 });
    }
    if (!body.url?.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 422 });
    }
    const data = await createInternalLink(body);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
