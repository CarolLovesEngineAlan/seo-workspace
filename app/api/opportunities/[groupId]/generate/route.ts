import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { buildBriefInputSummary } from "@/lib/production/brief-inputs";
import { buildExportBundleMarkdown } from "@/lib/production/export-markdown";
import {
  generateBriefMarkdownStreamWithOpenAi,
  generateBriefMarkdownWithOpenAi,
} from "@/lib/production/openai-brief";
import {
  generateDraftMarkdownStreamWithOpenAi,
  generateDraftMarkdownWithOpenAi,
} from "@/lib/production/openai-draft";
import { formatQaChecklistMarkdown, buildQaChecklist } from "@/lib/production/qa-checklist";
import { buildWhyNowText } from "@/lib/production/why-now";
import { getWorkbenchOpportunityByGroupId } from "@/lib/data/load-opportunities";
import {
  canGenerateBriefFromStatus,
  canGenerateDraftFromStatus,
  canMarkReadyToUploadFromStatus,
  deriveWorkflowStatus,
  getWorkflowSnapshot,
  getWorkflowStatusLabel,
} from "@/lib/opportunity/workflow-status";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";
import {
  fetchLatestBriefGenerationByGroupId,
  insertBriefGenerationRecords,
  updateOpportunityWorkflow,
} from "@/lib/supabase/opportunity-repository";
import { findPromptDetailById } from "@/lib/prompts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type GenerateKind = "brief" | "draft" | "why_now" | "qa" | "export";
const INLINE_BRIEF_BATCH_MAX = 5;
const INLINE_BRIEF_BATCH_CONCURRENCY = 2;

type GeneratedBriefItem = {
  recordInput: Parameters<typeof insertBriefGenerationRecords>[0][number];
  markdown: string;
  model: string;
  mainKeyword: string;
};

function createNdjsonResponse(
  producer: (emit: (payload: Record<string, unknown>) => void) => Promise<void>
) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const emit = (payload: Record<string, unknown>) => {
        controller.enqueue(
          encoder.encode(`${JSON.stringify(payload)}\n`)
        );
      };

      void producer(emit)
        .catch((error) => {
          const message = error instanceof Error ? error.message : String(error);
          emit({ type: "error", error: message });
        })
        .finally(() => {
          controller.close();
        });
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-cache, no-transform",
    },
  });
}

