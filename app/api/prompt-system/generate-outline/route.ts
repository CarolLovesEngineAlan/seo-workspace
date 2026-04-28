import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { assemblePrompt } from "@/lib/supabase/prompt-system-repository";
import { generateOutlineStream, injectVariables } from "@/lib/production/openai-outline";
import { generateOutlineStream as generateOutlineStreamBedrock } from "@/lib/production/bedrock-outline";

const useBedrockProvider = (process.env.OUTLINE_PROVIDER ?? "").toLowerCase() === "bedrock";
const _generateOutlineStream = useBedrockProvider ? generateOutlineStreamBedrock : generateOutlineStream;
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type RequestBody = {
  promptId: string;
  variables: {
    primary_keyword: string;
    keyword_variants?: string;
    competitor_notes?: string;
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

  // Assemble the base prompt (brand_context + internal_link_library substituted)
  let assembled: Awaited<ReturnType<typeof assemblePrompt>>;
  try {
    assembled = await assemblePrompt(promptId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 404 });
  }

  // Inject user-provided variables
  const userVars: Record<string, string> = {
    primary_keyword: variables.primary_keyword.trim(),
    keyword_variants: variables.keyword_variants?.trim() ?? "",
    competitor_notes: variables.competitor_notes?.trim() ?? "",
    notes: variables.notes?.trim() ?? "",
  };

  const finalPrompt = injectVariables(assembled.assembledText, userVars);

  return ndjsonStream(async (emit) => {
    emit({ type: "start", promptName: assembled.promptName });

    const { markdown, model } = await _generateOutlineStream(finalPrompt, (delta) => {
      emit({ type: "delta", delta });
    });

    emit({ type: "done", markdown, model });
  });
}
