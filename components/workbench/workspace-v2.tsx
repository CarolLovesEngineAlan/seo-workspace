"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import { buildArticleDraftMarkdown } from "@/lib/production/article-draft";
import { buildExportBundleMarkdown } from "@/lib/production/export-markdown";
import { buildWhyNowText } from "@/lib/production/why-now";
import { buildBriefV2Markdown } from "@/lib/production/brief-v2";
import { UserMenu } from "@/components/auth/user-menu";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import {
  canGenerateBriefFromStatus,
  canGenerateDraftFromStatus,
  canMarkPublishedFromStatus,
  canMarkReadyToUploadFromStatus,
  deriveWorkflowStatus,
  getWorkflowSnapshot,
  getWorkflowStatusLabel,
  isPublishedWorkflowStatus,
  WORKFLOW_STATUS_ORDER,
} from "@/lib/opportunity/workflow-status";
import type { WorkbenchOpportunity, WorkflowStatus } from "@/lib/types/opportunity";
import { cn } from "@/lib/utils";

// ─── Constants ────────────────────────────────────────────────────────────────
const PAGE_SIZE = 20;

// ─── Types ────────────────────────────────────────────────────────────────────
type Props = {
  opportunities: WorkbenchOpportunity[];
  supabaseMode: boolean;
  dataSource: string;
  sourceError?: string | null;
  supplementLoadError?: string | null;
  authRole?: string;
  userEmail?: string;
  canWrite?: boolean;
  canManageUsers?: boolean;
};

type StatusTab = "all" | WorkflowStatus;
type ColumnId =
  | "cluster"
  | "type"
  | "intent"
  | "volume"
  | "kd"
  | "priority"
  | "status"
  | "rowCount";

type UiMessage = { tone: "success" | "error"; text: string } | null;

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatusTab(opp: WorkbenchOpportunity): WorkflowStatus {
  return deriveWorkflowStatus(opp);
}

const STATUS_TAB_LABELS: Record<StatusTab, string> = {
  all: "全部",
  pending: "待生产",
  brief_done: "Brief 完成",
  draft_done: "初稿完成",
  ready_to_upload: "待上传",
  published: "已发布",
};

const STATUS_TABS: StatusTab[] = ["all", ...WORKFLOW_STATUS_ORDER];

// ─── Column definitions ───────────────────────────────────────────────────────
const ALL_COLUMNS: { id: ColumnId; label: string }[] = [
  { id: "cluster", label: "话题群" },
  { id: "type", label: "页面类型" },
  { id: "intent", label: "搜索意图" },
  { id: "volume", label: "搜索量" },
  { id: "kd", label: "难度 KD" },
  { id: "priority", label: "优先级" },
  { id: "status", label: "状态" },
  { id: "rowCount", label: "源记录数" },
];

// ─── Misc helpers ─────────────────────────────────────────────────────────────
function priorityBand(opp: WorkbenchOpportunity): "high" | "medium" | "low" {
  if (opp.opportunityScore >= 85) return "high";
  if (opp.opportunityScore >= 70) return "medium";
  return "low";
}

function priorityLabel(band: "high" | "medium" | "low"): string {
  if (band === "high") return "高";
  if (band === "medium") return "中";
  return "低";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("zh-CN").format(value);
}

function paginationPages(current: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | "…")[] = [];
  const addPage = (p: number) => {
    if (!pages.includes(p)) pages.push(p);
  };
  [1, 2].forEach(addPage);
  if (current - 2 > 3) pages.push("…");
  [current - 1, current, current + 1].forEach((p) => {
    if (p > 2 && p < total - 1) addPage(p);
  });
  if (current + 2 < total - 2) pages.push("…");
  [total - 1, total].forEach(addPage);
  return pages;
}

