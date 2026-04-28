"use client";

import type { ReactNode } from "react";
import { useDeferredValue, useEffect, useMemo, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Activity,
  ArrowRight,
  Check,
  Circle,
  FileText,
  Layers,
  Rocket,
  ShieldAlert,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InfoTip } from "@/components/ui/info-tip";
import { buildArticleDraftMarkdown } from "@/lib/production/article-draft";
import { buildBriefV2Markdown } from "@/lib/production/brief-v2";
import { buildExportBundleMarkdown } from "@/lib/production/export-markdown";
import { buildQaChecklist } from "@/lib/production/qa-checklist";
import { buildWhyNowText } from "@/lib/production/why-now";
import type {
  PipelineStatus,
  ProductionStage,
  WorkbenchOpportunity,
} from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

type Scope = "all" | "top" | "queue" | "review";
type GenerateKind = "brief" | "draft" | "why_now" | "qa" | "export";
type DetailView = "why_now" | "brief" | "draft" | "qa";
type MessageTone = "info" | "success" | "error";
type IconComponent = typeof Sparkles;
type UiMessage = { tone: MessageTone; text: string } | null;
type AssetSection = {
  id: DetailView;
  label: string;
  eyebrow: string;
  icon: IconComponent;
  status: string;
  tone: "ready" | "pending";
  metric: string;
  summary: string;
  content: string | null;
  placeholder: string;
};

const numberFormatter = new Intl.NumberFormat("zh-CN");
const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
  month: "numeric",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const scopeOptions: Array<{
  id: Scope;
  label: string;
  hint: string;
  icon: IconComponent;
}> = [
  { id: "all", label: "全部", hint: "全量聚合池", icon: Layers },
  { id: "top", label: "优先", hint: "本周 Top 信号", icon: Sparkles },
  { id: "queue", label: "执行", hint: "已入队或生产中", icon: Activity },
  { id: "review", label: "复核", hint: "异常与人工判断", icon: ShieldAlert },
];

const flowSteps = [
  { id: "intake", label: "Opportunity Intake", hint: "关键词聚合完成" },
  { id: "queue", label: "Strategy Queue", hint: "进入排期列表" },
  { id: "brief", label: "Brief", hint: "生成 brief_v2" },
  { id: "draft", label: "Draft", hint: "输出文章骨架" },
  { id: "qa", label: "QA", hint: "执行标准清单" },
  { id: "ship", label: "Export", hint: "导出或发布" },
];

const pipelineRank: Record<WorkbenchOpportunity["pipelineStatus"], number> = {
  inbox: 0,
  in_queue: 1,
  in_production: 2,
  shipped: 3,
};

const stageRank: Record<WorkbenchOpportunity["productionStage"], number> = {
  none: 0,
  brief: 1,
  draft: 2,
  qa: 3,
  done: 4,
};

function pipelineLabel(status: WorkbenchOpportunity["pipelineStatus"]): string {
  const map: Record<WorkbenchOpportunity["pipelineStatus"], string> = {
    inbox: "收件箱",
    in_queue: "策略队列",
    in_production: "生产中",
    shipped: "已发布",
  };
  return map[status];
}

function stageLabel(stage: WorkbenchOpportunity["productionStage"]): string {
  const map: Record<WorkbenchOpportunity["productionStage"], string> = {
    none: "未开始",
    brief: "Brief",
    draft: "草稿",
    qa: "QA",
    done: "完成",
  };
  return map[stage];
}

function normalizeScope(scope: string | null): Scope {
  if (scope === "top" || scope === "queue" || scope === "review") {
    return scope;
  }
  return "all";
}

function applyScope(
  opportunities: WorkbenchOpportunity[],
  scope: Scope
): WorkbenchOpportunity[] {
  switch (scope) {
    case "top":
      return opportunities
        .filter((item) => !item.needsReview)
        .slice(0, Math.min(8, opportunities.length));
    case "queue":
      return opportunities.filter(
        (item) =>
          item.pipelineStatus === "in_queue" ||
          item.pipelineStatus === "in_production"
      );
    case "review":
      return opportunities.filter((item) => item.needsReview);
    default:
      return opportunities;
  }
}

function splitSegments(value: string): string[] {
  return value
    .split("|")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item, index, array) => array.indexOf(item) === index);
}

function priorityMeta(opportunity: WorkbenchOpportunity) {
  if (opportunity.needsReview) {
    return {
      label: "Needs review",
      chipClass:
        "border-rose-400/25 bg-rose-500/10 text-rose-100",
      meter: Math.min(Math.max(opportunity.opportunityScore, 0), 120),
    };
  }
  if (opportunity.opportunityScore >= 105) {
    return {
      label: "Deploy this week",
      chipClass:
        "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
      meter: Math.min(opportunity.opportunityScore, 120),
    };
  }
  if (opportunity.opportunityScore >= 90) {
    return {
      label: "Strong signal",
      chipClass:
        "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
      meter: Math.min(opportunity.opportunityScore, 120),
    };
  }
  return {
    label: "Watchlist",
    chipClass:
      "surface-chip future-ring border-border/70 text-muted-foreground",
    meter: Math.min(opportunity.opportunityScore, 120),
  };
}