function pickDefaultBriefRow(
  mainKeyword: string,
  rows: NonNullable<Awaited<ReturnType<typeof getWorkbenchOpportunityByGroupId>>>["sourceKeywordRows"]
) {
  const availableRows = rows ?? [];
  if (availableRows.length === 0) {
    return null;
  }

  const normalizedMainKeyword = mainKeyword.trim().toLowerCase();
  return (
    availableRows.find(
      (row) => row.mainKeyword.trim().toLowerCase() === normalizedMainKeyword
    ) ?? availableRows[0]
  );
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const safeConcurrency = Math.max(1, Math.min(concurrency, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  await Promise.all(
    Array.from({ length: safeConcurrency }, async () => {
      while (nextIndex < items.length) {
        const currentIndex = nextIndex;
        nextIndex += 1;
        results[currentIndex] = await mapper(items[currentIndex], currentIndex);
      }
    })
  );

  return results;
}

function buildBriefBatchMarkdown(items: GeneratedBriefItem[]): string {
  if (items.length === 1) {
    return items[0].markdown;
  }

  return [
    `# Brief Batch · ${items.length} briefs`,
    "",
    ...items.flatMap((item, index) => [
      `## ${index + 1}. ${item.mainKeyword}`,
      "",
      item.markdown.trim(),
      "",
      "---",
      "",
    ]),
  ]
    .join("\n")
    .replace(/\n---\n\s*$/, "\n");
}

export async function POST(
  request: Request,
  context: { params: Promise<{ groupId: string }> }
) {
  const access = await getApiAccessContext();

  if (!access?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!hasRequiredRole(access.role, "editor")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "需要配置 Supabase 才能持久化 Brief/草稿/why_now（主数据仍来自 Notion）" },
      { status: 400 }
    );
  }

  const { groupId: raw } = await context.params;
  const groupId = decodeURIComponent(raw);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const kind = (typeof body === "object" &&
    body &&
    typeof (body as { kind?: unknown }).kind === "string" &&
    (body as { kind: string }).kind) as GenerateKind | undefined;
  const selectedKeywordIds =
    typeof body === "object" && body
      ? Array.isArray((body as { selectedKeywordIds?: unknown }).selectedKeywordIds)
        ? (body as { selectedKeywordIds: unknown[] }).selectedKeywordIds
            .map((value) => (typeof value === "string" ? value.trim() : ""))
            .filter(Boolean)
      : []
    : [];
  const streamRequested =
    typeof body === "object" &&
    body != null &&
      (body as { stream?: unknown }).stream === true;
  const rawPromptId =
    typeof body === "object" && body
      ? (body as { promptId?: unknown }).promptId
      : undefined;
  const promptId =
    typeof rawPromptId === "string" && rawPromptId.trim()
      ? rawPromptId.trim()
      : "";

  const promptDetail = promptId
    ? await findPromptDetailById(promptId)
    : null;

  if (promptId && !promptDetail) {
    return NextResponse.json(
      { error: "选中的 Prompt 无效或已删除。" },
      { status: 400 }
    );
  }

  if (!kind || !["brief", "draft", "why_now", "qa", "export"].includes(kind)) {
    return NextResponse.json(
      { error: "body.kind 须为 brief | draft | why_now | qa | export" },
      { status: 400 }
    );
  }

  const o = await getWorkbenchOpportunityByGroupId(groupId);
  if (!o) {
    return NextResponse.json({ error: "未找到该机会" }, { status: 404 });
  }

  const workflowStatus = deriveWorkflowStatus(o);

  try {
    if (kind === "brief") {
      if (!canGenerateBriefFromStatus(workflowStatus)) {
        return NextResponse.json(
          {
            error: `当前状态为「${getWorkflowStatusLabel(workflowStatus)}」，只有「待生产」才能生成 Brief。`,
          },
          { status: 400 }
        );
      }

      const selectedRowsById = new Map(
        (o.sourceKeywordRows ?? []).map((row) => [row.notionPageId, row])
      );
      const defaultRow = pickDefaultBriefRow(o.mainKeyword, o.sourceKeywordRows);
      const selectedRows =
        selectedKeywordIds.length > 0
          ? selectedKeywordIds
              .map((rowId) => selectedRowsById.get(rowId) ?? null)
              .filter((row): row is NonNullable<typeof row> => row != null)
          : defaultRow
            ? [defaultRow]
            : [];

      if (selectedRows.length === 0) {
        return NextResponse.json(
          {
            error:
              "当前机会没有可用的 source_keyword_rows，无法生成 Brief。请先确认夜间同步是否把同组关键词行写入快照。",
          },
          { status: 400 }
        );
      }

      if (selectedRows.length > INLINE_BRIEF_BATCH_MAX) {
        return NextResponse.json(
          {
            error: `当前同步模式一次最多生成 ${INLINE_BRIEF_BATCH_MAX} 条 brief。你本次选择了 ${selectedRows.length} 条 MAIN_KEYWORD，请拆批执行；若后续需要更大批量，建议改为异步任务队列。`,
          },
          { status: 400 }
        );
      }

      const whyNow = o.whyNow ?? buildWhyNowText(o);

      if (streamRequested && selectedRows.length === 1) {
        const selectedRow = selectedRows[0];

        return createNdjsonResponse(async (emit) => {
          emit({ type: "start", kind, groupId });

          const { markdown, model } = await generateBriefMarkdownStreamWithOpenAi(
            {
              opportunity: { ...o, whyNow },
              selectedRows: [selectedRow],
              promptDocumentOverride: promptDetail?.content,
            },
            (delta) => emit({ type: "delta", delta })
          );

          const inputs = buildBriefInputSummary([
            {
              mainKeyword: selectedRow.mainKeyword,
              contentType: selectedRow.contentType,
              contentTypeLlm: selectedRow.contentTypeLlm,
              intent: selectedRow.intent,
              keywordVariants: selectedRow.keywordVariants,
              topicClusterName: o.topicClusterName,
              internalLinkRole: o.internalLinkRole,
              pageBrief: o.pageBrief,
            },
          ]);
          const nextWorkflow = getWorkflowSnapshot("brief_done");

          await updateOpportunityWorkflow(groupId, {
            pipeline_status: nextWorkflow.pipelineStatus,
            brief_markdown: markdown,
            why_now: whyNow,
            production_stage: nextWorkflow.productionStage,
          });

          const records = await insertBriefGenerationRecords([
            {
              groupId,
              selectedRowIds: [selectedRow.notionPageId],
              inputMainKeywords: inputs.mainKeywords,
              inputContentTypes: inputs.contentTypes,
              inputIntents: inputs.intents,
              inputKeywordVariants: inputs.keywordVariants,
              inputTopicClusterNames: inputs.topicClusterNames,
              inputInternalLinkRoles: inputs.internalLinkRoles,
              inputPageBriefs: inputs.pageBriefs,
              briefMarkdown: markdown,
              model,
            },
          ]);

          emit({
            type: "done",
            kind,
            markdown,
            model,
            records,
            generatedCount: records.length,
            pipelineStatus: nextWorkflow.pipelineStatus,
            productionStage: nextWorkflow.productionStage,
            whyNow,
          });
        });
      }

      const generatedBriefs = await mapWithConcurrency(
        selectedRows,
        INLINE_BRIEF_BATCH_CONCURRENCY,
        async (row) => {
          const { markdown, model } = await generateBriefMarkdownWithOpenAi({
            opportunity: { ...o, whyNow },
            selectedRows: [row],
            promptDocumentOverride: promptDetail?.content,
          });
          const inputs = buildBriefInputSummary([
            {
              mainKeyword: row.mainKeyword,
              contentType: row.contentType,
              contentTypeLlm: row.contentTypeLlm,
              intent: row.intent,
              keywordVariants: row.keywordVariants,
              topicClusterName: o.topicClusterName,
              internalLinkRole: o.internalLinkRole,
              pageBrief: o.pageBrief,
            },
          ]);

          return {
            mainKeyword: row.mainKeyword,
            markdown,
            model,
            recordInput: {
              groupId,
              selectedRowIds: [row.notionPageId],
              inputMainKeywords: inputs.mainKeywords,
              inputContentTypes: inputs.contentTypes,
              inputIntents: inputs.intents,
              inputKeywordVariants: inputs.keywordVariants,
              inputTopicClusterNames: inputs.topicClusterNames,
              inputInternalLinkRoles: inputs.internalLinkRoles,
              inputPageBriefs: inputs.pageBriefs,
              briefMarkdown: markdown,
              model,
            },
          } satisfies GeneratedBriefItem;
        }
      );
      const combinedMarkdown = buildBriefBatchMarkdown(generatedBriefs);
      const nextWorkflow = getWorkflowSnapshot("brief_done");

      await updateOpportunityWorkflow(groupId, {
        pipeline_status: nextWorkflow.pipelineStatus,
        brief_markdown: combinedMarkdown,
        why_now: whyNow,
        production_stage: nextWorkflow.productionStage,
      });

      const records = await insertBriefGenerationRecords(
        generatedBriefs.map((item) => item.recordInput)
      );

      return NextResponse.json({
        ok: true,
        kind,
        markdown: combinedMarkdown,
        records,
        generatedCount: records.length,
      });
    }

    if (kind === "draft") {
      if (!canGenerateDraftFromStatus(workflowStatus)) {
        return NextResponse.json(
          {
            error: `当前状态为「${getWorkflowStatusLabel(workflowStatus)}」，只有「Brief 完成」才能生成初稿。`,
          },
          { status: 400 }
        );
      }

      const latestBriefRecord = await fetchLatestBriefGenerationByGroupId(groupId);

      if (streamRequested) {
        return createNdjsonResponse(async (emit) => {
          emit({ type: "start", kind, groupId });

          const { markdown, model } = await generateDraftMarkdownStreamWithOpenAi(
            {
              opportunity: o,
              latestBriefRecord,
            },
            (delta) => emit({ type: "delta", delta })
          );

          const nextWorkflow = getWorkflowSnapshot("draft_done");
          await updateOpportunityWorkflow(groupId, {
            pipeline_status: nextWorkflow.pipelineStatus,
            article_draft_markdown: markdown,
            production_stage: nextWorkflow.productionStage,
          });

          emit({
            type: "done",
            kind,
            markdown,
            model,
            briefRecordId: latestBriefRecord?.id ?? null,
            pipelineStatus: nextWorkflow.pipelineStatus,
            productionStage: nextWorkflow.productionStage,
          });
        });
      }

      const { markdown, model } = await generateDraftMarkdownWithOpenAi({
        opportunity: o,
        latestBriefRecord,
      });
      const nextWorkflow = getWorkflowSnapshot("draft_done");
      await updateOpportunityWorkflow(groupId, {
        pipeline_status: nextWorkflow.pipelineStatus,
        article_draft_markdown: markdown,
        production_stage: nextWorkflow.productionStage,
      });
      return NextResponse.json({
        ok: true,
        kind,
        markdown,
        model,
        briefRecordId: latestBriefRecord?.id ?? null,
      });
    }

    if (kind === "why_now") {
      const text = buildWhyNowText(o);
      await updateOpportunityWorkflow(groupId, {
        why_now: text,
      });
      return NextResponse.json({ ok: true, kind, markdown: text });
    }

    if (kind === "qa") {
      if (!canMarkReadyToUploadFromStatus(workflowStatus)) {
        return NextResponse.json(
          {
            error: `当前状态为「${getWorkflowStatusLabel(workflowStatus)}」，只有「初稿完成」才能进入待上传。`,
          },
          { status: 400 }
        );
      }

      const markdown = formatQaChecklistMarkdown(buildQaChecklist(o));
      const nextWorkflow = getWorkflowSnapshot("ready_to_upload");
      await updateOpportunityWorkflow(groupId, {
        pipeline_status: nextWorkflow.pipelineStatus,
        production_stage: nextWorkflow.productionStage,
      });
      return NextResponse.json({ ok: true, kind, markdown });
    }

    const markdown = buildExportBundleMarkdown(o);
    return NextResponse.json({ ok: true, kind, markdown });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
