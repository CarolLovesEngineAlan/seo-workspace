import { NextResponse } from "next/server";

import { readPromptLibrary } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  try {
    const library = await readPromptLibrary();
    return NextResponse.json(library);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法获取 prompt 列表。";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
