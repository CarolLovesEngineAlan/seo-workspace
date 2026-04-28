import { NextResponse } from "next/server";
import { getApiAccessContext } from "@/lib/auth/server";
import { hasRequiredRole } from "@/lib/auth/roles";
import { getWorkbenchOpportunityByGroupId } from "@/lib/data/load-opportunities";
import {
  canTransitionWorkflow,
  deriveWorkflowStatus,
  getNextWorkflowStatus,
  getWorkflowSnapshot,
  getWorkflowStatusLabel,
  isWorkflowStatus,
} from "@/lib/opportunity/workflow-status";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";
import { updateOpportunityWorkflow } from "@/lib/supabase/opportunity-repository";
import type {
  PipelineStatus,
  ProductionStage,
  WorkflowStatus,
} from "@/lib/types/opportunity";

export const dynamic = "force-dynamic";

const PIPELINE: PipelineStatus[] = [
  "inbox",
  "in_queue",
  "in_production",
  "shipped",
];

const STAGES: ProductionStage[] = ["none", "brief", "draft", "qa", "done"];

export async function PATCH(
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
      { error: "需要配置 Supabase 才能持久化队列/生产状态（列表仍来自 Notion）" },
      { status: 400 }
    );
  }

  const { groupId: raw } = await context.params;
  const groupId = decodeURIComponent(raw);
  const currentOpportunity = await getWorkbenchOpportunityByGroupId(groupId);

  if (!currentOpportunity) {
    return NextResponse.json({ error: "未找到该机会" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "无效 JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "请求体须为对象" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const patch: Parameters<typeof updateOpportunityWorkflow>[1] = {};
  const currentWorkflowStatus = deriveWorkflowStatus(currentOpportunity);
  let targetWorkflowStatus: WorkflowStatus | null = null;
  let nextPipelineStatus = currentOpportunity.pipelineStatus;
  let nextProductionStage = currentOpportunity.productionStage;

  if (b.workflowStatus !== undefined) {
    if (!isWorkflowStatus(b.workflowStatus)) {
      return NextResponse.json({ error: "无效的 workflowStatus" }, { status: 400 });
    }
    targetWorkflowStatus = b.workflowStatus;
  }

  if (b.pipelineStatus !== undefined) {
    if (
      typeof b.pipelineStatus !== "string" ||
      !PIPELINE.includes(b.pipelineStatus as PipelineStatus)
    ) {
      return NextResponse.json({ error: "无效的 pipelineStatus" }, { status: 400 });
    }
    nextPipelineStatus = b.pipelineStatus as PipelineStatus;
  }

  if (b.productionStage !== undefined) {
    if (
      typeof b.productionStage !== "string" ||
      !STAGES.includes(b.productionStage as ProductionStage)
    ) {
      return NextResponse.json({ error: "无效的 productionStage" }, { status: 400 });
    }
    nextProductionStage = b.productionStage as ProductionStage;
  }

  if (
    targetWorkflowStatus == null &&
    (b.pipelineStatus !== undefined || b.productionStage !== undefined)
  ) {
    targetWorkflowStatus = deriveWorkflowStatus({
      pipelineStatus: nextPipelineStatus,
      productionStage: nextProductionStage,
    });
  }

  if (targetWorkflowStatus != null) {
    if (!canTransitionWorkflow(currentWorkflowStatus, targetWorkflowStatus)) {
      const nextWorkflowStatus = getNextWorkflowStatus(currentWorkflowStatus);
      const nextHint = nextWorkflowStatus
        ? `当前只允许推进到「${getWorkflowStatusLabel(nextWorkflowStatus)}」。`
        : "当前已经处于最终状态。";

      return NextResponse.json(
        {
          error: `当前状态为「${getWorkflowStatusLabel(currentWorkflowStatus)}」，不能直接切换到「${getWorkflowStatusLabel(targetWorkflowStatus)}」。${nextHint}`,
        },
        { status: 400 }
      );
    }

    const snapshot = getWorkflowSnapshot(targetWorkflowStatus);
    patch.pipeline_status = snapshot.pipelineStatus;
    patch.production_stage = snapshot.productionStage;
  }

  if (b.briefMarkdown !== undefined) {
    if (typeof b.briefMarkdown !== "string" || !b.briefMarkdown.trim()) {
      return NextResponse.json({ error: "briefMarkdown 不能为空" }, { status: 400 });
    }
    patch.brief_markdown = b.briefMarkdown;
  }

  if (b.articleDraftMarkdown !== undefined) {
    if (
      typeof b.articleDraftMarkdown !== "string" ||
      !b.articleDraftMarkdown.trim()
    ) {
      return NextResponse.json(
        { error: "articleDraftMarkdown 不能为空" },
        { status: 400 }
      );
    }
    patch.article_draft_markdown = b.articleDraftMarkdown;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json(
      {
        error:
          "至少提供 workflowStatus、pipelineStatus、productionStage、briefMarkdown 或 articleDraftMarkdown 中的一项",
      },
      { status: 400 }
    );
  }

  try {
    await updateOpportunityWorkflow(groupId, patch);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    const status = message.includes("未找到") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }

  return NextResponse.json({
    ok: true,
    groupId,
    workflowStatus: targetWorkflowStatus ?? currentWorkflowStatus,
  });
}
