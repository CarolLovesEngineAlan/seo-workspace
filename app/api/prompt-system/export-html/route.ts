import { NextResponse } from "next/server";
import { renderPageHtml } from "@/lib/production/html-renderer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { pageType, json } = (await request.json()) as {
      pageType?: string;
      json?: unknown;
    };
    if (!pageType || json == null) {
      return NextResponse.json({ error: "pageType 和 json 必填" }, { status: 400 });
    }
    const html = renderPageHtml(pageType, json);
    return new NextResponse(html, {
      status: 200,
      headers: { "Content-Type": "text/html;charset=utf-8" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "导出失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
