import { NextResponse } from "next/server";
import { getWorkbenchOpportunityByGroupId } from "@/lib/data/load-opportunities";
import { fetchSerpTop10, SerpApiNotConfiguredError } from "@/lib/production/serp-research";
import { generateContentStrategyWithAi } from "@/lib/production/content-strategy-ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(
  _request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const { groupId: raw } = await context.params;
  const groupId = decodeURIComponent(raw);

  const o = await getWorkbenchOpportunityByGroupId(groupId);
  if (!o) {
    return NextResponse.json({ error: "未找到该机会" }, { status: 404 });
  }

  try {
    const serp = await fetchSerpTop10(o.mainKeyword);
    const { markdown, model } = await generateContentStrategyWithAi(o, serp);

    return NextResponse.json({ ok: true, markdown, model, serpCount: serp.organic.length });
  } catch (e) {
    if (e instanceof SerpApiNotConfiguredError) {
      return NextResponse.json({ error: e.message, code: "serp_not_configured" }, { status: 400 });
    }
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