function downloadMarkdown(markdown: string, filenameBase: string) {
  const sanitizedBase =
    filenameBase
      .trim()
      .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "markdown";
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${sanitizedBase}.md`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

function getWorkflowDescription(status: WorkflowStatus): string {
  if (status === "pending") {
    return "当前刚同步完成，可以开始生成 Brief。";
  }

  if (status === "brief_done") {
    return "Brief 已生成，可以继续编辑 Brief，然后进入初稿阶段。";
  }

  if (status === "draft_done") {
    return "初稿已生成，可以继续编辑 Brief / 初稿，并推进到待上传。";
  }

  if (status === "ready_to_upload") {
    return "内容已准备好上传，上传完成后再标记为已发布。";
  }

  return "当前已经处于已发布状态，默认保持只读。";
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WorkspaceV2({
  opportunities,
  supabaseMode,
  sourceError,
  supplementLoadError,
  authRole,
  userEmail,
  canWrite,
  canManageUsers,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Filter state
  const [activeTab, setActiveTab] = useState<StatusTab>("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnId>>(new Set());
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Pagination
  const [page, setPage] = useState(1);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Detail panel
  const [detailId, setDetailId] = useState<string | null>(null);

  // Local overrides (same pattern as V1)
  const [localOverrides, setLocalOverrides] = useState<
    Record<string, Partial<WorkbenchOpportunity>>
  >({});

  // Generation state
  const [pendingBriefIds, setPendingBriefIds] = useState<Set<string>>(new Set());
  const [message, setMessage] = useState<UiMessage>(null);
  const [busy, setBusy] = useState(false);

  function refresh() {
    startTransition(() => {
      router.refresh();
    });
  }

  function applyLocalPatch(groupId: string, patch: Partial<WorkbenchOpportunity>) {
    setLocalOverrides((cur) => ({
      ...cur,
      [groupId]: {
        ...(cur[groupId] ?? {}),
        ...patch,
        syncedAt: new Date().toISOString(),
      },
    }));
  }

  // ─── Computed ─────────────────────────────────────────────────────────────
  const mergedOpportunities = useMemo(
    () =>
      opportunities.map((o) => ({ ...o, ...(localOverrides[o.groupId] ?? {}) })),
    [opportunities, localOverrides]
  );

  const eligibleOpportunities = useMemo(
    () => mergedOpportunities.filter((o) => !o.needsReview),
    [mergedOpportunities]
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusTab, number> = {
      all: 0,
      pending: 0,
      brief_done: 0,
      draft_done: 0,
      ready_to_upload: 0,
      published: 0,
    };
    for (const opp of eligibleOpportunities) {
      counts.all++;
      counts[getStatusTab(opp)]++;
    }
    return counts;
  }, [eligibleOpportunities]);

  const typeOptions = useMemo(
    () =>
      [
        ...new Set(
          eligibleOpportunities.map((o) => o.resolvedContentType).filter(Boolean)
        ),
      ].sort(),
    [eligibleOpportunities]
  );

  const filteredOpportunities = useMemo(() => {
    return eligibleOpportunities
      .filter((o) => activeTab === "all" || getStatusTab(o) === activeTab)
      .filter((o) => typeFilter === "all" || o.resolvedContentType === typeFilter)
      .filter(
        (o) =>
          !searchQuery ||
          o.mainKeyword.toLowerCase().includes(searchQuery.toLowerCase())
      )
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [eligibleOpportunities, activeTab, typeFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredOpportunities.length / PAGE_SIZE));

  const paginatedOpportunities = useMemo(
    () =>
      filteredOpportunities.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredOpportunities, page]
  );

  const detailOpportunity = useMemo(
    () =>
      detailId
        ? (mergedOpportunities.find((o) => o.groupId === detailId) ?? null)
        : null,
    [detailId, mergedOpportunities]
  );

  const visibleColumns = useMemo(
    () => ALL_COLUMNS.filter((col) => !hiddenColumns.has(col.id)),
    [hiddenColumns]
  );

  // Reset page + selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab, typeFilter, searchQuery]);

  // ─── Selection helpers ─────────────────────────────────────────────────────
  const pageIds = paginatedOpportunities.map((o) => o.groupId);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const somePageSelected = pageIds.some((id) => selectedIds.has(id));

  function toggleAll() {
    if (allPageSelected) {
      setSelectedIds((cur) => {
        const next = new Set(cur);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((cur) => {
        const next = new Set(cur);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  }

  function toggleRow(id: string) {
    setSelectedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ─── Bulk brief generation ────────────────────────────────────────────────
  async function generateBriefs() {
    if (!canWrite) {
      setMessage({ tone: "error", text: "当前账号没有写入权限，无法生成 Brief。" });
      return;
    }

    const selected = eligibleOpportunities.filter((o) => selectedIds.has(o.groupId));
    const candidates = selected.filter((o) =>
      canGenerateBriefFromStatus(getStatusTab(o))
    );

    if (candidates.length === 0) {
      setMessage({
        tone: "error",
        text: "当前选中的机会都不在「待生产」状态，无法批量生成 Brief。",
      });
      return;
    }

    if (!supabaseMode) {
      for (const opp of candidates) {
        const withWhyNow = opp.whyNow
          ? opp
          : { ...opp, whyNow: buildWhyNowText(opp) };
        const nextWorkflow = getWorkflowSnapshot("brief_done");
        applyLocalPatch(opp.groupId, {
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          whyNow: withWhyNow.whyNow,
          briefMarkdown: buildBriefV2Markdown(withWhyNow),
        });
      }
      setMessage({
        tone: "success",
        text:
          candidates.length === selected.length
            ? `已生成 ${candidates.length} 份 Brief。`
            : `已生成 ${candidates.length} 份 Brief，跳过 ${selected.length - candidates.length} 条非待生产机会。`,
      });
      setSelectedIds(new Set());
      return;
    }

    setBusy(true);
    setMessage(null);
    let successCount = 0;

    for (const opp of candidates) {
      setPendingBriefIds((cur) => new Set(cur).add(opp.groupId));
      try {
        const response = await fetch(
          `/api/opportunities/${encodeURIComponent(opp.groupId)}/generate`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ kind: "brief" }),
          }
        );
        const data = await response.json().catch(() => ({}));
        if (response.ok) {
          successCount++;
          if (typeof data.markdown === "string") {
            const nextWorkflow = getWorkflowSnapshot("brief_done");
            applyLocalPatch(opp.groupId, {
              pipelineStatus: nextWorkflow.pipelineStatus,
              productionStage: nextWorkflow.productionStage,
              whyNow: opp.whyNow ?? buildWhyNowText(opp),
              briefMarkdown: data.markdown,
            });
          }
        } else {
          setMessage({
            tone: "error",
            text: data.error ?? "生成 Brief 失败",
          });
        }
      } finally {
        setPendingBriefIds((cur) => {
          const next = new Set(cur);
          next.delete(opp.groupId);
          return next;
        });
      }
    }

    setBusy(false);
    setMessage({
      tone: "success",
      text:
        candidates.length === selected.length
          ? `已生成 ${successCount} 份 Brief。`
          : `已生成 ${successCount} 份 Brief，跳过 ${selected.length - candidates.length} 条非待生产机会。`,
    });
    setSelectedIds(new Set());
    refresh();
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto w-full max-w-[1560px] px-4 py-6 md:px-6 xl:px-8">

        {/* ── Sticky header ── */}
        <div className="sticky top-4 z-40 mb-4">
          <header className="rounded-[26px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.72)] px-[22px] py-4 shadow-[0_20px_52px_rgba(44,38,22,0.12)] backdrop-blur-[18px]">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">

              {/* Brand */}
              <div className="flex items-center gap-3">
                <div className="flex size-[34px] shrink-0 items-center justify-center rounded-[10px] bg-[#1d7a5f] text-[15px] font-bold text-white">
                  S
                </div>
                <div>
                  <h1 className="text-[15px] font-semibold">SEO 内容生产工作台</h1>
                  <p className="mt-0.5 text-[12px] text-[#5e6860]">
                    数据表视图 · v2
                  </p>
                </div>
              </div>

              {/* Status tabs */}
              <div className="flex flex-wrap items-center gap-3">
                <nav
                  aria-label="生产状态"
                  className="inline-flex flex-wrap gap-1 rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] p-1"
                >
                  {STATUS_TABS.map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveTab(tab)}
                      className={cn(
                        "inline-flex items-center gap-[5px] rounded-full px-4 py-[7px] text-[12px] font-medium transition-all",
                        activeTab === tab
                          ? "bg-[rgba(255,253,248,1)] text-[#1c221d] shadow-[0_2px_8px_rgba(28,34,29,0.1)]"
                          : "text-[#5e6860] hover:bg-[rgba(255,255,255,0.5)] hover:text-[#1c221d]"
                      )}
                    >
                      {STATUS_TAB_LABELS[tab]}
                      <span
                        className={cn(
                          "rounded-full px-[6px] py-[1px] text-[10px] font-semibold",
                          activeTab === tab
                            ? "bg-[rgba(29,122,95,0.12)] text-[#1d7a5f]"
                            : "bg-[rgba(28,34,29,0.07)] text-[#5e6860]"
                        )}
                      >
                        {statusCounts[tab]}
                      </span>
                    </button>
                  ))}
                </nav>
                <ProjectNavigation activeKey="workbench" variant="warm" />
                {userEmail && (
                  <UserMenu
                    userEmail={userEmail}
                    role={(authRole ?? "viewer") as "viewer" | "editor" | "admin"}
                    canManageUsers={canManageUsers ?? false}
                  />
                )}
              </div>
            </div>
          </header>
        </div>

        {/* ── Alerts ── */}
        {(sourceError || supplementLoadError) && (
          <div className="mb-4 grid gap-3 md:grid-cols-2">
            {sourceError && <AlertBanner text={sourceError} />}
            {supplementLoadError && <AlertBanner text={supplementLoadError} />}
          </div>
        )}

        {/* ── Message ── */}
        {message && (
          <div
            className={cn(
              "mb-4 flex items-center justify-between rounded-[18px] border px-4 py-3 text-[13px]",
              message.tone === "success"
                ? "border-[rgba(44,127,82,0.2)] bg-[rgba(44,127,82,0.1)] text-[#2c7f52]"
                : "border-[rgba(178,72,63,0.18)] bg-[rgba(178,72,63,0.06)] text-[#b2483f]"
            )}
          >
            {message.text}
            <button
              type="button"
              onClick={() => setMessage(null)}
              className="ml-3 opacity-60 hover:opacity-100"
            >
              <X className="size-4" />
            </button>
          </div>
        )}

        {/* ── Table card ── */}
        <div className="overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]">

          {/* Table toolbar */}
          <div className="flex flex-wrap items-center gap-3 border-b border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.45)] px-5 py-3">

            {/* Search */}
            <div className="relative flex items-center">
              <Search className="pointer-events-none absolute left-3 size-[14px] text-[#5e6860]" />
              <input
                type="text"
                placeholder="搜索关键词…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-9 w-[200px] rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.8)] pl-9 pr-4 text-[13px] outline-none placeholder:text-[#5e6860] focus:border-[rgba(29,122,95,0.4)] focus:ring-2 focus:ring-[rgba(29,122,95,0.1)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 text-[#5e6860] hover:text-[#1c221d]"
                >
                  <X className="size-3.5" />
                </button>
              )}
            </div>

            {/* Type filter */}
            <div className="relative">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-9 cursor-pointer appearance-none rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.8)] pl-4 pr-8 text-[13px] text-[#1c221d] outline-none focus:border-[rgba(29,122,95,0.4)]"
              >
                <option value="all">全部类型</option>
                {typeOptions.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-[#5e6860]" />
            </div>

            {/* Column visibility */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnMenu((v) => !v)}
                className="inline-flex h-9 items-center gap-[6px] rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.8)] px-4 text-[13px] text-[#5e6860] transition-colors hover:text-[#1c221d]"
              >
                <span>显示列</span>
                {hiddenColumns.size > 0 && (
                  <span className="rounded-full bg-[rgba(29,122,95,0.12)] px-[6px] py-[1px] text-[10px] font-semibold text-[#1d7a5f]">
                    隐藏 {hiddenColumns.size}
                  </span>
                )}
                <ChevronDown className="size-3.5" />
              </button>
              {showColumnMenu && (
                <div className="absolute left-0 top-full z-50 mt-2 min-w-[160px] rounded-[16px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.98)] p-2 shadow-[0_16px_40px_rgba(44,38,22,0.14)]">
                  {ALL_COLUMNS.map((col) => (
                    <button
                      key={col.id}
                      type="button"
                      onClick={() =>
                        setHiddenColumns((cur) => {
                          const next = new Set(cur);
                          if (next.has(col.id)) next.delete(col.id);
                          else next.add(col.id);
                          return next;
                        })
                      }
                      className="flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] hover:bg-[rgba(29,122,95,0.08)]"
                    >
                      <span
                        className={cn(
                          "inline-flex size-4 items-center justify-center rounded-[4px] border text-[8px] font-bold transition-colors",
                          hiddenColumns.has(col.id)
                            ? "border-[rgba(28,34,29,0.2)] text-transparent"
                            : "border-[#1d7a5f] bg-[#1d7a5f] text-white"
                        )}
                      >
                        ✓
                      </span>
                      {col.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="ml-auto text-[12px] text-[#5e6860]">
              {filteredOpportunities.length} 条
            </span>
          </div>

          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-3 border-b border-[rgba(29,122,95,0.15)] bg-[rgba(29,122,95,0.06)] px-5 py-2.5">
              <span className="text-[13px] font-medium text-[#1d7a5f]">
                已选 {selectedIds.size} 条
              </span>
              <button
                type="button"
                disabled={busy || !canWrite}
                onClick={generateBriefs}
                className="inline-flex items-center gap-[6px] rounded-full bg-[#1d7a5f] px-4 py-[6px] text-[12px] font-medium text-white transition-colors hover:bg-[#166b52] disabled:opacity-50"
              >
                {busy ? (
                  <LoaderCircle className="size-3.5 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3.5" aria-hidden />
                )}
                生成 Brief
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-[12px] text-[#5e6860] hover:text-[#1c221d]"
              >
                取消选择
              </button>
            </div>
          )}

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[rgba(28,34,29,0.08)] bg-[rgba(244,240,230,0.5)]">
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allPageSelected}
                      ref={(el) => {
                        if (el)
                          el.indeterminate = somePageSelected && !allPageSelected;
                      }}
                      onChange={toggleAll}
                      className="size-4 cursor-pointer accent-[#1d7a5f]"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5e6860]">
                    主关键词
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.id}
                      className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5e6860]"
                    >
                      {col.label}
                    </th>
                  ))}
                  <th className="w-16 px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {paginatedOpportunities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 3}
                      className="py-20 text-center text-[13px] text-[#5e6860]"
                    >
                      {searchQuery || typeFilter !== "all"
                        ? "没有符合筛选条件的页面"
                        : "暂无数据"}
                    </td>
                  </tr>
                ) : (
                  paginatedOpportunities.map((opp) => (
                    <OpportunityRow
                      key={opp.groupId}
                      opportunity={opp}
                      selected={selectedIds.has(opp.groupId)}
                      active={detailId === opp.groupId}
                      pendingBrief={pendingBriefIds.has(opp.groupId)}
                      visibleColumnIds={visibleColumns.map((c) => c.id)}
                      onToggleSelect={() => toggleRow(opp.groupId)}
                      onOpenDetail={() =>
                        setDetailId(
                          opp.groupId === detailId ? null : opp.groupId
                        )
                      }
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[rgba(28,34,29,0.08)] px-5 py-3">
              <span className="text-[12px] text-[#5e6860]">
                第 {(page - 1) * PAGE_SIZE + 1}–
                {Math.min(page * PAGE_SIZE, filteredOpportunities.length)} 条，共{" "}
                {filteredOpportunities.length} 条
              </span>
              <div className="flex items-center gap-1">
                <PageBtn
                  onClick={() => setPage((p) => p - 1)}
                  disabled={page === 1}
                  icon={<ChevronLeft className="size-4" />}
                />
                {paginationPages(page, totalPages).map((p, i) =>
                  p === "…" ? (
                    <span
                      key={`ellipsis-${i}`}
                      className="px-1 text-[12px] text-[#5e6860]"
                    >
                      …
                    </span>
                  ) : (
                    <PageBtn
                      key={p}
                      onClick={() => setPage(p)}
                      active={p === page}
                      label={String(p)}
                    />
                  )
                )}
                <PageBtn
                  onClick={() => setPage((p) => p + 1)}
                  disabled={page === totalPages}
                  icon={<ChevronRight className="size-4" />}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Detail panel (slide-in) ── */}
      {detailOpportunity && (
        <DetailPanel
          opportunity={detailOpportunity}
          onClose={() => setDetailId(null)}
          onPatch={(patch) => applyLocalPatch(detailOpportunity.groupId, patch)}
          onNotify={setMessage}
          onRefresh={refresh}
          supabaseMode={supabaseMode}
          canWrite={canWrite ?? false}
        />
      )}

      {/* Click-outside to close column menu */}
      {showColumnMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowColumnMenu(false)}
        />
      )}
    </div>
  );
}

// ─── OpportunityRow ───────────────────────────────────────────────────────────
function OpportunityRow({
  opportunity: opp,
  selected,
  active,
  pendingBrief,
  visibleColumnIds,
  onToggleSelect,
  onOpenDetail,
}: {
  opportunity: WorkbenchOpportunity;
  selected: boolean;
  active: boolean;
  pendingBrief: boolean;
  visibleColumnIds: ColumnId[];
  onToggleSelect: () => void;
  onOpenDetail: () => void;
}) {
  const band = priorityBand(opp);
  const statusTab = getStatusTab(opp);

  return (
    <tr
      className={cn(
        "border-b border-[rgba(28,34,29,0.06)] transition-colors",
        selected && "bg-[rgba(29,122,95,0.05)]",
        active && !selected && "bg-[rgba(29,122,95,0.09)]",
        !selected && !active && "hover:bg-[rgba(255,255,255,0.55)]"
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-4 py-3">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          className="size-4 cursor-pointer accent-[#1d7a5f]"
        />
      </td>

      {/* Main keyword + cluster tag */}
      <td className="min-w-[220px] px-4 py-3">
        <button
          type="button"
          onClick={onOpenDetail}
          className="text-left"
        >
          <div className="text-[14px] font-medium leading-[1.35] text-[#1c221d] hover:underline decoration-[rgba(29,122,95,0.4)]">
            {opp.mainKeyword}
          </div>
          {opp.topicClusterName && (
            <span className="mt-[4px] inline-block rounded-full bg-[rgba(179,131,24,0.12)] px-[8px] py-[2px] text-[10px] font-medium text-[#b38318]">
              {opp.topicClusterName}
            </span>
          )}
        </button>
      </td>

      {/* Dynamic columns */}
      {visibleColumnIds.map((colId) => (
        <td key={colId} className="whitespace-nowrap px-4 py-3 text-[13px]">
          {colId === "cluster" && (
            <span className="rounded-full bg-[rgba(179,131,24,0.12)] px-[9px] py-1 text-[11px] font-medium text-[#b38318]">
              {opp.topicClusterName || "—"}
            </span>
          )}
          {colId === "type" && (
            <span className="rounded-full bg-[rgba(194,106,57,0.12)] px-[9px] py-1 text-[11px] font-medium text-[#9c4d28]">
              {opp.resolvedContentType || "—"}
            </span>
          )}
          {colId === "intent" && (
            <span className="rounded-full bg-[rgba(29,122,95,0.1)] px-[9px] py-1 text-[11px] font-medium text-[#1d7a5f]">
              {opp.intent || "—"}
            </span>
          )}
          {colId === "volume" && (
            <span className="text-[#1c221d]">{formatNumber(opp.volume)}</span>
          )}
          {colId === "kd" && (
            <span
              className={cn(
                "font-semibold",
                opp.kd >= 70
                  ? "text-[#b2483f]"
                  : opp.kd >= 40
                    ? "text-[#b38318]"
                    : "text-[#2c7f52]"
              )}
            >
              {opp.kd}
            </span>
          )}
          {colId === "priority" && (
            <span
              className={cn(
                "rounded-full px-[9px] py-1 text-[11px] font-medium",
                band === "high"
                  ? "bg-[rgba(44,127,82,0.1)] text-[#2c7f52]"
                  : band === "medium"
                    ? "bg-[rgba(179,131,24,0.12)] text-[#b38318]"
                    : "bg-[rgba(178,72,63,0.1)] text-[#b2483f]"
              )}
            >
              {priorityLabel(band)}
            </span>
          )}
          {colId === "status" && <StatusBadge tab={statusTab} />}
          {colId === "rowCount" && (
            <span className="text-[#5e6860]">{opp.rowCount}</span>
          )}
        </td>
      ))}

      {/* Action / loading */}
      <td className="px-4 py-3">
        {pendingBrief ? (
          <LoaderCircle className="size-4 animate-spin text-[#1d7a5f]" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onOpenDetail}
            className={cn(
              "rounded-full border px-3 py-1 text-[11px] transition-colors",
              active
                ? "border-[rgba(29,122,95,0.4)] text-[#1d7a5f]"
                : "border-[rgba(28,34,29,0.1)] text-[#5e6860] hover:border-[rgba(29,122,95,0.3)] hover:text-[#1d7a5f]"
            )}
          >
            {active ? "收起" : "详情"}
          </button>
        )}
      </td>
    </tr>
  );
}

// ─── StatusBadge ──────────────────────────────────────────────────────────────
function StatusBadge({ tab }: { tab: WorkflowStatus }) {
  const styles: Record<WorkflowStatus, string> = {
    pending: "bg-[rgba(28,34,29,0.07)] text-[#5e6860]",
    brief_done: "bg-[rgba(29,122,95,0.1)] text-[#1d7a5f]",
    draft_done: "bg-[rgba(179,131,24,0.12)] text-[#b38318]",
    ready_to_upload: "bg-[rgba(44,127,82,0.1)] text-[#2c7f52]",
    published: "bg-[rgba(29,122,95,0.18)] text-[#145541]",
  };
  const labels: Record<WorkflowStatus, string> = {
    pending: "待生产",
    brief_done: "Brief 完成",
    draft_done: "初稿完成",
    ready_to_upload: "待上传",
    published: "已发布",
  };
  return (
    <span
      className={cn(
        "rounded-full px-[9px] py-1 text-[11px] font-medium",
        styles[tab]
      )}
    >
      {labels[tab]}
    </span>
  );
}

// ─── DetailPanel ──────────────────────────────────────────────────────────────
function DetailPanel({
  opportunity,
  onClose,
  onPatch,
  onNotify,
  onRefresh,
  supabaseMode,
  canWrite,
}: {
  opportunity: WorkbenchOpportunity;
  onClose: () => void;
  onPatch: (patch: Partial<WorkbenchOpportunity>) => void;
  onNotify: (message: UiMessage) => void;
  onRefresh: () => void;
  supabaseMode: boolean;
  canWrite: boolean;
}) {
  const whyNow = opportunity.whyNow ?? buildWhyNowText(opportunity);
  const workflowStatus = getStatusTab(opportunity);
  const [strategyBusy, setStrategyBusy] = useState(false);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState<null | "brief" | "draft">(null);
  const [exportBusy, setExportBusy] = useState(false);
  const [briefMarkdown, setBriefMarkdown] = useState(opportunity.briefMarkdown ?? "");
  const [articleDraftMarkdown, setArticleDraftMarkdown] = useState(
    opportunity.articleDraftMarkdown ?? ""
  );

  useEffect(() => {
    setBriefMarkdown(opportunity.briefMarkdown ?? "");
  }, [opportunity.groupId, opportunity.briefMarkdown]);

  useEffect(() => {
    setArticleDraftMarkdown(opportunity.articleDraftMarkdown ?? "");
  }, [opportunity.groupId, opportunity.articleDraftMarkdown]);

  async function handleGenerateStrategy() {
    setStrategyBusy(true);
    setStrategyError(null);
    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/content-strategy`,
        { method: "POST" }
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as { markdown?: string; error?: string };
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

  async function persistPatch(
    body: Record<string, unknown>,
    localPatch: Partial<WorkbenchOpportunity>,
    successText: string
  ) {
    if (!canWrite) {
      onNotify({
        tone: "error",
        text: "当前账号没有写入权限，无法修改工作流或保存内容。",
      });
      return false;
    }

    if (!supabaseMode) {
      onPatch(localPatch);
      onNotify({ tone: "success", text: successText });
      return true;
    }

    try {
      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        onNotify({
          tone: "error",
          text: data.error ?? "保存失败",
        });
        return false;
      }

      onPatch(localPatch);
      onNotify({ tone: "success", text: successText });
      onRefresh();
      return true;
    } catch (error) {
      onNotify({
        tone: "error",
        text: error instanceof Error ? error.message : String(error),
      });
      return false;
    }
  }

  async function handleGenerateBrief() {
    if (!canWrite) {
      onNotify({ tone: "error", text: "当前账号没有写入权限，无法生成 Brief。" });
      return;
    }

    setActionBusy(true);
    try {
      const withWhyNow = opportunity.whyNow
        ? opportunity
        : { ...opportunity, whyNow: buildWhyNowText(opportunity) };
      const nextWorkflow = getWorkflowSnapshot("brief_done");

      if (!supabaseMode) {
        const generated = buildBriefV2Markdown(withWhyNow);
        onPatch({
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          whyNow: withWhyNow.whyNow,
          briefMarkdown: generated,
        });
        setBriefMarkdown(generated);
        onNotify({ tone: "success", text: "Brief 已生成。" });
        return;
      }

      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "brief" }),
        }
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as { markdown?: string; error?: string };

      if (!response.ok) {
        onNotify({
          tone: "error",
          text: data.error ?? "生成 Brief 失败",
        });
        return;
      }

      if (typeof data.markdown === "string") {
        onPatch({
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          whyNow: withWhyNow.whyNow,
          briefMarkdown: data.markdown,
        });
        setBriefMarkdown(data.markdown);
      }
      onNotify({ tone: "success", text: "Brief 已生成。" });
      onRefresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleGenerateDraft() {
    if (!canWrite) {
      onNotify({ tone: "error", text: "当前账号没有写入权限，无法生成初稿。" });
      return;
    }

    setActionBusy(true);
    try {
      const nextWorkflow = getWorkflowSnapshot("draft_done");

      if (!supabaseMode) {
        const withWhyNow = opportunity.whyNow
          ? opportunity
          : { ...opportunity, whyNow: buildWhyNowText(opportunity) };
        const withBrief = withWhyNow.briefMarkdown
          ? withWhyNow
          : {
              ...withWhyNow,
              briefMarkdown: buildBriefV2Markdown(withWhyNow),
            };
        const generated = buildArticleDraftMarkdown(withBrief);
        onPatch({
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          articleDraftMarkdown: generated,
          briefMarkdown: withBrief.briefMarkdown,
          whyNow: withBrief.whyNow,
        });
        setArticleDraftMarkdown(generated);
        onNotify({ tone: "success", text: "初稿已生成。" });
        return;
      }

      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "draft" }),
        }
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as { markdown?: string; error?: string };

      if (!response.ok) {
        onNotify({
          tone: "error",
          text: data.error ?? "生成初稿失败",
        });
        return;
      }

      if (typeof data.markdown === "string") {
        onPatch({
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          articleDraftMarkdown: data.markdown,
        });
        setArticleDraftMarkdown(data.markdown);
      }
      onNotify({ tone: "success", text: "初稿已生成。" });
      onRefresh();
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMarkReadyToUpload() {
    const nextWorkflow = getWorkflowSnapshot("ready_to_upload");
    setActionBusy(true);
    try {
      await persistPatch(
        { workflowStatus: "ready_to_upload" },
        {
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
        },
        "已进入待上传。"
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleMarkPublished() {
    const nextWorkflow = getWorkflowSnapshot("published");
    setActionBusy(true);
    try {
      await persistPatch(
        { workflowStatus: "published" },
        {
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
        },
        "已标记为已发布。"
      );
    } finally {
      setActionBusy(false);
    }
  }

  async function handleSave(kind: "brief" | "draft") {
    const isBrief = kind === "brief";
    const content = isBrief ? briefMarkdown : articleDraftMarkdown;

    if (!content.trim()) {
      onNotify({
        tone: "error",
        text: isBrief ? "Brief 不能为空。" : "初稿内容不能为空。",
      });
      return;
    }

    setSaveBusy(kind);
    try {
      await persistPatch(
        isBrief
          ? { briefMarkdown: content }
          : { articleDraftMarkdown: content },
        isBrief
          ? { briefMarkdown: content }
          : { articleDraftMarkdown: content },
        isBrief ? "Brief 已保存。" : "初稿已保存。"
      );
    } finally {
      setSaveBusy(null);
    }
  }

  async function handleExport() {
    if (!canWrite) {
      onNotify({ tone: "error", text: "当前账号没有写入权限，无法导出 Markdown。" });
      return;
    }

    setExportBusy(true);
    try {
      if (!supabaseMode) {
        downloadMarkdown(
          buildExportBundleMarkdown(opportunity),
          `export-${opportunity.mainKeyword}`
        );
        onNotify({ tone: "success", text: "Markdown 导出已开始。" });
        return;
      }

      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "export" }),
        }
      );
      const data = (await response
        .json()
        .catch(() => ({}))) as { markdown?: string; error?: string };

      if (!response.ok || typeof data.markdown !== "string") {
        onNotify({
          tone: "error",
          text: data.error ?? "导出失败",
        });
        return;
      }

      downloadMarkdown(data.markdown, `export-${opportunity.mainKeyword}`);
      onNotify({ tone: "success", text: "Markdown 导出已开始。" });
    } finally {
      setExportBusy(false);
    }
  }

  function handleDownloadDraft() {
    if (!articleDraftMarkdown.trim()) {
      onNotify({ tone: "error", text: "当前还没有可下载的初稿 Markdown。" });
      return;
    }

    downloadMarkdown(articleDraftMarkdown, `draft-${opportunity.mainKeyword}`);
    onNotify({ tone: "success", text: "初稿 Markdown 下载已开始。" });
  }

  const band = priorityBand(opportunity);
  const briefDirty = briefMarkdown !== (opportunity.briefMarkdown ?? "");
  const draftDirty =
    articleDraftMarkdown !== (opportunity.articleDraftMarkdown ?? "");
  const canEditGeneratedMarkdown =
    canWrite && !isPublishedWorkflowStatus(workflowStatus);

  let primaryActionLabel: string | null = null;
  let primaryActionHandler: (() => Promise<void>) | null = null;

  if (canGenerateBriefFromStatus(workflowStatus)) {
    primaryActionLabel = "生成 Brief";
    primaryActionHandler = handleGenerateBrief;
  } else if (canGenerateDraftFromStatus(workflowStatus)) {
    primaryActionLabel = "生成初稿";
    primaryActionHandler = handleGenerateDraft;
  } else if (canMarkReadyToUploadFromStatus(workflowStatus)) {
    primaryActionLabel = "进入待上传";
    primaryActionHandler = handleMarkReadyToUpload;
  } else if (canMarkPublishedFromStatus(workflowStatus)) {
    primaryActionLabel = "标记为已发布";
    primaryActionHandler = handleMarkPublished;
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-[rgba(28,34,29,0.15)] backdrop-blur-[3px]"
        onClick={onClose}
      />

      {/* Slide-in panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-[440px] flex-col bg-[rgba(255,252,244,0.98)] shadow-[0_0_60px_rgba(28,34,29,0.18)] ring-1 ring-[rgba(28,34,29,0.08)]">

        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(28,34,29,0.1)] px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold leading-[1.2] text-[#1c221d]">
              {opportunity.mainKeyword}
            </h2>
            <div className="mt-2 flex flex-wrap gap-[5px]">
              {opportunity.topicClusterName && (
                <span className="rounded-full bg-[rgba(179,131,24,0.12)] px-[8px] py-[3px] text-[10px] font-medium text-[#b38318]">
                  {opportunity.topicClusterName}
                </span>
              )}
              <span
                className={cn(
                  "rounded-full px-[8px] py-[3px] text-[10px] font-medium",
                  band === "high"
                    ? "bg-[rgba(44,127,82,0.1)] text-[#2c7f52]"
                    : band === "medium"
                      ? "bg-[rgba(179,131,24,0.12)] text-[#b38318]"
                      : "bg-[rgba(178,72,63,0.1)] text-[#b2483f]"
                )}
              >
                {priorityLabel(band)} 优先
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-[#5e6860] hover:bg-[rgba(28,34,29,0.06)] hover:text-[#1c221d]"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Panel body */}
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">

          {/* Stats */}
          <div className="grid grid-cols-3 gap-2">
            <MiniStat label="搜索量" value={formatNumber(opportunity.volume)} />
            <MiniStat label="难度 KD" value={String(opportunity.kd)} />
            <MiniStat label="评分" value={String(opportunity.opportunityScore)} />
          </div>

          <div>
            <PanelSectionLabel>当前状态</PanelSectionLabel>
            <div className="mt-2 flex items-center gap-2">
              <StatusBadge tab={workflowStatus} />
              <span className="text-[12px] text-[#5e6860]">
                {getWorkflowStatusLabel(workflowStatus)}
              </span>
            </div>
            <p className="mt-2 text-[12px] leading-[1.7] text-[#5e6860]">
              {getWorkflowDescription(workflowStatus)}
            </p>
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-[6px]">
            {opportunity.intent && (
              <TagPill color="intent" value={opportunity.intent} />
            )}
            {opportunity.resolvedContentType && (
              <TagPill color="type" value={opportunity.resolvedContentType} />
            )}
            {opportunity.internalLinkRole && (
              <TagPill color="role" value={opportunity.internalLinkRole} />
            )}
          </div>

          {/* Why now */}
          <div>
            <PanelSectionLabel>为什么现在做</PanelSectionLabel>
            <p className="mt-2 text-[13px] leading-[1.75] text-[#1c221d]">
              {whyNow}
            </p>
          </div>

          {/* Content strategy */}
          <div>
            <div className="flex items-center justify-between gap-2">
              <PanelSectionLabel>内容策略</PanelSectionLabel>
              <button
                type="button"
                disabled={strategyBusy}
                onClick={handleGenerateStrategy}
                className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
              >
                {strategyBusy ? (
                  <LoaderCircle className="size-3 animate-spin" aria-hidden />
                ) : (
                  <Sparkles className="size-3" aria-hidden />
                )}
                {strategyBusy ? "AI 分析中…" : "AI 分析 SERP"}
              </button>
            </div>

            {strategyError && (
              <div className="mt-2 rounded-[12px] border border-[rgba(178,72,63,0.18)] bg-[rgba(178,72,63,0.06)] px-3 py-2 text-[12px] leading-[1.6] text-[#b2483f]">
                {strategyError}
              </div>
            )}

            {opportunity.pageBrief ? (
              <div className="mt-2 rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.55)] px-4 py-3 text-[13px] leading-[1.75] text-[#1c221d] whitespace-pre-wrap">
                {opportunity.pageBrief}
              </div>
            ) : (
              <p className="mt-2 text-[12px] text-[#5e6860]">
                点击「AI 分析 SERP」自动调研 Top 10 竞争格局并生成策略。
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <PanelSectionLabel>Brief</PanelSectionLabel>
              {opportunity.briefMarkdown && canEditGeneratedMarkdown && (
                <button
                  type="button"
                  disabled={!briefDirty || saveBusy !== null}
                  onClick={() => void handleSave("brief")}
                  className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
                >
                  {saveBusy === "brief" && (
                    <LoaderCircle className="size-3 animate-spin" aria-hidden />
                  )}
                  保存 Brief
                </button>
              )}
            </div>

            {opportunity.briefMarkdown ? (
              <textarea
                value={briefMarkdown}
                onChange={(event) => setBriefMarkdown(event.target.value)}
                readOnly={!canEditGeneratedMarkdown}
                className="mt-2 min-h-[220px] w-full rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3 text-[13px] leading-[1.75] text-[#1c221d] outline-none focus:border-[rgba(29,122,95,0.32)]"
              />
            ) : (
              <p className="mt-2 text-[12px] text-[#5e6860]">
                生成 Brief 后会显示在这里，生成后仍然可以继续人工编辑。
              </p>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between gap-2">
              <PanelSectionLabel>初稿</PanelSectionLabel>
              {opportunity.articleDraftMarkdown && canEditGeneratedMarkdown && (
                <button
                  type="button"
                  disabled={!draftDirty || saveBusy !== null}
                  onClick={() => void handleSave("draft")}
                  className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
                >
                  {saveBusy === "draft" && (
                    <LoaderCircle className="size-3 animate-spin" aria-hidden />
                  )}
                  保存初稿
                </button>
              )}
            </div>

            {opportunity.articleDraftMarkdown ? (
              <textarea
                value={articleDraftMarkdown}
                onChange={(event) => setArticleDraftMarkdown(event.target.value)}
                readOnly={!canEditGeneratedMarkdown}
                className="mt-2 min-h-[260px] w-full rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3 text-[13px] leading-[1.75] text-[#1c221d] outline-none focus:border-[rgba(29,122,95,0.32)]"
              />
            ) : (
              <p className="mt-2 text-[12px] text-[#5e6860]">
                进入「Brief 完成」后即可生成初稿；初稿生成后仍然可以继续人工编辑。
              </p>
            )}
          </div>

          {isPublishedWorkflowStatus(workflowStatus) && (
            <div className="rounded-[14px] border border-[rgba(179,131,24,0.2)] bg-[rgba(255,248,232,0.7)] px-4 py-3 text-[12px] leading-[1.7] text-[#7b6324]">
              当前处于已发布状态，默认不再直接编辑 Brief 和初稿。
            </div>
          )}
        </div>

        {/* Panel footer */}
        <div className="grid gap-2 border-t border-[rgba(28,34,29,0.1)] px-5 py-4">
          {primaryActionHandler ? (
            <button
              type="button"
              disabled={actionBusy || !canWrite}
              onClick={() => void primaryActionHandler?.()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#1d7a5f] px-4 py-3 text-[13px] font-medium text-white transition-colors hover:bg-[#166b52] disabled:opacity-50"
            >
              {actionBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {primaryActionLabel}
            </button>
          ) : (
            <div className="rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(244,240,230,0.7)] px-4 py-3 text-[12px] leading-[1.7] text-[#5e6860]">
              当前没有下一步自动推进动作。
            </div>
          )}

          {articleDraftMarkdown.trim() && (
            <button
              type="button"
              onClick={handleDownloadDraft}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-[13px] font-medium text-[#1c221d] transition-colors hover:border-[rgba(29,122,95,0.24)] hover:text-[#1d7a5f]"
            >
              下载初稿 Markdown
            </button>
          )}

          {(opportunity.briefMarkdown || opportunity.articleDraftMarkdown) && (
            <button
              type="button"
              disabled={exportBusy || !canWrite}
              onClick={() => void handleExport()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-4 py-3 text-[13px] font-medium text-[#1c221d] transition-colors hover:border-[rgba(29,122,95,0.24)] hover:text-[#1d7a5f] disabled:opacity-50"
              >
                {exportBusy ? (
                  <LoaderCircle className="size-4 animate-spin" aria-hidden />
                ) : null}
              导出生产包 Markdown
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Small UI components ──────────────────────────────────────────────────────
function PageBtn({
  onClick,
  disabled,
  active,
  label,
  icon,
}: {
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  label?: string;
  icon?: ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-full text-[13px] transition-all disabled:opacity-40",
        active
          ? "bg-[#1d7a5f] font-semibold text-white shadow-[0_4px_12px_rgba(29,122,95,0.24)]"
          : "border border-[rgba(28,34,29,0.1)] text-[#5e6860] hover:border-[rgba(29,122,95,0.3)] hover:text-[#1c221d]"
      )}
    >
      {icon ?? label}
    </button>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[12px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.06em] text-[#5e6860]">
        {label}
      </div>
      <div className="mt-0.5 text-[15px] font-semibold">{value}</div>
    </div>
  );
}

function PanelSectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-medium uppercase tracking-[0.1em] text-[#5e6860]">
      {children}
    </div>
  );
}

function TagPill({
  color,
  value,
}: {
  color: "intent" | "type" | "role";
  value: string;
}) {
  const styles = {
    intent: "bg-[rgba(29,122,95,0.1)] text-[#1d7a5f]",
    type: "bg-[rgba(194,106,57,0.12)] text-[#9c4d28]",
    role: "bg-[rgba(179,131,24,0.12)] text-[#b38318]",
  };
  return (
    <span
      className={cn(
        "rounded-full px-[9px] py-1 text-[11px] font-medium",
        styles[color]
      )}
    >
      {value}
    </span>
  );
}

function AlertBanner({ text }: { text: string }) {
  return (
    <div className="rounded-[18px] border border-[rgba(179,131,24,0.18)] bg-[rgba(255,252,244,0.85)] px-4 py-3 shadow-[0_12px_24px_rgba(44,38,22,0.05)]">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[#b38318]" aria-hidden />
        <p className="text-[12px] leading-6 text-[#5e6860]">{text}</p>
      </div>
    </div>
  );
}
