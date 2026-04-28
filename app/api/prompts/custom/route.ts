import { NextResponse } from "next/server";

import { saveCustomPrompt } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    id?: string;
    name?: string;
    description?: string | null;
    content?: string;
  };

  const name = (body.name ?? "").trim();
  const content = body.content ?? "";

  if (!name) {
    return NextResponse.json(
      { error: "Prompt 名称不能为空。" },
      { status: 422 }
    );
  }

  if (!content.trim()) {
    return NextResponse.json(
      { error: "Prompt 内容不能为空。" },
      { status: 422 }
    );
  }

  try {
    const prompt = await saveCustomPrompt({
      id: body.id,
      name: name,
      description: body.description ?? null,
      content,
    });

    return NextResponse.json({ ok: true, prompt });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "无法保存自定义 Prompt。";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
