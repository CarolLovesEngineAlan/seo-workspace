import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { listPrompts, createPrompt } from "@/lib/supabase/prompt-system-repository";
import type { PsPageType, PsPromptStep, PsPromptCreate } from "@/lib/types/prompt-system";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const access = await getApiAccessContext();
  if (!access?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "viewer")) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const pageType = searchParams.get("page_type") as PsPageType | null;
  const promptStep = searchParams.get("prompt_step") as PsPromptStep | null;

  try {
    const data = await listPrompts({
      pageType: pageType ?? undefined,
      promptStep: promptStep ?? undefined,
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
    const body = (await request.json()) as PsPromptCreate;
    if (!body.name?.trim()) {
      return NextResponse.json({ error: "name is required" }, { status: 422 });
    }
    const data = await createPrompt(body);
    return NextResponse.json({ ok: true, data }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
