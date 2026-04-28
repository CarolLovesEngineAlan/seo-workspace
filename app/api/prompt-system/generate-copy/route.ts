import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { assemblePrompt } from "@/lib/supabase/prompt-system-repository";
import { injectVariables } from "@/lib/production/openai-outline";
import { generateCopyStream as generateCopyGemini } from "@/lib/production/gemini-copy";
import { generateOutlineStream as generateCopyBedrock } from "@/lib/production/bedrock-outline";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  promptId: string;
  variables: {
    primary_keyword: string;
    outline: string;
    keyword_variants?: string;
    notes?: string;
  };
};

function ndjsonStream(
  producer: (emit: (payload: Record<string, unknown>) => void) => Promise<void>
): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };
      void producer(emit)
        .catch((err) => {
          emit({ type: "error", error: err instanceof Error ? err.message : String(err) });
        })
        .finally(() => controller.close());
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

export async function POST(request: Request) {
  const access = await getApiAccessContext();
  if (!access?.user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!hasRequiredRole(access.role, "editor"))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { promptId, variables } = body;

  if (!promptId?.trim()) {
    return NextResponse.json({ error: "promptId is required" }, { status: 422 });
  }
  if (!variables?.primary_keyword?.trim()) {
    return NextResponse.json({ error: "primary_keyword is required" }, { status: 422 });
  }
  if (!variables?.outline?.trim()) {
    return NextResponse.json({ error: "outline is required" }, { status: 422 });
  }

  let assembled: Awaited<ReturnType<typeof assemblePrompt>>;
  try {
    assembled = await assemblePrompt(promptId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  const userVars: Record<string, string> = {
    primary_keyword: variables.primary_keyword.trim(),
    outline: variables.outline.trim(),
    keyword_variants: variables.keyword_variants?.trim() ?? "",
    notes: variables.notes?.trim() ?? "",
  };

  const finalPrompt = injectVariables(assembled.assembledText, userVars);

  const generateCopy =
    assembled.pageType === "model_page" ? generateCopyBedrock : generateCopyGemini;

  return ndjsonStream(async (emit) => {
    emit({ type: "start", promptName: assembled.promptName });

    let rawOutput = "";
    const { model } = await generateCopy(finalPrompt, (delta) => {
      rawOutput += delta;
      emit({ type: "delta", delta });
    });

    // Try to extract and validate JSON from the output
    let copyJson: unknown = null;
    let jsonError: string | null = null;
    try {
      // Strip markdown code fences if model wrapped the JSON
      const cleaned = rawOutput
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      copyJson = JSON.parse(cleaned);
    } catch (err) {
      jsonError = err instanceof Error ? err.message : String(err);
    }

    emit({ type: "done", rawOutput, copyJson, jsonError, model });
  });
}