function recommendedAction(opportunity: WorkbenchOpportunity): string {
  if (opportunity.needsReview) {
    return "先确认 same_page_group_id 与 content_type，再决定是否进入自动生产流程。";
  }
  if (opportunity.pipelineStatus === "inbox") {
    return opportunity.opportunityScore >= 100
      ? "纳入本周策略队列，先生成 why now 与 Brief。"
      : "继续放在机会雷达池观察，等待更多上下文或业务窗口。";
  }
  if (opportunity.pipelineStatus === "in_queue") {
    return opportunity.briefMarkdown
      ? "Brief 已具备，可以进入 Draft 生成并准备 QA。"
      : "先补齐 why now 与 Brief，再交给内容生产。";
  }
  if (opportunity.pipelineStatus === "in_production") {
    return opportunity.articleDraftMarkdown
      ? "草稿已出现，下一步重点转到 QA 与导出。"
      : "继续补齐 Draft，并确认结构与关键词覆盖。";
  }
  return "这条机会已具备完整产出，适合沉淀为团队的已完成案例与方法模板。";
}

function formatSyncTime(value: string | null): string {
  if (!value) {
    return "未同步";
  }
  const date = new Date(value);
  if (Number.isNaN(date.valueOf())) {
    return "未同步";
  }
  return dateFormatter.format(date);
}

function signalValue(opportunity: WorkbenchOpportunity, kind: "volume" | "competition" | "coverage" | "readiness"): number {
  if (kind === "volume") {
    return Math.min((opportunity.volume / 1500) * 100, 100);
  }
  if (kind === "competition") {
    return Math.max(0, 100 - opportunity.kd);
  }
  if (kind === "coverage") {
    return Math.min(opportunity.variantCount * 12, 100);
  }
  return Math.min(
    (opportunity.pageBrief.trim().length > 30 ? 45 : 0) +
      (opportunity.whyNow ? 25 : 0) +
      (opportunity.briefMarkdown ? 20 : 0) +
      (opportunity.articleDraftMarkdown ? 10 : 0),
    100
  );
}

function stepState(
  opportunity: WorkbenchOpportunity,
  stepId: (typeof flowSteps)[number]["id"]
): "done" | "current" | "upcoming" {
  const currentPipelineRank = pipelineRank[opportunity.pipelineStatus];
  const currentStageRank = stageRank[opportunity.productionStage];

  if (stepId === "intake") {
    return "done";
  }
  if (stepId === "queue") {
    return currentPipelineRank >= 1 ? "done" : "current";
  }
  if (stepId === "brief") {
    if (currentStageRank >= 1) return "done";
    return currentPipelineRank >= 1 ? "current" : "upcoming";
  }
  if (stepId === "draft") {
    if (currentStageRank >= 2) return "done";
    return currentStageRank === 1 ? "current" : "upcoming";
  }
  if (stepId === "qa") {
    if (currentStageRank >= 3) return "done";
    return currentStageRank === 2 ? "current" : "upcoming";
  }
  if (opportunity.pipelineStatus === "shipped" || currentStageRank >= 4) {
    return "done";
  }
  return currentStageRank >= 3 ? "current" : "upcoming";
}

