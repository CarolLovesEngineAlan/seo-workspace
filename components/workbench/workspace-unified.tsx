"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  Boxes,
  CheckCircle2,
  FilePenLine,
  Layers3,
  LoaderCircle,
  Search,
  Sparkles,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { UserMenu } from "@/components/auth/user-menu";
import { buildArticleDraftMarkdown } from "@/lib/production/article-draft";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import type { AppRole } from "@/lib/auth/roles";
import { buildBriefV2Markdown } from "@/lib/production/brief-v2";
import { buildExportBundleMarkdown } from "@/lib/production/export-markdown";
import { buildWhyNowText } from "@/lib/production/why-now";
import type {
  BriefGenerationRecord,
  WorkbenchOpportunity,
} from "@/lib/types/opportunity";
import type { PromptDetail, PromptLibrary } from "@/lib/types/prompt";
import { cn } from "@/lib/utils";

type Props = {
  opportunities: WorkbenchOpportunity[];
  supabaseMode: boolean;
  dataSource: "supabase" | "fallback";
  authRole: AppRole;
  userEmail: string;
  canWrite: boolean;
  canManageUsers: boolean;
  sourceError?: string | null;
  supplementLoadError?: string | null;
};

type TabKey = "pipeline" | "browse" | "review";
type GenerateKind = "brief" | "draft" | "why_now" | "qa" | "export";
type MessageTone = "info" | "success" | "error";
type PriorityBand = "high" | "medium" | "low";
type BrowseFilters = {
  priority: "all" | PriorityBand;
  type: string;
  intent: string;
  role: string;
  sort: "score" | "volume" | "kd";
};
type UiMessage = { tone: MessageTone; text: string } | null;
type PendingAction = {
  groupId: string;
  kind: GenerateKind;
  buttonLabel: string;
  statusText: string;
  detailText: string;
};
type StrategyKeywordItem = {
  id: string;
  mainKeyword: string;
  keywordVariants: string;
  volume: number;
  contentType: string;
  contentTypeLlm: string;
  intent: string;
  priority: string;
  kd: number;
};

type TopicCluster = {
  name: string;
  pages: WorkbenchOpportunity[];
};

const panelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";
const panelHeadClass =
  "flex items-center justify-between gap-4 border-b border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.45)] px-[18px] py-4";
const panelBodyClass = "p-[14px]";
const pillClass =
  "rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-3 py-1 text-[12px] text-[#5e6860]";
const chipBaseClass =
  "rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-[11px] py-[6px] text-[12px] text-[#5e6860] transition-colors";
const INLINE_BRIEF_BATCH_MAX = 5;
const panelScrollClass =
  "overflow-y-auto xl:max-h-[calc(100dvh-260px)] min-[1800px]:max-h-[calc(100dvh-230px)] min-[2200px]:max-h-[calc(100dvh-210px)]";

type BriefPreviewItem = {
  mainKeyword: string;
  markdown: string;
};

function uniqueNonEmptyStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function splitKeywordVariants(raw: string): string[] {
  return raw
    .split(/\||\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

function buildBriefBatchMarkdown(items: BriefPreviewItem[]): string {
  if (items.length === 1) {
    return items[0]?.markdown ?? "";
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

function buildLocalBriefBatchMarkdown(
  opportunity: WorkbenchOpportunity,
  items: StrategyKeywordItem[]
): string {
  const whyNow = opportunity.whyNow ?? buildWhyNowText(opportunity);

  return buildBriefBatchMarkdown(
    items.map((item) => {
      const keywordVariants = splitKeywordVariants(item.keywordVariants);
      const allKeywords = uniqueNonEmptyStrings([
        item.mainKeyword,
        ...keywordVariants,
      ]).join(" | ");

      return {
        mainKeyword: item.mainKeyword,
        markdown: buildBriefV2Markdown({
          ...opportunity,
          mainKeyword: item.mainKeyword,
          allKeywords: allKeywords || opportunity.allKeywords,
          keywordVariants: item.keywordVariants || opportunity.keywordVariants,
          volume: item.volume,
          kd: item.kd,
          variantCount: keywordVariants.length || opportunity.variantCount,
          intent: item.intent || opportunity.intent,
          resolvedContentType:
            item.contentType || item.contentTypeLlm || opportunity.resolvedContentType,
          contentTypeSource: item.contentType?.trim()
            ? "content_type"
            : item.contentTypeLlm?.trim()
              ? "content_type_llm"
              : opportunity.contentTypeSource,
          whyNow,
        }),
      };
    })
  );
}

function buildBriefActionLabel(): string {
  return "生成文章大纲";
}

function getAutoSelectedItems(opportunity: WorkbenchOpportunity): StrategyKeywordItem[] {
  const items = buildStrategyKeywordItems(opportunity);
  if (items.length > 0) return items.slice(0, INLINE_BRIEF_BATCH_MAX);
  return [
    {
      id: opportunity.groupId,
      mainKeyword: opportunity.mainKeyword,
      keywordVariants: opportunity.keywordVariants || "",
      volume: opportunity.volume,
      contentType: opportunity.resolvedContentType,
      contentTypeLlm: "",
      intent: opportunity.intent,
      priority: priorityBand(opportunity),
      kd: opportunity.kd,
    },
  ];
}

function buildPendingAction(
  kind: GenerateKind,
  groupId: string,
  selectedKeywordCount: number
): PendingAction {
  if (kind === "brief") {
    const count = Math.max(selectedKeywordCount, 1);
    return {
      groupId,
      kind,
      buttonLabel:
        count === 1 ? "正在生成内容简报..." : `正在生成 ${count} 份内容简报...`,
      statusText:
        count === 1
          ? "正在生成内容简报"
          : `正在生成 ${count} 份内容简报`,
      detailText:
        count === 1
          ? "系统正在调用 AI 生成内容简报，通常需要几十秒，完成后会自动更新右侧内容。"
          : `系统正在并行生成 ${count} 份独立内容简报，完成后自动汇总到当前机会组，请保持页面开启。`,
    };
  }

  if (kind === "draft") {
    return {
      groupId,
      kind,
      buttonLabel: "正在生成文章草稿...",
      statusText: "正在生成文章草稿",
      detailText: "系统正在基于当前内容简报生成文章草稿，完成后会自动刷新当前面板。",
    };
  }

  if (kind === "qa") {
    return {
      groupId,
      kind,
      buttonLabel: "正在运行质检...",
      statusText: "正在运行质检",
      detailText: "系统正在整理质检清单并更新当前生产阶段。",
    };
  }

  if (kind === "export") {
    return {
      groupId,
      kind,
      buttonLabel: "正在准备导出...",
      statusText: "正在准备导出",
      detailText: "系统正在整理当前机会组的 Markdown 文件，完成后会自动开始下载。",
    };
  }

  return {
    groupId,
    kind,
    buttonLabel: "正在生成时机分析...",
    statusText: "正在生成时机分析",
    detailText: "系统正在补全当前机会的时机说明。",
  };
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}


function samePageGroupLabel(groupId: string): string {
  return `页面组 ${groupId}`;
}

function buildStrategyKeywordItems(
  opportunity: WorkbenchOpportunity
): StrategyKeywordItem[] {
  if (opportunity.sourceKeywordRows?.length) {
    return opportunity.sourceKeywordRows.map((row, index) => ({
      id: row.notionPageId || `${opportunity.groupId}-${index}`,
      mainKeyword: row.mainKeyword || opportunity.mainKeyword,
      keywordVariants: row.keywordVariants || opportunity.keywordVariants,
      volume: row.volume,
      contentType: row.contentType || opportunity.resolvedContentType,
      contentTypeLlm: row.contentTypeLlm || "—",
      intent: row.intent || opportunity.intent,
      priority: row.priority || priorityBand(opportunity),
      kd: row.kd,
    }));
  }

  return [];
}

function priorityBand(opportunity: WorkbenchOpportunity): PriorityBand {
  if (opportunity.opportunityScore >= 85) return "high";
  if (opportunity.opportunityScore >= 70) return "medium";
  return "low";
}

function priorityLabel(band: PriorityBand): string {
  if (band === "high") return "高优先";
  if (band === "medium") return "中等";
  return "观察";
}


function buttonToneClass(tone: MessageTone): string {
  if (tone === "error") {
    return "border-[rgba(178,72,63,0.25)] bg-[rgba(178,72,63,0.1)] text-[#b2483f]";
  }
  if (tone === "success") {
    return "border-[rgba(44,127,82,0.2)] bg-[rgba(44,127,82,0.1)] text-[#2c7f52]";
  }
  return "border-[rgba(29,122,95,0.2)] bg-[rgba(29,122,95,0.08)] text-[#1d7a5f]";
}

function badgeToneClass(type: "intent" | "type" | "role" | "score" | PriorityBand | "review" | "llm") {
  if (type === "intent") return "bg-[rgba(29,122,95,0.1)] text-[#1d7a5f]";
  if (type === "type") return "bg-[rgba(194,106,57,0.12)] text-[#9c4d28]";
  if (type === "role") return "bg-[rgba(179,131,24,0.12)] text-[#b38318]";
  if (type === "review") return "bg-[rgba(178,72,63,0.1)] text-[#b2483f]";
  if (type === "llm") return "bg-[rgba(100,80,200,0.1)] text-[#5040a0]";
  if (type === "high") return "bg-[rgba(44,127,82,0.1)] text-[#2c7f52]";
  if (type === "medium") return "bg-[rgba(179,131,24,0.12)] text-[#b38318]";
  if (type === "low") return "bg-[rgba(178,72,63,0.1)] text-[#b2483f]";
  return "border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] text-[#1c221d]";
}

function stageToSteps(
  opportunity: WorkbenchOpportunity,
  qaReady: boolean
): Array<{ label: string; state: "" | "done" | "current" | "fail" }> {
  const steps = [
    { id: "idle", label: "初始" },
    { id: "brief", label: "简报完成" },
    { id: "draft", label: "草稿完成" },
    { id: "qa", label: qaReady ? "质检通过" : "质检待完成" },
    { id: "export", label: "已导出" },
  ] as const;

  const currentStep =
    opportunity.pipelineStatus === "shipped"
      ? "export"
      : opportunity.productionStage === "qa" || opportunity.productionStage === "done"
        ? "qa"
        : opportunity.productionStage === "draft"
          ? "draft"
          : opportunity.productionStage === "brief"
            ? "brief"
            : "idle";

  const order = ["idle", "brief", "draft", "qa", "export"];
  const currentIndex = order.indexOf(currentStep);

  return steps.map((step, index) => {
    if (index < currentIndex) return { ...step, state: "done" };
    if (index === currentIndex && step.id !== "idle") {
      return {
        ...step,
        state: step.id === "qa" && !qaReady ? "fail" : "current",
      };
    }
    return { ...step, state: "" };
  });
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

function buildReviewReason(opportunity: WorkbenchOpportunity): string {
  if (opportunity.contentTypeSource === "needs_review") {
    return "页面类型（人工标注与 AI 判断）均不确定，系统无法自动决定，需人工确认。";
  }
  if (opportunity.needsReview) {
    return "这条机会在聚合或判型阶段触发了人工复核条件，暂时不会自动进入生产。";
  }
  return "字段来源使用了兜底逻辑，建议人工确认后再进入正式生产。";
}

function buildReviewFix(opportunity: WorkbenchOpportunity): string {
  if (opportunity.contentTypeSource === "needs_review") {
    return "建议手动指定页面类型，并确认是否独立成页或归入现有页面组。";
  }
  if (opportunity.contentTypeSource === "content_type_llm") {
    return "建议对照页面简报和关键词集合，确认 AI 判定的页面类型是否符合真实意图。";
  }
  return "建议补全页面简报、类型与归属信息，再重新进入排序。";
}

function uniqueValues(
  opportunities: WorkbenchOpportunity[],
  key: "resolvedContentType" | "intent" | "internalLinkRole"
): string[] {
  return [...new Set(opportunities.map((item) => item[key]).filter(Boolean))].sort();
}

export function WorkspaceUnified({
  opportunities,
  supabaseMode,
  authRole,
  userEmail,
  canWrite,
  canManageUsers,
  sourceError,
  supplementLoadError,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("pipeline");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<UiMessage>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isNavigating, startTransition] = useTransition();
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Partial<WorkbenchOpportunity>>
  >({});
  const [qaReadyById, setQaReadyById] = useState<Record<string, boolean>>({});
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);
  const [selectedTopicCluster, setSelectedTopicCluster] = useState<string | null>(null);
  const [selectedBrowseId, setSelectedBrowseId] = useState<string | null>(null);
  const [browseFilters, setBrowseFilters] = useState<BrowseFilters>({
    priority: "all",
    type: "all",
    intent: "all",
    role: "all",
    sort: "score",
  });
  const [promptOptions, setPromptOptions] = useState<PromptDetail[]>([]);
  const [promptLoading, setPromptLoading] = useState(true);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [selectedPromptId, setSelectedPromptId] = useState<string | null>(null);

  const mergedOpportunities = useMemo(
    () =>
      opportunities.map((item) => ({
        ...item,
        ...(localOverrides[item.groupId] ?? {}),
      })),
    [localOverrides, opportunities]
  );

  const eligibleOpportunities = useMemo(
    () => mergedOpportunities.filter((item) => !item.needsReview),
    [mergedOpportunities]
  );

  const reviewQueue = useMemo(
    () =>
      mergedOpportunities.filter(
        (item) => item.needsReview || item.contentTypeSource === "needs_review"
      ),
    [mergedOpportunities]
  );

  const llmFallbackItems = useMemo(
    () =>
      mergedOpportunities.filter(
        (item) =>
          item.contentTypeSource === "content_type_llm" && !item.needsReview
      ),
    [mergedOpportunities]
  );

  const filteredBrowseOpportunities = useMemo(() => {
    const filtered = eligibleOpportunities
      .filter(
        (item) =>
          browseFilters.priority === "all" ||
          priorityBand(item) === browseFilters.priority
      )
      .filter(
        (item) =>
          browseFilters.type === "all" ||
          item.resolvedContentType === browseFilters.type
      )
      .filter(
        (item) =>
          browseFilters.intent === "all" || item.intent === browseFilters.intent
      )
      .filter(
        (item) =>
          browseFilters.role === "all" ||
          item.internalLinkRole === browseFilters.role
      );

    return filtered.sort((a, b) => {
      if (browseFilters.sort === "volume") return b.volume - a.volume;
      if (browseFilters.sort === "kd") return a.kd - b.kd;
      return b.opportunityScore - a.opportunityScore;
    });
  }, [browseFilters, eligibleOpportunities]);

  const typeOptions = useMemo(
    () => uniqueValues(eligibleOpportunities, "resolvedContentType"),
    [eligibleOpportunities]
  );
  const intentOptions = useMemo(
    () => uniqueValues(eligibleOpportunities, "intent"),
    [eligibleOpportunities]
  );
  const roleOptions = useMemo(
    () => uniqueValues(eligibleOpportunities, "internalLinkRole"),
    [eligibleOpportunities]
  );
  useEffect(() => {
    let active = true;
    setPromptLoading(true);

    fetch("/api/prompts/library", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          throw new Error(
            payload.error ?? (response.statusText || "加载 Prompt 列表失败。")
          );
        }
        return response.json() as Promise<PromptLibrary>;
      })
      .then((library) => {
        if (!active) return;
        const docItems = (library.docPrompts ?? []).map((prompt) => ({
          ...prompt,
          source: "doc" as const,
        }));
        const customItems = (library.customPrompts ?? []).map((prompt) => ({
          ...prompt,
          source: "custom" as const,
        }));
        const combined = [...docItems, ...customItems];
        setPromptOptions(combined);
        setPromptError(null);
        setSelectedPromptId((current) => {
          if (current && combined.some((item) => item.id === current)) {
            return current;
          }
          const defaultDoc = combined.find(
            (item) =>
              item.source === "doc" &&
              item.fileName === "brief-generation-prompt.md"
          );
          return defaultDoc?.id ?? combined[0]?.id ?? null;
        });
      })
      .catch((error) => {
        if (!active) return;
        setPromptOptions([]);
        setPromptError(
          error instanceof Error ? error.message : "无法加载 Prompt 列表。"
        );
      })
      .finally(() => {
        if (!active) return;
        setPromptLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const topicClusters = useMemo<TopicCluster[]>(() => {
    const map = new Map<string, WorkbenchOpportunity[]>();
    for (const opp of eligibleOpportunities) {
      const key = opp.topicClusterName || "未分组";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(opp);
    }
    return [...map.entries()].map(([name, pages]) => ({ name, pages }));
  }, [eligibleOpportunities]);

  const selectedClusterPages = useMemo(() => {
    if (!selectedTopicCluster) return eligibleOpportunities;
    return topicClusters.find((c) => c.name === selectedTopicCluster)?.pages ?? eligibleOpportunities;
  }, [eligibleOpportunities, topicClusters, selectedTopicCluster]);

  useEffect(() => {
    if (!selectedTopicCluster || !topicClusters.some((c) => c.name === selectedTopicCluster)) {
      setSelectedTopicCluster(topicClusters[0]?.name ?? null);
    }
  }, [topicClusters, selectedTopicCluster]);

  useEffect(() => {
    if (!selectedPipelineId || !selectedClusterPages.some((item) => item.groupId === selectedPipelineId)) {
      setSelectedPipelineId(selectedClusterPages[0]?.groupId ?? null);
    }
  }, [selectedClusterPages, selectedPipelineId]);

  useEffect(() => {
    if (
      !selectedBrowseId ||
      !filteredBrowseOpportunities.some((item) => item.groupId === selectedBrowseId)
    ) {
      setSelectedBrowseId(filteredBrowseOpportunities[0]?.groupId ?? null);
    }
  }, [filteredBrowseOpportunities, selectedBrowseId]);

  const selectedPipelineOpportunity =
    selectedClusterPages.find((item) => item.groupId === selectedPipelineId) ??
    selectedClusterPages[0] ??
    null;
  const selectedBrowseOpportunity =
    filteredBrowseOpportunities.find((item) => item.groupId === selectedBrowseId) ??
    filteredBrowseOpportunities[0] ??
    null;
  const selectedPrompt = useMemo(() => {
    if (!selectedPromptId) {
      return null;
    }
    return promptOptions.find((item) => item.id === selectedPromptId) ?? null;
  }, [promptOptions, selectedPromptId]);
  const handlePromptChange = (promptId: string | null) => {
    setSelectedPromptId(promptId);
  };

  const pending = busy || isNavigating;

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

  function generateLocally(
    kind: GenerateKind,
    selected: WorkbenchOpportunity,
    options?: { promptId?: string }
  ) {
    if (kind === "why_now") {
      applyLocalPatch(selected.groupId, {
        whyNow: buildWhyNowText(selected),
        productionStage:
          selected.productionStage === "none" ? "brief" : selected.productionStage,
      });
      setMessage({ tone: "success", text: "Why now 已生成。" });
      return;
    }

    if (kind === "brief") {
      const briefItems = getAutoSelectedItems(selected);
      const withWhyNow = selected.whyNow
        ? selected
        : { ...selected, whyNow: buildWhyNowText(selected) };

      applyLocalPatch(selected.groupId, {
        pipelineStatus:
          selected.pipelineStatus === "inbox"
            ? "in_queue"
            : selected.pipelineStatus,
        productionStage: "brief",
        whyNow: withWhyNow.whyNow,
        briefMarkdown: buildLocalBriefBatchMarkdown(withWhyNow, briefItems),
      });
      setMessage({
        tone: "success",
        text: briefItems.length === 1 ? "已生成 1 份文章大纲。" : `已生成 ${briefItems.length} 份文章大纲。`,
      });
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
      setMessage({ tone: "success", text: "文章草稿已生成。" });
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

  async function generate(
    kind: GenerateKind,
    selected: WorkbenchOpportunity,
    options?: { promptId?: string }
  ) {
    if (!canWrite) {
      setMessage({
        tone: "error",
        text: "当前账号只有只读权限。若需要生成或导出内容，请联系管理员授予 editor 或 admin 角色。",
      });
      return;
    }

    if (!supabaseMode) {
      generateLocally(kind, selected, options);
      return;
    }

    const briefItems = kind === "brief" ? getAutoSelectedItems(selected) : [];

    setBusy(true);
    setPendingAction(
      buildPendingAction(kind, selected.groupId, briefItems.length)
    );
    setMessage(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind,
            selectedKeywordIds:
              kind === "brief"
                ? briefItems.map((item) => item.id)
                : undefined,
            promptId: options?.promptId,
          }),
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

      if (kind === "brief" && typeof data.markdown === "string") {
        applyLocalPatch(selected.groupId, {
          pipelineStatus:
            selected.pipelineStatus === "inbox"
              ? "in_queue"
              : selected.pipelineStatus,
          productionStage: "brief",
          whyNow: selected.whyNow ?? buildWhyNowText(selected),
          briefMarkdown: data.markdown,
        });

        const records = Array.isArray(data.records)
          ? (data.records as BriefGenerationRecord[])
          : data.record
            ? ([data.record] as BriefGenerationRecord[])
            : [];

        const generatedCount =
          typeof data.generatedCount === "number" && data.generatedCount > 0
            ? data.generatedCount
            : Math.max(records.length, 1);

        setMessage({
          tone: "success",
          text:
            generatedCount === 1
              ? "已生成并保存 1 份文章大纲。"
              : `已生成并保存 ${generatedCount} 份文章大纲。`,
        });
        return;
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
            ? "时机说明已保存。"
            : kind === "brief"
              ? "内容简报已保存。"
              : kind === "draft"
                ? "文章草稿已保存。"
                : "质检状态已更新。",
      });
      refresh();
    } finally {
      setBusy(false);
      setPendingAction(null);
    }
  }

  function switchToPipeline(groupId: string) {
    setSelectedPipelineId(groupId);
    setTab("pipeline");
  }

  function selectBrowseAndOpenPipeline(groupId: string) {
    setSelectedPipelineId(groupId);
    setSelectedBrowseId(groupId);
    setTab("pipeline");
  }

  function handleReviewAction(label: string, opportunity: WorkbenchOpportunity) {
    setMessage({
      tone: "info",
      text: `${label} · ${opportunity.mainKeyword}。建议在字段管理流里补齐后重新排序。`,
    });
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 xl:max-w-[calc(100vw-48px)] xl:px-8 2xl:max-w-[calc(100vw-64px)] 2xl:px-10 min-[2200px]:max-w-[calc(100vw-88px)]">
        <div className="sticky top-4 z-40 mb-3">
          <header className="rounded-[26px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.72)] px-[22px] py-4 shadow-[0_20px_52px_rgba(44,38,22,0.12)] backdrop-blur-[18px]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex items-center gap-3">
                <BrandMark className="size-[38px]" />
                <div>
                  <h1 className="text-[15px] font-semibold">
                    SEO 内容生产工作台
                  </h1>
                  <p className="mt-0.5 text-[12px] text-[#5e6860]">
                    从 Notion 导入 → 筛选机会 → 内容生产 → 导出
                  </p>
                </div>
              </div>

              <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-end">
                <nav
                  aria-label="workspace views"
                  className="inline-flex w-fit flex-wrap gap-1 rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] p-1"
                >
                  <TabButton
                    active={tab === "pipeline"}
                    icon={Boxes}
                    label="生产流水线"
                    onClick={() => setTab("pipeline")}
                  />
                  <TabButton
                    active={tab === "browse"}
                    icon={Search}
                    label="机会列表"
                    onClick={() => setTab("browse")}
                  />
                  <TabButton
                    active={tab === "review"}
                    icon={AlertCircle}
                    label="待确认"
                    onClick={() => setTab("review")}
                    badge={String(reviewQueue.length)}
                  />
                </nav>

                <ProjectNavigation activeKey="workbench" variant="warm" />
                <UserMenu
                  userEmail={userEmail}
                  role={authRole}
                  canManageUsers={canManageUsers}
                />
              </div>
            </div>
          </header>
        </div>

        {!canWrite ? (
          <div className="mb-4 rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.58)] px-4 py-3 text-[13px] leading-[1.7] text-[#5e6860]">
            当前账号为只读模式。你可以查看机会池和 brief 数据，但不能推进 pipeline、生成 brief 或修改生产状态。
          </div>
        ) : null}

        {sourceError || supplementLoadError ? (
          <section className="mb-4 grid gap-3 xl:grid-cols-2">
            {sourceError ? (
              <InlineAlert title="数据来源备用" detail={sourceError} />
            ) : null}
            {supplementLoadError ? (
              <InlineAlert title="补充数据加载失败" detail={supplementLoadError} />
            ) : null}
          </section>
        ) : null}

        {pendingAction ? (
          <div
            role="status"
            className="mb-4 flex items-start gap-3 rounded-[18px] border border-[rgba(29,122,95,0.2)] bg-[rgba(29,122,95,0.08)] px-4 py-3 text-[13px] text-[#1d7a5f]"
          >
            <LoaderCircle className="mt-[1px] size-4 shrink-0 animate-spin" aria-hidden />
            <div>
              <div className="font-medium">{pendingAction.statusText}</div>
              <p className="mt-1 leading-[1.6] text-[#49675d]">
                {pendingAction.detailText}
              </p>
            </div>
          </div>
        ) : message ? (
          <div
            role={message.tone === "error" ? "alert" : "status"}
            className={cn(
              "mb-4 rounded-[18px] border px-4 py-3 text-[13px]",
              buttonToneClass(message.tone)
            )}
          >
            {message.text}
          </div>
        ) : null}

        {tab === "pipeline" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.96fr)_minmax(0,1.14fr)] min-[1680px]:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)_minmax(0,1.18fr)] min-[2200px]:grid-cols-[minmax(0,1.12fr)_minmax(0,1.04fr)_minmax(0,1.24fr)]">
            <section className={panelClass}>
              <PanelHead
                title="① 话题机会"
                description="按话题组浏览 · 点击话题进入页面列表"
                count={`${topicClusters.length} 个话题`}
              />
              <div className={cn(panelScrollClass, "p-[14px]")}>
                {topicClusters.map((cluster) => (
                  <TopicClusterCard
                    key={cluster.name}
                    name={cluster.name}
                    pageCount={cluster.pages.length}
                    active={cluster.name === selectedTopicCluster}
                    onClick={() => setSelectedTopicCluster(cluster.name)}
                  />
                ))}
              </div>
            </section>

            <section className={panelClass}>
              <PanelHead
                title="② 页面列表"
                description="每条对应一个独立页面 · 点击进入生产面板"
                count={
                  selectedTopicCluster
                    ? `${selectedClusterPages.length} 个页面`
                    : "—"
                }
              />
              <div className={cn(panelScrollClass, "p-[14px]")}>
                {selectedClusterPages.length > 0 ? (
                  selectedClusterPages.map((opportunity) => (
                    <OpportunityCard
                      key={opportunity.groupId}
                      opportunity={opportunity}
                      active={opportunity.groupId === selectedPipelineOpportunity?.groupId}
                      onClick={() => setSelectedPipelineId(opportunity.groupId)}
                    />
                  ))
                ) : (
                  <div className="px-5 py-10 text-center text-[13px] text-[#5e6860]">
                    ← 先从左侧选择一个话题
                  </div>
                )}
              </div>
            </section>

            <section className={panelClass}>
              <PanelHead
                title="③ 生产面板"
                description="内容策略 · 文章大纲 · 导出"
                count={
                  selectedPipelineOpportunity
                    ? selectedPipelineOpportunity.mainKeyword
                    : "—"
                }
              />
              <div className={panelScrollClass}>
                {selectedPipelineOpportunity ? (
                <ProductionPanel
                    key={selectedPipelineOpportunity.groupId}
                    opportunity={selectedPipelineOpportunity}
                    pending={pending}
                    pendingAction={
                      pendingAction?.groupId === selectedPipelineOpportunity.groupId
                        ? pendingAction
                        : null
                    }
                    canWrite={canWrite}
                    selectedPromptId={selectedPromptId}
                    selectedPrompt={selectedPrompt}
                    promptOptions={promptOptions}
                    promptLoading={promptLoading}
                    promptError={promptError}
                    onPromptChange={handlePromptChange}
                    onGenerate={generate}
                    onPatch={(patch) =>
                      applyLocalPatch(selectedPipelineOpportunity.groupId, patch)
                    }
                />
                ) : (
                  <div className="px-5 py-10 text-center text-[13px] text-[#5e6860]">
                    ← 点击左侧机会或队列项进入生产面板
                  </div>
                )}
              </div>
            </section>
          </div>
        ) : null}

        {tab === "browse" ? (
          <div className="grid gap-4 xl:grid-cols-[300px_minmax(0,1fr)_380px] min-[1680px]:grid-cols-[340px_minmax(0,1fr)_430px] min-[2200px]:grid-cols-[380px_minmax(0,1fr)_500px]">
            <aside className={panelClass}>
              <PanelHead
                title="筛选条件"
                description="先筛机会，再做判断"
              />
              <div className={cn(panelBodyClass, "min-[1800px]:px-5 min-[1800px]:py-5")}>
                <FilterGroup
                  label="优先级"
                  options={["all", "high", "medium", "low"]}
                  activeValue={browseFilters.priority}
                  onSelect={(value) =>
                    setBrowseFilters((current) => ({
                      ...current,
                      priority: value as BrowseFilters["priority"],
                    }))
                  }
                />
                <FilterGroup
                  label="内容类型"
                  options={["all", ...typeOptions]}
                  activeValue={browseFilters.type}
                  onSelect={(value) =>
                    setBrowseFilters((current) => ({ ...current, type: value }))
                  }
                />
                <FilterGroup
                  label="搜索意图"
                  options={["all", ...intentOptions]}
                  activeValue={browseFilters.intent}
                  onSelect={(value) =>
                    setBrowseFilters((current) => ({ ...current, intent: value }))
                  }
                />
                <FilterGroup
                  label="内链角色"
                  options={["all", ...roleOptions]}
                  activeValue={browseFilters.role}
                  onSelect={(value) =>
                    setBrowseFilters((current) => ({ ...current, role: value }))
                  }
                />
                <div className="my-4 border-t border-[rgba(28,34,29,0.1)]" />
                <FilterGroup
                  label="排序方式"
                  options={["score", "volume", "kd"]}
                  activeValue={browseFilters.sort}
                  onSelect={(value) =>
                    setBrowseFilters((current) => ({
                      ...current,
                      sort: value as BrowseFilters["sort"],
                    }))
                  }
                />
              </div>
            </aside>

            <main className={panelClass}>
              <PanelHead
                title="机会列表"
                description="默认按综合评分降序"
                count={`${filteredBrowseOpportunities.length} 条`}
              />
              <div className={cn(panelScrollClass, "p-[14px]")}>
                {filteredBrowseOpportunities.map((opportunity) => (
                  <OpportunityCard
                    key={opportunity.groupId}
                    opportunity={opportunity}
                    active={opportunity.groupId === selectedBrowseOpportunity?.groupId}
                    onClick={() => setSelectedBrowseId(opportunity.groupId)}
                  />
                ))}
              </div>
            </main>

            <aside className={panelClass}>
              <PanelHead
                title="机会详情"
                description="点一条机会后展开完整判断信息"
              />
              <div className={panelScrollClass}>
                {selectedBrowseOpportunity ? (
                  <BrowseDetail
                    opportunity={selectedBrowseOpportunity}
                    onPromote={() =>
                      selectBrowseAndOpenPipeline(selectedBrowseOpportunity.groupId)
                    }
                    onOpenPipeline={() =>
                      switchToPipeline(selectedBrowseOpportunity.groupId)
                    }
                    qaReady={
                      selectedBrowseOpportunity.productionStage === "qa" ||
                      selectedBrowseOpportunity.productionStage === "done" ||
                      qaReadyById[selectedBrowseOpportunity.groupId] === true
                    }
                  />
                ) : (
                  <div className="px-5 py-10 text-center text-[13px] text-[#5e6860]">
                    ← 点击左侧机会查看详情
                  </div>
                )}
              </div>
            </aside>
          </div>
        ) : null}

        {tab === "review" ? (
          <div className="space-y-4">
            <section className={panelClass}>
              <PanelHead
                title="待确认机会"
                description="这些机会不会自动进入生产，必须经过人工确认"
                count={`${reviewQueue.length} 条`}
              />
              <div className="bg-[rgba(178,72,63,0.03)] px-[14px] pb-[14px] pt-2">
                <p className="px-1 pb-3 pt-1 text-[12px] leading-7 text-[#5e6860]">
                  系统会把无法稳定判型或需要人工判断的机会隔离到这里，确认后再重新进入排序与生产。
                </p>
                <div className="grid gap-4 xl:grid-cols-2 min-[1800px]:grid-cols-[1fr_1fr]">
                  {reviewQueue.map((opportunity) => (
                    <ReviewCard
                      key={opportunity.groupId}
                      opportunity={opportunity}
                      onAssignType={() =>
                        handleReviewAction("指定页面类型", opportunity)
                      }
                      onAssignGroup={() =>
                        handleReviewAction("指定页面组", opportunity)
                      }
                      onSkip={() => handleReviewAction("已跳过", opportunity)}
                    />
                  ))}
                </div>
              </div>
            </section>

            <section className={panelClass}>
              <PanelHead
                title="AI 兜底项"
                description="页面类型由 AI 自动判断，建议人工核查"
                count={`${llmFallbackItems.length} 条`}
              />
              <div className={cn(panelScrollClass, "p-[14px]")}>
                {llmFallbackItems.length === 0 ? (
                  <div className="px-5 py-10 text-center text-[13px] text-[#5e6860]">
                    暂无使用 LLM 兜底的机会
                  </div>
                ) : (
                  llmFallbackItems.map((opportunity) => (
                    <LlmFallbackCard
                      key={opportunity.groupId}
                      opportunity={opportunity}
                    />
                  ))
                )}
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function PanelHead({
  title,
  description,
  count,
}: {
  title: string;
  description: string;
  count?: string;
}) {
  return (
    <div className={panelHeadClass}>
      <div>
        <h2 className="text-[15px] font-semibold">{title}</h2>
        <p className="mt-0.5 text-[12px] text-[#5e6860]">{description}</p>
      </div>
      {count ? <span className={pillClass}>{count}</span> : null}
    </div>
  );
}

function InlineAlert({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-[18px] border border-[rgba(179,131,24,0.18)] bg-[rgba(255,252,244,0.85)] px-4 py-3 shadow-[0_12px_24px_rgba(44,38,22,0.05)]">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#b38318]" aria-hidden />
        <div>
          <p className="text-[13px] font-semibold">{title}</p>
          <p className="mt-1 text-[12px] leading-6 text-[#5e6860]">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function TabButton({
  active,
  icon: Icon,
  label,
  badge,
  onClick,
}: {
  active: boolean;
  icon: typeof Boxes;
  label: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-[7px] rounded-full px-[18px] py-2 text-[13px] font-medium transition-all",
        active
          ? "bg-[rgba(255,253,248,1)] text-[#1c221d] shadow-[0_2px_8px_rgba(28,34,29,0.1)]"
          : "text-[#5e6860] hover:bg-[rgba(255,255,255,0.5)] hover:text-[#1c221d]"
      )}
    >
      <Icon className="size-4" aria-hidden />
      <span>{label}</span>
      {badge ? (
        <span className="rounded-full bg-[rgba(178,72,63,0.1)] px-[7px] py-[1px] text-[11px] font-semibold text-[#b2483f]">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

function OpportunityCard({
  opportunity,
  active,
  onClick,
}: {
  opportunity: WorkbenchOpportunity;
  active: boolean;
  onClick: () => void;
}) {
  const band = priorityBand(opportunity);

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative mb-[10px] w-full overflow-hidden rounded-[20px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,253,248,1)] p-[14px] text-left transition-all last:mb-0",
        active
          ? "translate-y-[-2px] border-[rgba(29,122,95,0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(238,248,244,0.98)_100%)] shadow-[0_18px_40px_rgba(29,122,95,0.16)] ring-1 ring-[rgba(29,122,95,0.2)]"
          : "hover:translate-y-[-2px] hover:border-[rgba(29,122,95,0.24)] hover:shadow-[0_14px_30px_rgba(29,122,95,0.08)]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-[12px] left-[10px] w-[4px] rounded-full bg-[linear-gradient(180deg,rgba(29,122,95,0.9),rgba(77,215,176,0.7))] transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 pl-[6px]">
          <div className="text-[15px] font-semibold leading-[1.3]">
            {opportunity.mainKeyword}
          </div>
          <div className="mt-1 text-[12px] text-[#5e6860]">
            {samePageGroupLabel(opportunity.groupId)} · 聚合 {opportunity.rowCount} 条源记录
          </div>
          <div className="mt-1 text-[12px] text-[#5e6860]">
            {opportunity.topicClusterName || "未设置主题群"}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={cn(
              "inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-all",
              active
                ? "border-[#1d7a5f] bg-[#1d7a5f] shadow-[0_6px_18px_rgba(29,122,95,0.24)]"
                : "border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.72)]"
            )}
          >
            <span
              className={cn(
                "size-[7px] rounded-full transition-colors",
                active ? "bg-white" : "bg-[rgba(94,104,96,0.28)]"
              )}
            />
          </span>
          <span
            className={cn(
              "inline-flex rounded-full px-[9px] py-1 text-[11px] font-medium",
              badgeToneClass(band)
            )}
          >
            {priorityLabel(band)}
          </span>
        </div>
      </div>

      <div className="mt-[10px] flex flex-wrap gap-[6px] pl-[6px]">
        <TagChip tone="intent" value={opportunity.intent} />
        <TagChip tone="type" value={opportunity.resolvedContentType} />
        <TagChip tone="role" value={opportunity.internalLinkRole} />
        <TagChip tone="score" value={`评分 ${opportunity.opportunityScore}`} />
      </div>

      <div className="mt-[10px] grid grid-cols-3 gap-[6px] pl-[6px]">
        <MiniStat label="搜索量" value={formatNumber(opportunity.volume)} />
        <MiniStat label="竞争难度" value={String(opportunity.kd)} />
        <MiniStat label="相关词" value={String(opportunity.variantCount)} />
      </div>
    </button>
  );
}

function TopicClusterCard({
  name,
  pageCount,
  active,
  onClick,
}: {
  name: string;
  pageCount: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "relative mb-[10px] w-full overflow-hidden rounded-[20px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,253,248,1)] p-[14px] text-left transition-all last:mb-0",
        active
          ? "translate-y-[-2px] border-[rgba(29,122,95,0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(238,248,244,0.98)_100%)] shadow-[0_18px_40px_rgba(29,122,95,0.16)] ring-1 ring-[rgba(29,122,95,0.2)]"
          : "hover:translate-y-[-2px] hover:border-[rgba(29,122,95,0.24)] hover:shadow-[0_14px_30px_rgba(29,122,95,0.08)]"
      )}
    >
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-[12px] left-[10px] w-[4px] rounded-full bg-[linear-gradient(180deg,rgba(29,122,95,0.9),rgba(77,215,176,0.7))] transition-opacity",
          active ? "opacity-100" : "opacity-0"
        )}
      />
      <div className="flex items-start justify-between gap-3 pl-[6px]">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold leading-[1.3]">{name}</div>
          <div className="mt-1 text-[12px] text-[#5e6860]">{pageCount} 个页面</div>
        </div>
        <span
          aria-hidden
          className={cn(
            "inline-flex size-6 shrink-0 items-center justify-center rounded-full border transition-all",
            active
              ? "border-[#1d7a5f] bg-[#1d7a5f] shadow-[0_6px_18px_rgba(29,122,95,0.24)]"
              : "border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.72)]"
          )}
        >
          <span
            className={cn(
              "size-[7px] rounded-full transition-colors",
              active ? "bg-white" : "bg-[rgba(94,104,96,0.28)]"
            )}
          />
        </span>
      </div>
    </button>
  );
}

function ProductionPanel({
  opportunity,
  pending,
  pendingAction,
  canWrite,
  selectedPromptId,
  selectedPrompt,
  promptOptions,
  promptLoading,
  promptError,
  onPromptChange,
  onGenerate,
  onPatch,
}: {
  opportunity: WorkbenchOpportunity;
  pending: boolean;
  pendingAction: PendingAction | null;
  canWrite: boolean;
  selectedPromptId: string | null;
  selectedPrompt: PromptDetail | null;
  promptOptions: PromptDetail[];
  promptLoading: boolean;
  promptError: string | null;
  onPromptChange: (promptId: string | null) => void;
  onGenerate: (
    kind: GenerateKind,
    selected: WorkbenchOpportunity,
    options?: { promptId?: string }
  ) => Promise<void> | void;
  onPatch: (patch: Partial<WorkbenchOpportunity>) => void;
}) {
  const whyNow = opportunity.whyNow ?? buildWhyNowText(opportunity);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const activeActionKind = pendingAction?.kind ?? null;

  async function handleGenerateStrategy() {
    setStrategyBusy(true);
    setStrategyError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/content-strategy`,
        { method: "POST" }
      );
      const data = await response.json().catch(() => ({})) as { markdown?: string; error?: string };
      if (!response.ok) {
        setStrategyError(data.error ?? response.statusText);
        return;
      }
      if (typeof data.markdown === "string" && data.markdown.trim()) {
        onPatch({ pageBrief: data.markdown });
      }
    } catch (e) {
      setStrategyError(e instanceof Error ? e.message : String(e));
    } finally {
      setStrategyBusy(false);
    }
  }

  return (
    <div className="px-[18px] py-[18px]">
      <div className="text-[26px] font-bold leading-[1.1]">
        {opportunity.mainKeyword}
      </div>
      <p className="mt-2 text-[12px] text-[#5e6860]">
        页面组 {opportunity.groupId} · 聚合 {opportunity.rowCount} 条源记录
      </p>

      <div className="mt-3 flex flex-wrap gap-[6px]">
        <TagChip tone="intent" value={opportunity.intent} />
        <TagChip tone="type" value={opportunity.resolvedContentType} />
        <TagChip tone="role" value={opportunity.internalLinkRole} />
        <TagChip tone="score" value={`评分 ${opportunity.opportunityScore}`} />
      </div>

      <div className="mt-4 border-t border-[rgba(28,34,29,0.1)] pt-4">
        <SectionLabel>为什么现在做</SectionLabel>
        <p className="mt-2 text-[13px] leading-[1.7] text-[#1c221d]">{whyNow}</p>
      </div>

      <div className="mt-4 border-t border-[rgba(28,34,29,0.1)] pt-4">
        <div className="flex items-center justify-between gap-2">
          <SectionLabel>内容策略</SectionLabel>
          <button
            type="button"
            disabled={strategyBusy}
            onClick={handleGenerateStrategy}
            className="inline-flex items-center gap-[6px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
          >
            {strategyBusy ? (
              <LoaderCircle className="size-3 animate-spin" aria-hidden />
            ) : (
              <Sparkles className="size-3" aria-hidden />
            )}
            {strategyBusy ? "AI 分析中…" : "AI 分析 SERP"}
          </button>
        </div>

        {strategyError ? (
          <div className="mt-2 rounded-[12px] border border-[rgba(178,72,63,0.18)] bg-[rgba(178,72,63,0.06)] px-3 py-2 text-[12px] leading-[1.6] text-[#b2483f]">
            {strategyError}
          </div>
        ) : null}

        {opportunity.pageBrief ? (
          <div className="mt-2 rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[13px] leading-[1.75] text-[#1c221d] whitespace-pre-wrap">
            {opportunity.pageBrief}
          </div>
        ) : (
          <p className="mt-2 text-[13px] text-[#5e6860]">
            点击「AI 分析 SERP」自动调研 Top 10 竞争格局并生成策略。
          </p>
        )}
      </div>

      <div className="mt-4 border-t border-[rgba(28,34,29,0.1)] pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <SectionLabel>文章大纲 Prompt</SectionLabel>
            <p className="text-[12px] text-[#5e6860]">
              选择将用于 AI 生成文章大纲的 Prompt 模板。
            </p>
          </div>
          <div className="min-w-[240px] flex-1">
            <select
              value={selectedPromptId ?? ""}
              onChange={(event) =>
                onPromptChange(
                  event.target.value ? event.target.value : null
                )
              }
              disabled={promptLoading || promptOptions.length === 0}
              className="w-full rounded-[12px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.9)] px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none focus:ring-1 focus:ring-[#1d7a5f]/40"
            >
              {promptOptions.length === 0 ? (
                <option value="">
                  {promptLoading
                    ? "加载中..."
                    : promptError
                      ? "无法加载 Prompt"
                      : "暂无可用 Prompt"}
                </option>
              ) : (
                promptOptions.map((prompt) => (
                  <option key={prompt.id} value={prompt.id}>
                    {prompt.name}{" "}
                    {prompt.source === "custom" ? "（自定义）" : "（文档）"}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
        {promptError ? (
          <p className="mt-2 text-[12px] text-[#b2483f]">{promptError}</p>
        ) : selectedPrompt?.description ? (
          <p className="mt-2 text-[12px] text-[#5e6860]">
            {selectedPrompt.description}
          </p>
        ) : promptLoading ? (
          <p className="mt-2 text-[12px] text-[#5e6860]">
            正在加载 Prompt 描述…
          </p>
        ) : (
          <p className="mt-2 text-[12px] text-[#5e6860]">
            如果不选择自定义模板，将沿用默认的 Brief Generation Prompt。
          </p>
        )}
      </div>

        <div className="mt-5 border-t border-[rgba(28,34,29,0.1)] pt-5">
            {pendingAction?.kind === "brief" ? (
                <div className="rounded-[18px] border border-[rgba(29,122,95,0.18)] bg-[linear-gradient(180deg,rgba(244,252,248,0.98)_0%,rgba(236,248,243,0.96)_100%)] px-4 py-4 text-[13px]">
                    <div className="flex items-center gap-2">
                        <LoaderCircle className="size-4 animate-spin text-[#1d7a5f]" aria-hidden />
                        <span className="font-medium text-[#1d7a5f]">{pendingAction.statusText}</span>
                    </div>
                    <p className="mt-2 leading-[1.6] text-[#49675d]">{pendingAction.detailText}</p>
                </div>
            ) : (
                <ActionPillButton
                    icon={Sparkles}
                    label={buildBriefActionLabel()}
                    loading={activeActionKind === "brief"}
                    loadingLabel={pendingAction?.buttonLabel}
                    disabled={pending}
                    primary
                    onClick={() =>
                      onGenerate("brief", opportunity, {
                        promptId: selectedPromptId ?? undefined,
                      })
                    }
                />
            )}
        </div>
    </div>
  );
}


function BrowseDetail({
  opportunity,
  qaReady,
  onPromote,
  onOpenPipeline,
}: {
  opportunity: WorkbenchOpportunity;
  qaReady: boolean;
  onPromote: () => void;
  onOpenPipeline: () => void;
}) {
  const band = priorityBand(opportunity);
  const steps = stageToSteps(opportunity, qaReady);

  return (
    <div className="px-[18px] py-[18px]">
      <div className="text-[26px] font-bold leading-[1.15]">
        {opportunity.mainKeyword}
      </div>
      <p className="mt-[6px] text-[13px] leading-[1.6] text-[#5e6860]">
        这是一个适合做成{" "}
        <strong>
          {opportunity.resolvedContentType} {opportunity.internalLinkRole}
        </strong>{" "}
        的 {band === "high" ? "高价值" : band === "medium" ? "中等价值" : "观察型"}机会。
        意图 {opportunity.intent}，KD {opportunity.kd}，
        {opportunity.pageBrief ? " 已有页面简报。" : " 暂无简报。"}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-2">
        <MiniStat label="页面组 ID" value={opportunity.groupId} />
        <MiniStat label="搜索意图" value={opportunity.intent} />
        <MiniStat label="内容类型" value={opportunity.resolvedContentType} />
        <MiniStat label="内链角色" value={opportunity.internalLinkRole} />
        <MiniStat label="搜索量" value={formatNumber(opportunity.volume)} />
        <MiniStat label="竞争难度" value={String(opportunity.kd)} />
      </div>

      <DetailSection title="机会价值">
        <p>{opportunity.whyNow ?? buildWhyNowText(opportunity)}</p>
      </DetailSection>

      <DetailSection title="覆盖关键词">
        <p className="text-[#5e6860]">{opportunity.allKeywords}</p>
      </DetailSection>

      <DetailSection title="现有简报">
        <p>{opportunity.pageBrief || "暂无简报"}</p>
      </DetailSection>

      <DetailSection title="当前生产状态">
        <div className="mt-1 flex flex-wrap items-center gap-1">
          {steps.map((step, index) => (
            <div key={step.label} className="flex items-center">
              <StateStep label={step.label} state={step.state} />
              {index < steps.length - 1 ? (
                <span className="px-1 text-[10px] text-[#5e6860]">›</span>
              ) : null}
            </div>
          ))}
        </div>
      </DetailSection>

      <div className="mt-4 flex flex-wrap gap-2">
        <ActionPillButton
          icon={ArrowRight}
          label="进入生产"
          primary
          onClick={onPromote}
        />
        <ActionPillButton
          icon={Layers3}
          label="打开生产面板"
          secondary
          onClick={onOpenPipeline}
        />
      </div>
    </div>
  );
}

function ReviewCard({
  opportunity,
  onAssignType,
  onAssignGroup,
  onSkip,
}: {
  opportunity: WorkbenchOpportunity;
  onAssignType: () => void;
  onAssignGroup: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="rounded-[18px] border border-[rgba(178,72,63,0.18)] bg-[rgba(255,252,250,0.9)] p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="text-[15px] font-semibold">{opportunity.mainKeyword}</div>
        <span
          className={cn(
            "rounded-full px-[9px] py-1 text-[11px] font-medium",
            badgeToneClass("review")
          )}
        >
          待确认
        </span>
      </div>

      <div className="mt-2 flex flex-wrap gap-[6px]">
        <TagChip tone="intent" value={opportunity.intent || "unknown"} />
        <TagChip tone="score" value={`vol ${formatNumber(opportunity.volume)}`} />
        <TagChip tone="score" value={`KD ${opportunity.kd}`} />
      </div>

      <div className="mt-[6px] text-[12px] leading-[1.55] text-[#5e6860]">
        {buildReviewReason(opportunity)}
      </div>

      <div className="mt-[10px] rounded-[12px] bg-[rgba(244,240,230,0.85)] px-3 py-[10px] text-[12px] leading-[1.55]">
        <strong className="mb-1 block text-[#b38318]">建议操作</strong>
        {buildReviewFix(opportunity)}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <ActionPillButton
          icon={FilePenLine}
          label="指定页面类型"
          primary
          onClick={onAssignType}
        />
        <ActionPillButton
          icon={Layers3}
          label="指定页面组"
          secondary
          onClick={onAssignGroup}
        />
        <ActionPillButton
          icon={AlertCircle}
          label="跳过"
          danger
          onClick={onSkip}
        />
      </div>
    </div>
  );
}

function LlmFallbackCard({
  opportunity,
}: {
  opportunity: WorkbenchOpportunity;
}) {
  return (
    <div className="mb-[10px] rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,253,248,1)] p-[14px] last:mb-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[15px] font-semibold leading-[1.3]">
            {opportunity.mainKeyword}
          </div>
      <div className="mt-1 text-[12px] text-[#5e6860]">
            {samePageGroupLabel(opportunity.groupId)} · AI 自动判断页面类型
          </div>
        </div>
        <span
          className={cn(
            "rounded-full px-[9px] py-1 text-[11px] font-medium",
            badgeToneClass("llm")
          )}
        >
          AI 兜底
        </span>
      </div>
      <div className="mt-[10px] flex flex-wrap gap-[6px]">
        <TagChip tone="intent" value={opportunity.intent} />
        <TagChip tone="type" value={opportunity.resolvedContentType} />
        <TagChip tone="score" value={`vol ${formatNumber(opportunity.volume)}`} />
      </div>
    </div>
  );
}

function FilterGroup({
  label,
  options,
  activeValue,
  onSelect,
}: {
  label: string;
  options: string[];
  activeValue: string;
  onSelect: (value: string) => void;
}) {
  return (
    <div className="mb-4">
      <span className="mb-2 block text-[10px] font-medium uppercase tracking-[0.1em] text-[#5e6860]">
        {label}
      </span>
      <div className="flex flex-wrap gap-[6px]">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onSelect(option)}
            className={cn(
              chipBaseClass,
              activeValue === option
                ? "border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.1)] text-[#1d7a5f]"
                : "hover:border-[rgba(29,122,95,0.3)] hover:text-[#1c221d]"
            )}
          >
            {option}
          </button>
        ))}
      </div>
    </div>
  );
}

function TagChip({
  tone,
  value,
}: {
  tone: "intent" | "type" | "role" | "score" | PriorityBand;
  value: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-[9px] py-1 text-[11px] font-medium",
        badgeToneClass(tone)
      )}
    >
      {value}
    </span>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-[10px] py-2">
      <label className="block text-[10px] uppercase tracking-[0.06em] text-[#5e6860]">
        {label}
      </label>
      <strong className="mt-0.5 block text-[15px] font-semibold">{value}</strong>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.1em] text-[#5e6860]">
      {children}
    </div>
  );
}

function StateStep({
  label,
  state,
}: {
  label: string;
  state: "" | "done" | "current" | "fail";
}) {
  return (
    <span
      className={cn(
        "whitespace-nowrap rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-3 py-[6px] text-[11px] font-medium text-[#5e6860]",
        state === "done" &&
          "border-[rgba(44,127,82,0.2)] bg-[rgba(44,127,82,0.1)] text-[#2c7f52]",
        state === "current" &&
          "border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.1)] font-semibold text-[#1d7a5f]",
        state === "fail" &&
          "border-[rgba(178,72,63,0.2)] bg-[rgba(178,72,63,0.1)] text-[#b2483f]"
      )}
    >
      {label}
    </span>
  );
}

function ActionPillButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  loading = false,
  loadingLabel,
  primary = false,
  secondary = false,
  danger = false,
}: {
  icon: typeof Sparkles;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  primary?: boolean;
  secondary?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-4 py-[9px] text-[13px] transition-all disabled:cursor-not-allowed disabled:opacity-40",
        loading && "shadow-[0_10px_24px_rgba(29,122,95,0.16)]",
        primary && "bg-[#1d7a5f] text-white",
        secondary &&
          "border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] text-[#1c221d]",
        danger &&
          "border border-[rgba(178,72,63,0.2)] bg-[rgba(178,72,63,0.1)] text-[#b2483f]"
      )}
    >
      {loading ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        <Icon className="size-4" aria-hidden />
      )}
      <span>{loading ? loadingLabel ?? label : label}</span>
    </button>
  );
}

function DetailSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="mt-4 border-t border-[rgba(28,34,29,0.1)] pt-4">
      <SectionLabel>{title}</SectionLabel>
      <div className="text-[13px] leading-[1.6]">{children}</div>
    </div>
  );
}