function extractSnippet(value: string | null, fallback: string): string {
  return (value?.trim() || fallback)
    .split("\n")
    .map((item) => item.replace(/^[-#*\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
}

function countMeaningfulLines(value: string | null): number {
  return (value?.trim() || "")
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function downloadMarkdown(markdown: string, filenameBase: string) {
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filenameBase.slice(0, 40).replace(/\s+/g, "-")}.md`;
  anchor.click();
  URL.revokeObjectURL(url);
}

type Props = {
  opportunities: WorkbenchOpportunity[];
  supabaseMode: boolean;
  dataSource: "supabase" | "fallback";
};

export function WorkbenchThreeColumn({
  opportunities,
  supabaseMode,
  dataSource,
}: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isNavigating, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Partial<WorkbenchOpportunity>>
  >({});
  const [qaReadyById, setQaReadyById] = useState<Record<string, boolean>>({});
  const [detailView, setDetailView] = useState<DetailView | null>(null);
  const reduceMotion = useReducedMotion() ?? false;

  const scope = normalizeScope(searchParams.get("scope"));
  const focusedId = searchParams.get("focus");

  const mergedOpportunities = useMemo(
    () =>
      opportunities.map((item) => ({
        ...item,
        ...(localOverrides[item.groupId] ?? {}),
      })),
    [localOverrides, opportunities]
  );

  const deferredOpportunities = useDeferredValue(mergedOpportunities);

  const filteredOpportunities = useMemo(
    () => applyScope(deferredOpportunities, scope),
    [deferredOpportunities, scope]
  );

  const selected = useMemo(() => {
    if (filteredOpportunities.length === 0) {
      return deferredOpportunities[0] ?? null;
    }
    if (focusedId) {
      const focused = filteredOpportunities.find(
        (item) => item.groupId === focusedId
      );
      if (focused) {
        return focused;
      }
    }
    return filteredOpportunities[0] ?? null;
  }, [deferredOpportunities, filteredOpportunities, focusedId]);

  const pending = busy || isNavigating;
  const queueCount = mergedOpportunities.filter(
    (item) =>
      item.pipelineStatus === "in_queue" ||
      item.pipelineStatus === "in_production"
  ).length;
  const productionCount = mergedOpportunities.filter(
    (item) => item.productionStage !== "none"
  ).length;

  function updateQuery(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    }

    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    });
  }

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function applyLocalPatch(
    groupId: string,
    patch: Partial<WorkbenchOpportunity>
  ) {
    setLocalOverrides((current) => ({
      ...current,
      [groupId]: {
        ...(current[groupId] ?? {}),
        ...patch,
        syncedAt: new Date().toISOString(),
      },
    }));
  }

  function handleScopeChange(nextScope: Scope) {
    const nextOpportunities = applyScope(mergedOpportunities, nextScope);
    const nextFocus =
      nextOpportunities.find((item) => item.groupId === selected?.groupId)?.groupId ??
      nextOpportunities[0]?.groupId ??
      null;

    updateQuery({
      scope: nextScope === "all" ? null : nextScope,
      focus: nextFocus,
    });
  }

  function handleSelectOpportunity(groupId: string) {
    updateQuery({ focus: groupId });
  }

  async function patchPipeline(
    groupId: string,
    body: {
      pipelineStatus?: PipelineStatus;
      productionStage?: ProductionStage;
    }
  ) {
    if (!supabaseMode) {
      applyLocalPatch(groupId, body);
      setMessage({
        tone: "success",
        text:
          dataSource === "fallback"
            ? "已在系统保障数据模式更新工作流状态。"
            : "已在当前会话更新工作流状态。",
      });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(groupId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setMessage({
          tone: "error",
          text: data.error ?? response.statusText,
        });
        return;
      }
      setMessage({
        tone: "success",
        text: "工作流状态已持久化。",
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  function generateLocally(kind: GenerateKind) {
    if (!selected) return;

    if (kind === "why_now") {
      applyLocalPatch(selected.groupId, {
        whyNow: buildWhyNowText(selected),
        productionStage:
          selected.productionStage === "none" ? "brief" : selected.productionStage,
      });
      setMessage({ tone: "success", text: "Why now 已在本地生成。" });
      return;
    }

    if (kind === "brief") {
      const next = selected.whyNow
        ? selected
        : { ...selected, whyNow: buildWhyNowText(selected) };

      applyLocalPatch(selected.groupId, {
        pipelineStatus:
          selected.pipelineStatus === "inbox"
            ? "in_queue"
            : selected.pipelineStatus,
        productionStage: "brief",
        whyNow: next.whyNow,
        briefMarkdown: buildBriefV2Markdown(next),
      });
      setMessage({ tone: "success", text: "Brief v2 已在本地生成。" });
      return;
    }

    if (kind === "draft") {
      const withWhyNow = selected.whyNow
        ? selected
        : { ...selected, whyNow: buildWhyNowText(selected) };
      const withBrief = withWhyNow.briefMarkdown
        ? withWhyNow
        : {
            ...withWhyNow,
            briefMarkdown: buildBriefV2Markdown(withWhyNow),
          };

      applyLocalPatch(selected.groupId, {
        pipelineStatus:
          selected.pipelineStatus === "shipped"
            ? "shipped"
            : "in_production",
        productionStage: "draft",
        whyNow: withBrief.whyNow,
        briefMarkdown: withBrief.briefMarkdown,
        articleDraftMarkdown: buildArticleDraftMarkdown(withBrief),
      });
      setMessage({ tone: "success", text: "文章骨架已在本地生成。" });
      return;
    }

    if (kind === "qa") {
      setQaReadyById((current) => ({
        ...current,
        [selected.groupId]: true,
      }));
      applyLocalPatch(selected.groupId, {
        productionStage: "qa",
      });
      setMessage({ tone: "success", text: "QA checklist 已就绪。" });
      return;
    }

    downloadMarkdown(
      buildExportBundleMarkdown(selected),
      `export-${selected.mainKeyword}`
    );
    setMessage({ tone: "success", text: "Markdown 导出已开始。" });
  }

  async function generate(kind: GenerateKind) {
    if (!selected) return;

    if (!supabaseMode) {
      generateLocally(kind);
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind }),
        }
      );
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          tone: "error",
          text: data.error ?? response.statusText,
        });
        return;
      }

      if (kind === "qa") {
        setQaReadyById((current) => ({
          ...current,
          [selected.groupId]: true,
        }));
      }

      if (kind === "export" && typeof data.markdown === "string") {
        downloadMarkdown(data.markdown, `export-${selected.mainKeyword}`);
        setMessage({ tone: "success", text: "Markdown 导出已开始。" });
        return;
      }

      setMessage({
        tone: "success",
        text:
          kind === "why_now"
            ? "Why now 已持久化。"
            : kind === "brief"
              ? "Brief v2 已持久化。"
              : kind === "draft"
                ? "文章骨架已持久化。"
                : "QA 状态已更新。",
      });
      refresh();
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (!detailView) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDetailView(null);
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [detailView]);

  if (!selected) {
    return (
      <Card className="surface-panel rounded-[2rem] border border-border/70">
        <CardHeader>
          <CardTitle>暂无可展示机会</CardTitle>
          <CardDescription>
            当前没有命中筛选条件的机会，切换视图或补充数据后再试。
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const primaryKeywords = splitSegments(selected.allKeywords).slice(0, 8);
  const variants = splitSegments(selected.keywordVariants).slice(0, 8);
  const whyNow = selected.whyNow ?? buildWhyNowText(selected);
  const whyNowSegments = whyNow
    .split("。")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 4);
  const qaItems = buildQaChecklist(selected);
  const qaReady =
    selected.productionStage === "qa" ||
    selected.productionStage === "done" ||
    qaReadyById[selected.groupId] === true;
  const priority = priorityMeta(selected);
  const detailSections: AssetSection[] = [
    {
      id: "why_now",
      label: "Why Now",
      eyebrow: "Strategy",
      icon: Sparkles,
      status: selected.whyNow ? "ready" : "standby",
      tone: selected.whyNow ? "ready" : "pending",
      metric: `${whyNowSegments.length} signals`,
      summary: whyNowSegments[0] || "等待策略信号",
      content: whyNow,
      placeholder: "等待策略信号",
    },
    {
      id: "brief",
      label: "Brief",
      eyebrow: "Production",
      icon: FileText,
      status: selected.briefMarkdown ? "ready" : "standby",
      tone: selected.briefMarkdown ? "ready" : "pending",
      metric: `${countMeaningfulLines(selected.briefMarkdown)} lines`,
      summary: extractSnippet(selected.briefMarkdown, "等待 Brief"),
      content: selected.briefMarkdown,
      placeholder: "等待 Brief",
    },
    {
      id: "draft",
      label: "Draft",
      eyebrow: "Content",
      icon: FileText,
      status: selected.articleDraftMarkdown ? "ready" : "standby",
      tone: selected.articleDraftMarkdown ? "ready" : "pending",
      metric: `${countMeaningfulLines(selected.articleDraftMarkdown)} lines`,
      summary: extractSnippet(selected.articleDraftMarkdown, "等待 Draft"),
      content: selected.articleDraftMarkdown,
      placeholder: "等待 Draft",
    },
    {
      id: "qa",
      label: "QA",
      eyebrow: "Checklist",
      icon: Check,
      status: qaReady ? "ready" : "pending",
      tone: qaReady ? "ready" : "pending",
      metric: `${qaItems.length} rules`,
      summary: qaReady ? "发布前检查已就绪" : "等待 QA 激活",
      content: qaItems.map((item) => item.label).join("\n"),
      placeholder: "等待 QA",
    },
  ];
  const activeDetail =
    detailSections.find((item) => item.id === detailView) ?? detailSections[0];

  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
        <Card className="surface-panel rounded-[2rem] border border-border/70">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardDescription>Opportunity Radar</CardDescription>
              <CardTitle className="text-2xl">机会池视图</CardTitle>
            </div>
            <Badge
              variant="outline"
              className="surface-chip future-ring rounded-full border-border/70"
            >
              {dataSource === "fallback" ? "fallback" : "snapshot"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {scopeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.id}
                  type="button"
                  title={option.hint}
                  aria-pressed={scope === option.id}
                  onClick={() => handleScopeChange(option.id)}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-left text-xs transition-colors touch-manipulation",
                    scope === option.id
                      ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(116,231,255,0.1)]"
                      : "surface-chip future-ring border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                  )}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span className="font-medium">{option.label}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <TinyStat
              label="当前命中"
              value={numberFormatter.format(filteredOpportunities.length)}
              hint="基于当前筛选结果"
            />
            <TinyStat
              label="执行覆盖"
              value={numberFormatter.format(queueCount)}
              hint={`${numberFormatter.format(productionCount)} 条已进入生产阶段`}
            />
          </div>

          <ul className="content-auto max-h-[760px] space-y-3 overflow-y-auto pr-1 overscroll-contain">
            {filteredOpportunities.length === 0 ? (
              <li className="surface-soft future-ring rounded-[1.5rem] border border-border/70 px-4 py-5 text-sm leading-6 text-muted-foreground">
                当前视图暂无机会，切换范围继续查看。
              </li>
            ) : (
              filteredOpportunities.map((opportunity) => {
                const meta = priorityMeta(opportunity);
                const isSelected = opportunity.groupId === selected.groupId;
                return (
                  <li key={opportunity.groupId}>
                    <button
                      type="button"
                      aria-current={isSelected ? "true" : undefined}
                      disabled={pending}
                      onClick={() => handleSelectOpportunity(opportunity.groupId)}
                      className={cn(
                        "group w-full rounded-[1.6rem] border p-4 text-left transition-all touch-manipulation future-lift",
                        isSelected
                          ? "border-primary/30 bg-primary/10 shadow-[0_18px_36px_rgba(89,210,255,0.12)]"
                          : "surface-soft future-ring border-border/70 hover:border-primary/25"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <span
                            className={cn(
                              "inline-flex rounded-full border px-2 py-1 text-[10px] font-medium uppercase tracking-[0.24em]",
                              meta.chipClass
                            )}
                          >
                            {meta.label}
                          </span>
                          <p className="mt-3 line-clamp-2 text-sm font-semibold text-foreground">
                            {opportunity.mainKeyword}
                          </p>
                        </div>
                        <div className="surface-chip future-ring rounded-2xl border border-border/70 px-3 py-2 text-right">
                          <span className="block text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            score
                          </span>
                          <span className="block text-base font-semibold tabular-nums">
                            {opportunity.opportunityScore}
                          </span>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Badge
                          variant="secondary"
                          className="rounded-full bg-secondary/70"
                        >
                          {pipelineLabel(opportunity.pipelineStatus)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70"
                        >
                          {stageLabel(opportunity.productionStage)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="rounded-full border-border/70"
                        >
                          {opportunity.resolvedContentType}
                        </Badge>
                      </div>

                      <div className="mt-4 space-y-2">
                        <div className="h-1.5 rounded-full bg-muted/70">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-300 to-emerald-300"
                            style={{ width: `${(meta.meter / 120) * 100}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                          <span>Vol {numberFormatter.format(opportunity.volume)}</span>
                          <span>KD {opportunity.kd}</span>
                          <span>Var {opportunity.variantCount}</span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </CardContent>
        </Card>

        <div className="space-y-5">
          <Card className="surface-panel rounded-[2rem] border border-border/70">
          <CardHeader className="pb-4">
            <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "inline-flex rounded-full border px-3 py-1 text-xs font-medium",
                      priority.chipClass
                    )}
                  >
                    {priority.label}
                  </span>
                  <Badge variant="secondary" className="rounded-full">
                    {pipelineLabel(selected.pipelineStatus)}
                  </Badge>
                  <Badge
                    variant="outline"
                    className="surface-chip future-ring rounded-full border-border/70"
                  >
                    {stageLabel(selected.productionStage)}
                  </Badge>
                  <Badge
                    variant={selected.needsReview ? "destructive" : "outline"}
                    className="rounded-full"
                  >
                    {selected.needsReview ? "needs review" : selected.resolvedContentType}
                  </Badge>
                  <InfoTip
                    content={
                      selected.pageBrief ||
                      "当前还没有补充业务上下文，建议在进入内容生产前先补齐页面 brief。"
                    }
                  />
                </div>
                <CardTitle className="mt-4 text-3xl md:text-[2.4rem]">
                  {selected.mainKeyword}
                </CardTitle>
                <div className="mt-4 flex flex-wrap gap-2">
                  <MetaChip
                    label="Cluster"
                    value={selected.topicClusterName || "—"}
                  />
                  <MetaChip
                    label="Role"
                    value={selected.internalLinkRole || "—"}
                  />
                  <MetaChip label="Intent" value={selected.intent || "—"} />
                  <MetaChip
                    label="Sync"
                    value={formatSyncTime(selected.syncedAt)}
                  />
                </div>
              </div>

              <div className="surface-soft future-ring rounded-[1.6rem] border border-border/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.22em] text-primary">
                    Next Move
                  </p>
                  <InfoTip content={recommendedAction(selected)} />
                </div>
                <div className="mt-4 grid gap-2">
                  <VisualRow
                    label="Cluster"
                    value={selected.topicClusterName || "—"}
                  />
                  <VisualRow
                    label="Role"
                    value={selected.internalLinkRole || "—"}
                  />
                  <VisualRow
                    label="Sync"
                    value={formatSyncTime(selected.syncedAt)}
                  />
                </div>
                <div className="mt-4 h-1.5 rounded-full bg-muted/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-300 to-emerald-300"
                    style={{ width: `${(priority.meter / 120) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5">
            <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
              <MetricTile
                label="Opportunity score"
                value={String(selected.opportunityScore)}
                hint={priority.label}
              />
              <MetricTile
                label="Search demand"
                value={numberFormatter.format(selected.volume)}
                hint="聚合后 volume"
              />
              <MetricTile
                label="Difficulty"
                value={String(selected.kd)}
                hint="竞争难度"
              />
              <MetricTile
                label="Variants"
                value={String(selected.variantCount)}
                hint={`${selected.rowCount} 条源记录`}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
              <div className="space-y-4">
                <InsightPanel title="Why Now" eyebrow="Decision Copy">
                  <div className="flex flex-wrap gap-2">
                    {whyNowSegments.length > 0 ? (
                      whyNowSegments.map((item) => (
                        <span
                          key={item}
                          className="surface-chip future-ring rounded-full border border-border/70 px-3 py-1.5 text-xs text-foreground"
                        >
                          {item}
                        </span>
                      ))
                    ) : (
                      <p className="text-sm text-muted-foreground">等待策略信号。</p>
                    )}
                  </div>
                </InsightPanel>

                <div className="grid gap-4 lg:grid-cols-2">
                  <InsightPanel title="Primary Coverage" eyebrow="Keywords">
                    <div className="flex flex-wrap gap-2">
                      {primaryKeywords.length > 0 ? (
                        primaryKeywords.map((item) => (
                          <span
                            key={item}
                            className="surface-chip future-ring rounded-full border border-border/70 px-3 py-1.5 text-xs text-foreground"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">暂无关键词集合。</p>
                      )}
                    </div>
                  </InsightPanel>

                  <InsightPanel title="Variants & URLs" eyebrow="Context">
                    <div className="flex flex-wrap gap-2">
                      {variants.length > 0 ? (
                        variants.map((item) => (
                          <span
                            key={item}
                            className="surface-chip future-ring rounded-full border border-border/70 px-3 py-1.5 text-xs text-foreground"
                          >
                            {item}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          当前没有额外变体词。
                        </p>
                      )}
                    </div>
                    {selected.sourceUrls.length > 0 ? (
                      <div className="mt-4 space-y-2">
                        {selected.sourceUrls.slice(0, 2).map((url) => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-2 text-sm text-primary underline-offset-4 hover:underline"
                          >
                            <ArrowRight className="size-3.5" aria-hidden />
                            <span className="truncate">{url}</span>
                          </a>
                        ))}
                      </div>
                    ) : null}
                  </InsightPanel>
                </div>
              </div>

              <InsightPanel title="Decision Signals" eyebrow="Explainability">
                <div className="space-y-4">
                  <SignalMeter
                    label="Demand window"
                    value={signalValue(selected, "volume")}
                    note={`Volume ${numberFormatter.format(selected.volume)}`}
                  />
                  <SignalMeter
                    label="Competition window"
                    value={signalValue(selected, "competition")}
                    note={`KD ${selected.kd}`}
                  />
                  <SignalMeter
                    label="Coverage breadth"
                    value={signalValue(selected, "coverage")}
                    note={`${selected.variantCount} 个关键词变体`}
                  />
                  <SignalMeter
                    label="Production readiness"
                    value={signalValue(selected, "readiness")}
                    note={
                      selected.briefMarkdown
                        ? "已有 brief"
                        : "优先补齐 why now / brief"
                    }
                  />
                </div>
              </InsightPanel>
            </div>
          </CardContent>
          </Card>

          <Card className="surface-panel rounded-[2rem] border border-border/70">
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription>Execution Studio</CardDescription>
                <CardTitle className="text-2xl">生产与状态推进</CardTitle>
              </div>
              <Badge
                variant="outline"
                className="surface-chip future-ring rounded-full border-border/70"
              >
                {supabaseMode ? "persistent" : "session mode"}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
            <div className="space-y-4">
              {message ? (
                <div
                  aria-live="polite"
                  role={message.tone === "error" ? "alert" : "status"}
                  className={cn(
                    "rounded-[1.4rem] border px-4 py-3 text-sm leading-6",
                    message.tone === "error"
                      ? "border-destructive/35 bg-destructive/10 text-rose-100"
                      : message.tone === "success"
                        ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                        : "surface-soft future-ring border-border/70 text-muted-foreground"
                  )}
                >
                  {message.text}
                </div>
              ) : null}

              {isNavigating ? (
                <p aria-live="polite" className="text-xs text-muted-foreground">
                  正在同步工作台视图…
                </p>
              ) : null}

              <div className="surface-soft future-ring rounded-[1.6rem] border border-border/70 p-4">
                <p className="text-xs uppercase tracking-[0.22em] text-primary">
                  Workflow Status
                </p>
                <div className="mt-4 space-y-3">
                  {flowSteps.map((step) => (
                    <WorkflowStep
                      key={step.id}
                      label={step.label}
                      hint={step.hint}
                      state={stepState(selected, step.id)}
                    />
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <ActionButton
                  icon={Target}
                  label={
                    selected.pipelineStatus === "in_queue"
                      ? "移回收件箱"
                      : "加入本周策略队列"
                  }
                  hint="决定这条机会是否纳入本周推进列表"
                  disabled={pending}
                  onClick={() =>
                    patchPipeline(selected.groupId, {
                      pipelineStatus:
                        selected.pipelineStatus === "in_queue" ? "inbox" : "in_queue",
                    })
                  }
                />
                <ActionButton
                  icon={Layers}
                  label="标记为生产中"
                  hint="进入 content production 阶段"
                  disabled={pending}
                  onClick={() =>
                    patchPipeline(selected.groupId, {
                      pipelineStatus: "in_production",
                    })
                  }
                />
                <ActionButton
                  icon={Rocket}
                  label="标记为已发布"
                  hint="把它作为完整闭环案例展示"
                  disabled={pending}
                  onClick={() =>
                    patchPipeline(selected.groupId, {
                      pipelineStatus: "shipped",
                      productionStage:
                        selected.productionStage === "none"
                          ? "done"
                          : selected.productionStage,
                    })
                  }
                />
              </div>

              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                <ActionButton
                  icon={Sparkles}
                  label="Why now"
                  hint="补齐策略解释"
                  disabled={pending}
                  onClick={() => generate("why_now")}
                  compact
                />
                <ActionButton
                  icon={FileText}
                  label="Brief v2"
                  hint="生成结构化 brief"
                  disabled={pending}
                  onClick={() => generate("brief")}
                  compact
                />
                <ActionButton
                  icon={FileText}
                  label="Article draft"
                  hint="生成文章骨架"
                  disabled={pending}
                  onClick={() => generate("draft")}
                  compact
                />
                <ActionButton
                  icon={Check}
                  label="QA checklist"
                  hint="执行规则检查"
                  disabled={pending}
                  onClick={() => generate("qa")}
                  compact
                />
                <ActionButton
                  icon={Rocket}
                  label="Export markdown"
                  hint="导出工作流内容包"
                  disabled={pending}
                  onClick={() => generate("export")}
                  compact
                  className="sm:col-span-2 xl:col-span-1"
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                {detailSections.map((section) => (
                  <AssetTile
                    key={section.id}
                    section={section}
                    onOpen={() => setDetailView(section.id)}
                  />
                ))}
              </div>

              <div className="surface-soft future-ring rounded-[1.6rem] border border-border/70 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">
                      Asset Deck
                    </p>
                    <InfoTip content="主画面只保留资产状态卡，完整内容移入右侧抽屉查看。" />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {detailSections.map((section) => (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => setDetailView(section.id)}
                        className="surface-chip future-ring inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs text-foreground transition-colors hover:border-primary/30 hover:text-primary"
                      >
                        <section.icon className="size-3.5" aria-hidden />
                        <span>{section.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
      <DetailSheet
        open={detailView !== null}
        active={activeDetail}
        sections={detailSections}
        selected={selected}
        qaItems={qaItems}
        qaReady={qaReady}
        onClose={() => setDetailView(null)}
        onSelect={setDetailView}
        reduceMotion={reduceMotion}
      />
    </>
  );
}

function TinyStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      title={hint}
      className="surface-soft future-ring rounded-[1.45rem] border border-border/70 px-4 py-3"
    >
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div
      title={hint}
      className="surface-soft future-ring rounded-[1.5rem] border border-border/70 p-4"
    >
      <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function InsightPanel({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: ReactNode;
}) {
  return (
    <div className="surface-soft future-ring rounded-[1.6rem] border border-border/70 p-4">
      <p className="text-xs uppercase tracking-[0.22em] text-primary">{eyebrow}</p>
      <p className="mt-2 text-lg font-semibold text-foreground">{title}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function SignalMeter({
  label,
  value,
  note,
}: {
  label: string;
  value: number;
  note: string;
}) {
  return (
    <div title={note}>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium text-foreground">{label}</span>
        <span className="text-muted-foreground">{Math.round(value)}</span>
      </div>
      <div className="mt-2 h-2 rounded-full bg-muted/70">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary via-cyan-300 to-emerald-300"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function WorkflowStep({
  label,
  hint,
  state,
}: {
  label: string;
  hint: string;
  state: "done" | "current" | "upcoming";
}) {
  return (
    <div
      title={hint}
      className={cn(
        "flex items-center gap-3 rounded-[1.25rem] border px-3 py-3",
        state === "done"
          ? "border-emerald-400/25 bg-emerald-400/12 shadow-[0_0_0_1px_rgba(52,211,153,0.08)]"
          : state === "current"
            ? "border-primary/30 bg-primary/14 shadow-[0_0_0_1px_rgba(116,231,255,0.1)]"
            : "surface-soft future-ring border-border/70"
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          state === "done"
            ? "border-emerald-400/30 text-emerald-100"
            : state === "current"
              ? "border-primary/30 text-primary"
              : "border-border/70 text-muted-foreground"
        )}
      >
        {state === "done" ? (
          <Check className="size-3.5" aria-hidden />
        ) : state === "current" ? (
          <Target className="size-3.5" aria-hidden />
        ) : (
          <Circle className="size-3" aria-hidden />
        )}
      </span>
      <p className="min-w-0 text-sm font-medium text-foreground">{label}</p>
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  hint,
  disabled,
  onClick,
  compact = false,
  className,
}: {
  icon: IconComponent;
  label: string;
  hint: string;
  disabled?: boolean;
  onClick: () => void;
  compact?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      title={hint}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "surface-soft future-ring future-lift flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-border/70 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
        compact && "px-3 py-3",
        className
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden />
        </span>
        <span className="min-w-0 text-sm font-medium text-foreground">{label}</span>
      </div>
      <ArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </button>
  );
}

function AssetTile({
  section,
  onOpen,
}: {
  section: AssetSection;
  onOpen: () => void;
}) {
  const Icon = section.icon;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="surface-soft future-ring future-lift w-full rounded-[1.6rem] border border-border/70 p-4 text-left"
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex size-11 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
          <Icon className="size-5" aria-hidden />
        </span>
        <Badge
          variant="outline"
          className={cn(
            "rounded-full border",
            section.tone === "ready"
              ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
              : "border-border/70 bg-transparent text-muted-foreground"
          )}
        >
          {section.status}
        </Badge>
      </div>
      <div className="mt-6">
        <p className="text-xs uppercase tracking-[0.22em] text-primary">
          {section.eyebrow}
        </p>
        <p className="mt-2 text-lg font-semibold text-foreground">
          {section.label}
        </p>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {section.summary}
        </p>
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
            signal
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {section.metric}
          </p>
        </div>
      </div>
    </button>
  );
}

function MetaChip({ label, value }: { label: string; value: string }) {
  return (
    <span className="surface-chip future-ring inline-flex items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs text-foreground">
      <span className="uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[18rem] truncate">{value}</span>
    </span>
  );
}

function VisualRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-chip future-ring flex items-center justify-between gap-3 rounded-[1.2rem] border border-border/70 px-3 py-2 text-sm">
      <span className="uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </span>
      <span className="max-w-[11rem] truncate text-foreground">{value}</span>
    </div>
  );
}

function DetailSheet({
  open,
  active,
  sections,
  selected,
  qaItems,
  qaReady,
  onClose,
  onSelect,
  reduceMotion,
}: {
  open: boolean;
  active: AssetSection;
  sections: AssetSection[];
  selected: WorkbenchOpportunity;
  qaItems: ReturnType<typeof buildQaChecklist>;
  qaReady: boolean;
  onClose: () => void;
  onSelect: (view: DetailView) => void;
  reduceMotion: boolean;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-50"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={reduceMotion ? undefined : { opacity: 1 }}
          exit={reduceMotion ? undefined : { opacity: 0 }}
        >
          <button
            type="button"
            aria-label="关闭详情面板"
            onClick={onClose}
            className="absolute inset-0 bg-[rgba(3,8,18,0.72)] backdrop-blur-sm"
          />

          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="asset-sheet-title"
            className="absolute right-0 top-0 h-full w-full max-w-2xl border-l border-border/70 bg-[rgba(4,10,20,0.94)] shadow-[0_30px_80px_rgba(2,8,19,0.65)]"
            initial={reduceMotion ? false : { x: "100%" }}
            animate={reduceMotion ? undefined : { x: 0 }}
            exit={reduceMotion ? undefined : { x: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.28, ease: "easeOut" }}
          >
            <div className="flex h-full flex-col">
              <div className="border-b border-border/70 px-5 py-5 md:px-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-primary">
                      Asset Detail
                    </p>
                    <h2
                      id="asset-sheet-title"
                      className="mt-3 text-2xl font-semibold text-foreground"
                    >
                      {selected.mainKeyword}
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="surface-chip future-ring inline-flex size-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <X className="size-4" aria-hidden />
                  </button>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {sections.map((section) => {
                    const Icon = section.icon;
                    return (
                      <button
                        key={section.id}
                        type="button"
                        onClick={() => onSelect(section.id)}
                        className={cn(
                          "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs transition-colors",
                          active.id === section.id
                            ? "border-primary/35 bg-primary/15 text-primary shadow-[0_0_0_1px_rgba(116,231,255,0.1)]"
                            : "surface-chip future-ring border-border/70 text-muted-foreground hover:border-primary/30 hover:text-foreground"
                        )}
                      >
                        <Icon className="size-3.5" aria-hidden />
                        <span>{section.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <MetaChip label="Cluster" value={selected.topicClusterName || "—"} />
                  <MetaChip label="Type" value={selected.resolvedContentType} />
                  <MetaChip label="Role" value={selected.internalLinkRole || "—"} />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">
                <div className="surface-panel rounded-[1.8rem] border border-border/70 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.22em] text-primary">
                        {active.eyebrow}
                      </p>
                      <p className="mt-2 text-xl font-semibold text-foreground">
                        {active.label}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={cn(
                        "rounded-full border",
                        active.tone === "ready"
                          ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-100"
                          : "border-border/70 bg-transparent text-muted-foreground"
                      )}
                    >
                      {active.status}
                    </Badge>
                  </div>

                  <div className="mt-5">
                    {active.id === "qa" ? (
                      <div className="grid gap-3">
                        {qaItems.map((item) => (
                          <div
                            key={item.id}
                            className="surface-soft future-ring flex items-start gap-3 rounded-[1.25rem] border border-border/70 px-4 py-3"
                          >
                            <span
                              className={cn(
                                "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
                                qaReady
                                  ? "border-emerald-400/30 bg-emerald-400/12 text-emerald-100"
                                  : "surface-chip future-ring border-border/70 text-muted-foreground"
                              )}
                            >
                              {qaReady ? (
                                <Check className="size-3.5" aria-hidden />
                              ) : (
                                <Circle className="size-3" aria-hidden />
                              )}
                            </span>
                            <span className="text-sm leading-6 text-muted-foreground">
                              {item.label}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <pre className="surface-soft future-ring max-h-[58vh] overflow-y-auto whitespace-pre-wrap break-words rounded-[1.35rem] border border-border/70 p-4 text-sm leading-7 text-slate-200">
                        {active.content?.trim() || active.placeholder}
                      </pre>
                    )}
                  </div>
                </div>

                {selected.sourceUrls.length > 0 ? (
                  <div className="mt-4 surface-soft future-ring rounded-[1.6rem] border border-border/70 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-primary">
                      Context Links
                    </p>
                    <div className="mt-4 grid gap-2">
                      {selected.sourceUrls.slice(0, 4).map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="surface-chip future-ring flex items-center justify-between gap-3 rounded-[1.1rem] border border-border/70 px-3 py-2 text-sm text-foreground transition-colors hover:border-primary/25 hover:text-primary"
                        >
                          <span className="truncate">{url}</span>
                          <ArrowRight className="size-4 shrink-0" aria-hidden />
                        </a>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </motion.aside>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
