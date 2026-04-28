"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
  Maximize2,
  Minimize2,
  Minus,
  Search,
  Sparkles,
  X,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
const ACTION_COLUMN_WIDTH = 92;
const STATUS_COLUMN_WIDTH = 116;
const PRIORITY_COLUMN_WIDTH = 108;

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
  | "status";

type UiMessage = { tone: "success" | "error"; text: string } | null;

type StreamedGenerateDonePayload = {
  type: "done";
  markdown?: string;
  pipelineStatus?: WorkbenchOpportunity["pipelineStatus"];
  productionStage?: WorkbenchOpportunity["productionStage"];
  whyNow?: string;
};

// ─── Status helpers ───────────────────────────────────────────────────────────
function getStatusTab(opp: WorkbenchOpportunity): WorkflowStatus {
  return deriveWorkflowStatus(opp);
}

async function readStreamedGenerateResponse(
  response: Response,
  onDelta: (delta: string) => void
): Promise<StreamedGenerateDonePayload> {
  if (!response.ok) {
    const data = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? "生成失败");
  }

  if (!response.body) {
    throw new Error("流式响应不可用。");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let donePayload: StreamedGenerateDonePayload | null = null;

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        continue;
      }

      let payload: Record<string, unknown>;
      try {
        payload = JSON.parse(trimmed) as Record<string, unknown>;
      } catch {
        continue;
      }

      if (payload.type === "delta" && typeof payload.delta === "string") {
        onDelta(payload.delta);
        continue;
      }

      if (payload.type === "error" && typeof payload.error === "string") {
        throw new Error(payload.error);
      }

      if (payload.type === "done") {
        donePayload = payload as StreamedGenerateDonePayload;
      }
    }
  }

  if (buffer.trim()) {
    try {
      const payload = JSON.parse(buffer.trim()) as Record<string, unknown>;
      if (payload.type === "error" && typeof payload.error === "string") {
        throw new Error(payload.error);
      }
      if (payload.type === "done") {
        donePayload = payload as StreamedGenerateDonePayload;
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
    }
  }

  if (!donePayload) {
    throw new Error("生成已结束，但未收到完成结果。");
  }

  return donePayload;
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
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

function getToolbarControlClassName(active: boolean): string {
  return cn(
    "inline-flex h-9 items-center gap-[6px] rounded-full border bg-[rgba(255,255,255,0.8)] px-4 text-[13px] font-medium outline-none shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all",
    active
      ? "border-[rgba(29,122,95,0.28)] bg-[linear-gradient(180deg,rgba(236,248,243,0.96)_0%,rgba(228,243,237,0.9)_100%)] text-[#1d7a5f] shadow-[0_8px_18px_rgba(29,122,95,0.08)] focus:border-[rgba(29,122,95,0.45)] focus:ring-2 focus:ring-[rgba(29,122,95,0.12)]"
      : "border-[rgba(28,34,29,0.12)] text-[#5e6860] hover:border-[rgba(29,122,95,0.24)] hover:text-[#1c221d] focus:border-[rgba(29,122,95,0.35)] focus:ring-2 focus:ring-[rgba(29,122,95,0.1)]"
  );
}

function getPinnedColumnOffset(
  columnId: ColumnId | "action",
  visibleColumnIds: ColumnId[]
): number | null {
  if (columnId === "action") {
    return 0;
  }

  if (columnId === "status") {
    return ACTION_COLUMN_WIDTH;
  }

  if (columnId === "priority") {
    return (
      ACTION_COLUMN_WIDTH +
      (visibleColumnIds.includes("status") ? STATUS_COLUMN_WIDTH : 0)
    );
  }

  return null;
}

function getPinnedColumnWidth(columnId: ColumnId | "action"): number {
  if (columnId === "action") {
    return ACTION_COLUMN_WIDTH;
  }

  if (columnId === "status") {
    return STATUS_COLUMN_WIDTH;
  }

  return PRIORITY_COLUMN_WIDTH;
}

function getPinnedColumnZIndexClass(columnId: ColumnId | "action"): string {
  if (columnId === "action") {
    return "z-30";
  }

  if (columnId === "status") {
    return "z-20";
  }

  return "z-10";
}

function getPinnedCellSurfaceClass(selected: boolean, active: boolean): string {
  return cn(
    "bg-[rgba(255,252,244,0.96)]",
    selected && "bg-[rgba(29,122,95,0.05)]",
    active && !selected && "bg-[rgba(29,122,95,0.09)]",
    !selected && !active && "group-hover:bg-[rgba(255,255,255,0.55)]"
  );
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

function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div className={cn("text-[13px] leading-[1.75] text-[#1c221d]", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => <h1 className="mb-3 mt-5 text-[20px] font-bold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-4 border-b border-[rgba(28,34,29,0.08)] pb-1 text-[16px] font-semibold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-2 mt-3 text-[14px] font-semibold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="mb-3 list-disc space-y-1 pl-5">{children}</ul>,
          ol: ({ children }) => <ol className="mb-3 list-decimal space-y-1 pl-5">{children}</ol>,
          li: ({ children }) => <li className="text-[13px]">{children}</li>,
          strong: ({ children }) => <strong className="font-semibold text-[#1c221d]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[#5e6860]">{children}</em>,
          code: ({ children }) => <code className="rounded-[4px] bg-[rgba(244,240,230,0.9)] px-[4px] py-[1px] font-mono text-[12px] text-[#1c221d]">{children}</code>,
          pre: ({ children }) => <pre className="mb-3 overflow-x-auto rounded-[10px] bg-[rgba(244,240,230,0.9)] p-3 font-mono text-[12px] leading-[1.6] text-[#1c221d]">{children}</pre>,
          blockquote: ({ children }) => <blockquote className="mb-3 border-l-2 border-[rgba(29,122,95,0.35)] pl-3 text-[#5e6860] italic">{children}</blockquote>,
          hr: () => <hr className="my-4 border-[rgba(28,34,29,0.08)]" />,
          a: ({ children, href }) => <a href={href} className="text-[#1d7a5f] underline underline-offset-2" target="_blank" rel="noopener noreferrer">{children}</a>,
          table: ({ children }) => <div className="mb-3 overflow-x-auto"><table className="w-full border-collapse text-[12px]">{children}</table></div>,
          th: ({ children }) => <th className="border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.7)] px-3 py-2 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-[rgba(28,34,29,0.1)] px-3 py-2">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
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

function getPrimarySourceRowId(opportunity: WorkbenchOpportunity): string | null {
  const rows = opportunity.sourceKeywordRows ?? [];
  if (rows.length === 0) {
    return null;
  }

  const normalizedMainKeyword = opportunity.mainKeyword.trim().toLowerCase();
  const exactMatch = rows.find(
    (row) => row.mainKeyword.trim().toLowerCase() === normalizedMainKeyword
  );

  return (exactMatch ?? rows[0])?.notionPageId || null;
}

function ToolbarDropdown({
  label,
  active,
  open,
  onToggle,
  children,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          getToolbarControlClassName(active),
          open &&
            "ring-2 ring-[rgba(28,34,29,0.9)] ring-offset-2 ring-offset-[rgba(255,252,244,0.82)]"
        )}
      >
        <span>{label}</span>
        <ChevronDown className={cn("size-3.5", active ? "text-[#1d7a5f]" : "text-[#5e6860]")} />
      </button>
      {open ? (
        <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-[16px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.98)] p-2 shadow-[0_16px_40px_rgba(44,38,22,0.14)]">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function ToolbarOptionButton({
  selected,
  label,
  onClick,
}: {
  selected: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-[10px] px-3 py-2 text-left text-[13px] transition-colors",
        selected
          ? "bg-[rgba(29,122,95,0.08)] text-[#1c221d]"
          : "hover:bg-[rgba(29,122,95,0.06)] text-[#1c221d]"
      )}
    >
      <span
        className={cn(
          "inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border text-[8px] font-bold transition-colors",
          selected
            ? "border-[#1d7a5f] bg-[#1d7a5f] text-white"
            : "border-[rgba(28,34,29,0.16)] bg-[rgba(255,255,255,0.85)] text-transparent"
        )}
      >
        ✓
      </span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function SelectionCheckbox({
  checked,
  indeterminate = false,
  onChange,
  onClick,
  ariaLabel,
}: {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  onClick?: (event: React.MouseEvent<HTMLInputElement>) => void;
  ariaLabel: string;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <label className="inline-flex cursor-pointer items-center justify-center">
      <input
        ref={inputRef}
        type="checkbox"
        checked={checked}
        aria-label={ariaLabel}
        onChange={onChange}
        onClick={onClick}
        className="peer sr-only"
      />
      <span
        className={cn(
          "inline-flex size-[18px] items-center justify-center rounded-[6px] border border-[rgba(28,34,29,0.16)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,242,232,0.92)_100%)] text-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_1px_3px_rgba(44,38,22,0.08)] transition-all peer-focus-visible:ring-2 peer-focus-visible:ring-[rgba(29,122,95,0.18)] peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-[rgba(255,252,244,0.9)] peer-hover:border-[rgba(29,122,95,0.32)]",
          (checked || indeterminate) &&
            "border-[#1d7a5f] bg-[linear-gradient(180deg,#2a9070_0%,#1d7a5f_100%)] text-white shadow-[0_8px_18px_rgba(29,122,95,0.22)]"
        )}
      >
        {indeterminate ? (
          <Minus className="size-3" strokeWidth={3} aria-hidden />
        ) : checked ? (
          <Check className="size-3" strokeWidth={3} aria-hidden />
        ) : null}
      </span>
    </label>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function WorkspaceV3({
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
  const [clusterFilter, setClusterFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [hiddenColumns, setHiddenColumns] = useState<Set<ColumnId>>(new Set());
  const [openMenu, setOpenMenu] = useState<null | "type" | "priority" | "columns">(
    null
  );

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
    const q = searchQuery.toLowerCase();
    return eligibleOpportunities
      .filter((o) => activeTab === "all" || getStatusTab(o) === activeTab)
      .filter((o) => typeFilter === "all" || o.resolvedContentType === typeFilter)
      .filter((o) => clusterFilter === "all" || o.topicClusterName === clusterFilter)
      .filter((o) => priorityFilter === "all" || priorityBand(o) === priorityFilter)
      .filter(
        (o) =>
          !q ||
          o.mainKeyword.toLowerCase().includes(q) ||
          (o.topicClusterName ?? "").toLowerCase().includes(q)
      )
      .sort((a, b) => b.opportunityScore - a.opportunityScore);
  }, [eligibleOpportunities, activeTab, typeFilter, clusterFilter, priorityFilter, searchQuery]);

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
  const visibleColumnIds = useMemo(
    () => visibleColumns.map((col) => col.id),
    [visibleColumns]
  );
  const activeTypeLabel = typeFilter === "all" ? "全部类型" : typeFilter;
  const activePriorityLabel =
    priorityFilter === "all"
      ? "全部优先级"
      : priorityFilter === "high"
        ? "高优先"
        : priorityFilter === "medium"
          ? "中优先"
          : "低优先";

  // Reset page + selection when filters change
  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [activeTab, typeFilter, clusterFilter, priorityFilter, searchQuery]);

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
          <header className="rounded-[26px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.72)] px-[22px] shadow-[0_20px_52px_rgba(44,38,22,0.12)] backdrop-blur-[18px]">

            {/* Top row: brand + nav + user */}
            <div className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <div className="flex size-[32px] shrink-0 items-center justify-center rounded-[10px] bg-[#1d7a5f] text-[14px] font-bold text-white">
                  S
                </div>
                <div>
                  <h1 className="text-[14px] font-semibold leading-tight">SEO 内容生产工作台</h1>
                  <p className="text-[11px] text-[#5e6860]">
                    {eligibleOpportunities.length > 0 ? `共 ${eligibleOpportunities.length} 条` : "加载中…"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
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

            {/* Bottom row: status tabs */}
            <div className="border-t border-[rgba(28,34,29,0.07)] pb-3 pt-2">
              <nav
                aria-label="生产状态"
                className="flex flex-wrap gap-1"
              >
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => setActiveTab(tab)}
                    className={cn(
                      "inline-flex items-center gap-[5px] rounded-full px-3 py-[5px] text-[12px] font-medium transition-all",
                      activeTab === tab
                        ? "bg-[rgba(28,34,29,0.08)] text-[#1c221d] shadow-[0_1px_4px_rgba(28,34,29,0.08)]"
                        : "text-[#5e6860] hover:bg-[rgba(28,34,29,0.05)] hover:text-[#1c221d]"
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
            <ToolbarDropdown
              label={activeTypeLabel}
              active={typeFilter !== "all"}
              open={openMenu === "type"}
              onToggle={() =>
                setOpenMenu((current) => (current === "type" ? null : "type"))
              }
            >
              <ToolbarOptionButton
                selected={typeFilter === "all"}
                label="全部类型"
                onClick={() => {
                  setTypeFilter("all");
                  setOpenMenu(null);
                }}
              />
              {typeOptions.map((type) => (
                <ToolbarOptionButton
                  key={type}
                  selected={typeFilter === type}
                  label={type}
                  onClick={() => {
                    setTypeFilter(type);
                    setOpenMenu(null);
                  }}
                />
              ))}
            </ToolbarDropdown>

            {/* Active cluster pill */}
            {clusterFilter !== "all" && (
              <div className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(179,131,24,0.3)] bg-[rgba(179,131,24,0.1)] pl-3 pr-2 py-1 text-[12px] font-medium text-[#b38318]">
                <span className="max-w-[160px] truncate">{clusterFilter}</span>
                <button
                  type="button"
                  onClick={() => setClusterFilter("all")}
                  className="rounded-full p-0.5 hover:bg-[rgba(179,131,24,0.2)]"
                >
                  <X className="size-3" />
                </button>
              </div>
            )}

            {/* Priority filter */}
            <ToolbarDropdown
              label={activePriorityLabel}
              active={priorityFilter !== "all"}
              open={openMenu === "priority"}
              onToggle={() =>
                setOpenMenu((current) =>
                  current === "priority" ? null : "priority"
                )
              }
            >
              <ToolbarOptionButton
                selected={priorityFilter === "all"}
                label="全部优先级"
                onClick={() => {
                  setPriorityFilter("all");
                  setOpenMenu(null);
                }}
              />
              <ToolbarOptionButton
                selected={priorityFilter === "high"}
                label="高优先"
                onClick={() => {
                  setPriorityFilter("high");
                  setOpenMenu(null);
                }}
              />
              <ToolbarOptionButton
                selected={priorityFilter === "medium"}
                label="中优先"
                onClick={() => {
                  setPriorityFilter("medium");
                  setOpenMenu(null);
                }}
              />
              <ToolbarOptionButton
                selected={priorityFilter === "low"}
                label="低优先"
                onClick={() => {
                  setPriorityFilter("low");
                  setOpenMenu(null);
                }}
              />
            </ToolbarDropdown>

            {/* Column visibility */}
            <div className="relative">
              <button
                type="button"
                onClick={() =>
                  setOpenMenu((current) => (current === "columns" ? null : "columns"))
                }
                className={cn(
                  "inline-flex h-9 items-center gap-[6px] rounded-full border px-4 text-[13px] font-medium shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] transition-all",
                  hiddenColumns.size > 0
                    ? "border-[rgba(29,122,95,0.28)] bg-[linear-gradient(180deg,rgba(236,248,243,0.96)_0%,rgba(228,243,237,0.9)_100%)] text-[#1d7a5f] shadow-[0_8px_18px_rgba(29,122,95,0.08)]"
                    : "border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.8)] text-[#5e6860] hover:border-[rgba(29,122,95,0.24)] hover:text-[#1c221d]",
                  openMenu === "columns" &&
                    "ring-2 ring-[rgba(28,34,29,0.9)] ring-offset-2 ring-offset-[rgba(255,252,244,0.82)]"
                )}
              >
                <span>显示列</span>
                {hiddenColumns.size > 0 && (
                  <span className="rounded-full bg-[rgba(29,122,95,0.12)] px-[6px] py-[1px] text-[10px] font-semibold text-[#1d7a5f]">
                    隐藏 {hiddenColumns.size}
                  </span>
                )}
                <ChevronDown className="size-3.5" />
              </button>
              {openMenu === "columns" && (
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
              {filteredOpportunities.length !== eligibleOpportunities.length
                ? `${filteredOpportunities.length} / ${eligibleOpportunities.length} 条`
                : `共 ${filteredOpportunities.length} 条`}
            </span>
          </div>

          {/* Bulk action bar */}
          <div
            className={cn(
              "min-h-[46px] border-b px-5 py-2.5 transition-colors",
              selectedIds.size > 0
                ? "border-[rgba(29,122,95,0.15)] bg-[rgba(29,122,95,0.06)]"
                : "border-transparent bg-transparent"
            )}
          >
            {selectedIds.size === 0 ? (
              <div className="flex min-h-[26px] items-center text-[13px] text-[#6b746d]">
                可多选关键词后批量执行任务，建议单次选择不超过 5 条。
              </div>
            ) : (
              <div className="flex items-center gap-3">
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
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b border-[rgba(28,34,29,0.08)] bg-[rgba(244,240,230,0.5)]">
                  <th className="w-10 px-4 py-3">
                    <SelectionCheckbox
                      checked={allPageSelected}
                      indeterminate={somePageSelected && !allPageSelected}
                      onChange={toggleAll}
                      ariaLabel="全选当前页机会"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5e6860]">
                    主关键词
                  </th>
                  {visibleColumns.map((col) => (
                    <th
                      key={col.id}
                      className={cn(
                        "whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5e6860]",
                        getPinnedColumnOffset(col.id, visibleColumnIds) !== null &&
                          cn(
                            "sticky bg-[rgba(244,240,230,0.92)] shadow-[-10px_0_18px_-14px_rgba(44,38,22,0.28)]",
                            getPinnedColumnZIndexClass(col.id)
                          )
                      )}
                      style={
                        getPinnedColumnOffset(col.id, visibleColumnIds) !== null
                          ? {
                              right: `${getPinnedColumnOffset(col.id, visibleColumnIds)}px`,
                              width: `${getPinnedColumnWidth(col.id)}px`,
                              minWidth: `${getPinnedColumnWidth(col.id)}px`,
                            }
                          : undefined
                      }
                    >
                      {col.label}
                    </th>
                  ))}
                  <th
                    className={cn(
                      "sticky px-4 py-3 bg-[rgba(244,240,230,0.92)] shadow-[-10px_0_18px_-14px_rgba(44,38,22,0.28)]",
                      getPinnedColumnZIndexClass("action")
                    )}
                    style={{
                      right: 0,
                      width: `${ACTION_COLUMN_WIDTH}px`,
                      minWidth: `${ACTION_COLUMN_WIDTH}px`,
                    }}
                  />
                </tr>
              </thead>
              <tbody>
                {paginatedOpportunities.length === 0 ? (
                  <tr>
                    <td
                      colSpan={visibleColumns.length + 3}
                      className="py-20 text-center text-[13px] text-[#5e6860]"
                    >
                      {searchQuery || typeFilter !== "all" || clusterFilter !== "all" || priorityFilter !== "all"
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
                      visibleColumnIds={visibleColumnIds}
                      onToggleSelect={() => toggleRow(opp.groupId)}
                      onOpenDetail={() =>
                        setDetailId(
                          opp.groupId === detailId ? null : opp.groupId
                        )
                      }
                      onFilterCluster={setClusterFilter}
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
      {openMenu !== null && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenu(null)}
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
  onFilterCluster,
}: {
  opportunity: WorkbenchOpportunity;
  selected: boolean;
  active: boolean;
  pendingBrief: boolean;
  visibleColumnIds: ColumnId[];
  onToggleSelect: () => void;
  onOpenDetail: () => void;
  onFilterCluster: (cluster: string) => void;
}) {
  const band = priorityBand(opp);
  const statusTab = getStatusTab(opp);
  const stickySurfaceClass = getPinnedCellSurfaceClass(selected, active);

  return (
    <tr
      className={cn(
        "group border-b border-[rgba(28,34,29,0.06)] transition-colors",
        selected && "bg-[rgba(29,122,95,0.05)]",
        active && !selected && "bg-[rgba(29,122,95,0.09)]",
        !selected && !active && "hover:bg-[rgba(255,255,255,0.55)]"
      )}
    >
      {/* Checkbox */}
      <td className="w-10 px-4 py-3">
        <SelectionCheckbox
          checked={selected}
          onChange={onToggleSelect}
          onClick={(e) => e.stopPropagation()}
          ariaLabel={`选择关键词 ${opp.mainKeyword}`}
        />
      </td>

      {/* Main keyword + cluster tag */}
      <td className="min-w-[220px] px-4 py-3">
        <div className="text-left">
          <button
            type="button"
            onClick={onOpenDetail}
            className="text-left"
          >
            <div className="text-[14px] font-medium leading-[1.35] text-[#1c221d] underline cursor-pointer decoration-[rgba(29,122,95,0.4)]">
              {opp.mainKeyword}
            </div>
          </button>
        </div>
      </td>

      {/* Dynamic columns */}
      {visibleColumnIds.map((colId) => {
        const pinnedOffset = getPinnedColumnOffset(colId, visibleColumnIds);

        return (
        <td
          key={colId}
          className={cn(
            "whitespace-nowrap px-4 py-3 text-[13px]",
            pinnedOffset !== null &&
              cn(
                "sticky shadow-[-10px_0_18px_-14px_rgba(44,38,22,0.22)]",
                getPinnedColumnZIndexClass(colId),
                stickySurfaceClass
              )
          )}
          style={
            pinnedOffset !== null
              ? {
                  right: `${pinnedOffset}px`,
                  width: `${getPinnedColumnWidth(colId)}px`,
                  minWidth: `${getPinnedColumnWidth(colId)}px`,
                }
              : undefined
          }
        >
          {colId === "cluster" && (
            opp.topicClusterName ? (
              <button
                type="button"
                onClick={() => onFilterCluster(opp.topicClusterName!)}
                title="按此话题群筛选"
                className="rounded-full bg-[rgba(179,131,24,0.12)] px-[9px] py-1 text-[11px] font-medium text-[#b38318] transition-colors hover:bg-[rgba(179,131,24,0.22)]"
              >
                {opp.topicClusterName}
              </button>
            ) : (
              <span className="text-[#5e6860]">—</span>
            )
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
        </td>
        );
      })}

      {/* Action / loading */}
      <td
        className={cn(
          "sticky px-4 py-3 shadow-[-10px_0_18px_-14px_rgba(44,38,22,0.22)]",
          getPinnedColumnZIndexClass("action"),
          stickySurfaceClass
        )}
        style={{
          right: 0,
          width: `${ACTION_COLUMN_WIDTH}px`,
          minWidth: `${ACTION_COLUMN_WIDTH}px`,
        }}
      >
        {pendingBrief ? (
          <LoaderCircle className="size-4 animate-spin text-[#1d7a5f]" aria-hidden />
        ) : (
          <button
            type="button"
            onClick={onOpenDetail}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-1 text-[11px] transition-colors",
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
  const [panelExpanded, setPanelExpanded] = useState(true);
  const [briefExpanded, setBriefExpanded] = useState(true);
  const [draftExpanded, setDraftExpanded] = useState(true);
  const [briefPreview, setBriefPreview] = useState(
    Boolean(opportunity.briefMarkdown?.trim())
  );
  const [draftPreview, setDraftPreview] = useState(
    Boolean(opportunity.articleDraftMarkdown?.trim())
  );
  const [briefMarkdown, setBriefMarkdown] = useState(opportunity.briefMarkdown ?? "");
  const [articleDraftMarkdown, setArticleDraftMarkdown] = useState(
    opportunity.articleDraftMarkdown ?? ""
  );

  useEffect(() => {
    setBriefMarkdown(opportunity.briefMarkdown ?? "");
    setBriefPreview(Boolean(opportunity.briefMarkdown?.trim()));
  }, [opportunity.groupId, opportunity.briefMarkdown]);

  useEffect(() => {
    setArticleDraftMarkdown(opportunity.articleDraftMarkdown ?? "");
    setDraftPreview(Boolean(opportunity.articleDraftMarkdown?.trim()));
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
      const selectedRowId = getPrimarySourceRowId(opportunity);

      if (!supabaseMode) {
        const generated = buildBriefV2Markdown(withWhyNow);
        onPatch({
          pipelineStatus: nextWorkflow.pipelineStatus,
          productionStage: nextWorkflow.productionStage,
          whyNow: withWhyNow.whyNow,
          briefMarkdown: generated,
        });
        setBriefMarkdown(generated);
        setBriefPreview(true);
        onNotify({ tone: "success", text: "Brief 已生成。" });
        return;
      }

      setBriefExpanded(true);
      setBriefPreview(true);
      setBriefMarkdown("");

      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            kind: "brief",
            stream: true,
            selectedKeywordIds: selectedRowId ? [selectedRowId] : [],
          }),
        }
      );

      const data = await readStreamedGenerateResponse(response, (delta) => {
        setBriefMarkdown((current) => current + delta);
      });

      if (typeof data.markdown === "string") {
        onPatch({
          pipelineStatus: data.pipelineStatus ?? nextWorkflow.pipelineStatus,
          productionStage: data.productionStage ?? nextWorkflow.productionStage,
          whyNow:
            typeof data.whyNow === "string" ? data.whyNow : withWhyNow.whyNow,
          briefMarkdown: data.markdown,
        });
        setBriefMarkdown(data.markdown);
        setBriefPreview(true);
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
        setDraftPreview(true);
        onNotify({ tone: "success", text: "初稿已生成。" });
        return;
      }

      setDraftExpanded(true);
      setDraftPreview(true);
      setArticleDraftMarkdown("");

      const response = await fetch(
        `/api/opportunities/${encodeURIComponent(opportunity.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "draft", stream: true }),
        }
      );

      const data = await readStreamedGenerateResponse(response, (delta) => {
        setArticleDraftMarkdown((current) => current + delta);
      });

      if (typeof data.markdown === "string") {
        onPatch({
          pipelineStatus: data.pipelineStatus ?? nextWorkflow.pipelineStatus,
          productionStage: data.productionStage ?? nextWorkflow.productionStage,
          articleDraftMarkdown: data.markdown,
        });
        setArticleDraftMarkdown(data.markdown);
        setDraftPreview(true);
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
  const hasBriefMarkdown = briefMarkdown.trim().length > 0;
  const hasDraftMarkdown = articleDraftMarkdown.trim().length > 0;
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
      <div className={cn(
        "fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-[rgba(255,252,244,0.98)] shadow-[0_0_60px_rgba(28,34,29,0.18)] ring-1 ring-[rgba(28,34,29,0.08)] transition-all duration-200",
        panelExpanded ? "max-w-[1200px]" : "max-w-[560px]"
      )}>

        {/* Panel header */}
        <div className="flex items-start justify-between gap-3 border-b border-[rgba(28,34,29,0.1)] px-5 py-4">
          <div className="min-w-0">
            <div className="text-[10px] font-medium uppercase tracking-[0.12em] text-[#5e6860]">
              生产审核
            </div>
            <h2 className="mt-1 text-[20px] font-bold leading-[1.2] text-[#1c221d]">
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
          <div className="flex shrink-0 items-center gap-1">
            <a
              href={`/brief-records?id=${encodeURIComponent(opportunity.groupId)}`}
              title="在资产库中查看"
              className="inline-flex items-center gap-1 rounded-full border border-[rgba(28,34,29,0.1)] px-3 py-1.5 text-[11px] font-medium text-[#5e6860] hover:border-[rgba(29,122,95,0.25)] hover:text-[#1d7a5f]"
            >
              资产库
            </a>
            <button
              type="button"
              onClick={() => setPanelExpanded((v) => !v)}
              title={panelExpanded ? "收起" : "展开"}
              className="rounded-full p-2 text-[#5e6860] hover:bg-[rgba(28,34,29,0.06)] hover:text-[#1c221d]"
            >
              {panelExpanded ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full p-2 text-[#5e6860] hover:bg-[rgba(28,34,29,0.06)] hover:text-[#1c221d]"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Panel body */}
        <div className={cn(
          "flex-1 overflow-y-auto",
          panelExpanded
            ? "grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] divide-x divide-[rgba(28,34,29,0.08)]"
            : "space-y-5 px-5 py-5"
        )}>

          {/* Left column: decision meta */}
          <div className={cn(panelExpanded ? "space-y-5 overflow-y-auto px-5 py-5" : "contents")}>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2">
              <MiniStat label="搜索量" value={formatNumber(opportunity.volume)} />
              <MiniStat label="难度 KD" value={String(opportunity.kd)} />
              <MiniStat label="评分" value={String(opportunity.opportunityScore)} />
            </div>

            <div className="rounded-[18px] border border-[rgba(29,122,95,0.12)] bg-[rgba(29,122,95,0.06)] px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <PanelSectionLabel>当前状态</PanelSectionLabel>
                  <div className="mt-2 flex items-center gap-2">
                    <StatusBadge tab={workflowStatus} />
                    <span className="text-[12px] text-[#5e6860]">
                      {getWorkflowStatusLabel(workflowStatus)}
                    </span>
                  </div>
                </div>
                <div className="rounded-full bg-[rgba(255,255,255,0.7)] px-3 py-1 text-[11px] font-medium text-[#1d7a5f]">
                  下一步：{primaryActionLabel ?? "人工处理"}
                </div>
              </div>
              <p className="mt-3 text-[13px] leading-[1.75] text-[#1c221d]">
                {getWorkflowDescription(workflowStatus)}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[16px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.55)] px-4 py-4">
                <PanelSectionLabel>页面定位</PanelSectionLabel>
                <div className="mt-3 flex flex-wrap gap-[6px]">
                  {opportunity.intent && <TagPill color="intent" value={opportunity.intent} />}
                  {opportunity.resolvedContentType && (
                    <TagPill color="type" value={opportunity.resolvedContentType} />
                  )}
                  {opportunity.internalLinkRole && (
                    <TagPill color="role" value={opportunity.internalLinkRole} />
                  )}
                </div>
                <ul className="mt-3 space-y-1 text-[12px] leading-[1.7] text-[#5e6860]">
                  <li>主关键词：{opportunity.mainKeyword}</li>
                  <li>话题群：{opportunity.topicClusterName || "未分组"}</li>
                  <li>覆盖变体：{opportunity.variantCount} 个</li>
                </ul>
              </div>

              <div className="rounded-[16px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.55)] px-4 py-4">
                <PanelSectionLabel>为什么推荐</PanelSectionLabel>
                <p className="mt-3 text-[13px] leading-[1.75] text-[#1c221d]">
                  {whyNow}
                </p>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <PanelSectionLabel>内容策略 / 背景上下文</PanelSectionLabel>
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
                  {strategyBusy ? "分析中…" : "补充策略"}
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
                  如果这条机会的上下文还不够，可以点击「补充策略」自动分析 SERP，并补一版更完整的 page brief。
                </p>
              )}
            </div>

            <div className="rounded-[16px] border border-[rgba(179,131,24,0.18)] bg-[rgba(255,248,232,0.55)] px-4 py-4">
              <PanelSectionLabel>接下来会发生什么</PanelSectionLabel>
              <ol className="mt-3 space-y-2 pl-4 text-[13px] leading-[1.7] text-[#1c221d]">
                <li>先生成 Brief，确认页面结构、CTA 和必须覆盖的关键词。</li>
                <li>Brief 确认后，再生成初稿。</li>
                <li>初稿生成后，进入 QA 和导出。</li>
              </ol>
            </div>
          </div>

          {/* Right column: editors */}
          <div className={cn(panelExpanded ? "space-y-5 overflow-y-auto px-5 py-5" : "contents")}>
            <div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setBriefExpanded((v) => !v)}
                  className="inline-flex items-center gap-2 text-left"
                >
                  <PanelSectionLabel>Brief（可编辑）</PanelSectionLabel>
                  <ChevronDown
                    className={cn(
                      "size-4 text-[#5e6860] transition-transform",
                      briefExpanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div className="flex items-center gap-1">
                  {hasBriefMarkdown && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setBriefPreview((v) => !v);
                      }}
                      className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.75)] px-3 py-[5px] text-[11px] font-medium text-[#5e6860] hover:text-[#1c221d]"
                    >
                      {briefPreview ? "编辑" : "预览"}
                    </button>
                  )}
                  {hasBriefMarkdown && canEditGeneratedMarkdown && (
                    <button
                      type="button"
                      disabled={!briefDirty || saveBusy !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSave("brief");
                      }}
                      className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
                    >
                      {saveBusy === "brief" && (
                        <LoaderCircle className="size-3 animate-spin" aria-hidden />
                      )}
                      保存
                    </button>
                  )}
                </div>
              </div>

              {briefExpanded ? (
                hasBriefMarkdown ? (
                  briefPreview ? (
                    <div className="mt-2 min-h-[180px] rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3">
                      <MarkdownPreview content={briefMarkdown} />
                    </div>
                  ) : (
                    <textarea
                      value={briefMarkdown}
                      onChange={(event) => setBriefMarkdown(event.target.value)}
                      readOnly={!canEditGeneratedMarkdown}
                      className="mt-2 min-h-[180px] w-full rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3 font-mono text-[13px] leading-[1.75] text-[#1c221d] outline-none focus:border-[rgba(29,122,95,0.32)]"
                    />
                  )
                ) : (
                  <p className="mt-2 text-[12px] text-[#5e6860]">
                    这里会显示生成后的 brief。建议先改 brief，再进入初稿，避免后面返工。
                  </p>
                )
              ) : null}
            </div>

            <div>
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setDraftExpanded((v) => !v)}
                  className="inline-flex items-center gap-2 text-left"
                >
                  <PanelSectionLabel>初稿（可编辑）</PanelSectionLabel>
                  <ChevronDown
                    className={cn(
                      "size-4 text-[#5e6860] transition-transform",
                      draftExpanded ? "rotate-0" : "-rotate-90"
                    )}
                  />
                </button>
                <div className="flex items-center gap-1">
                  {hasDraftMarkdown && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        setDraftPreview((v) => !v);
                      }}
                      className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.75)] px-3 py-[5px] text-[11px] font-medium text-[#5e6860] hover:text-[#1c221d]"
                    >
                      {draftPreview ? "编辑" : "预览"}
                    </button>
                  )}
                  {hasDraftMarkdown && canEditGeneratedMarkdown && (
                    <button
                      type="button"
                      disabled={!draftDirty || saveBusy !== null}
                      onClick={(event) => {
                        event.stopPropagation();
                        void handleSave("draft");
                      }}
                      className="inline-flex items-center gap-[5px] rounded-full border border-[rgba(29,122,95,0.25)] bg-[rgba(29,122,95,0.07)] px-3 py-[5px] text-[11px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:opacity-50"
                    >
                      {saveBusy === "draft" && (
                        <LoaderCircle className="size-3 animate-spin" aria-hidden />
                      )}
                      保存
                    </button>
                  )}
                </div>
              </div>

              {draftExpanded ? (
                hasDraftMarkdown ? (
                  draftPreview ? (
                    <div className="mt-2 min-h-[220px] rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3">
                      <MarkdownPreview content={articleDraftMarkdown} />
                    </div>
                  ) : (
                    <textarea
                      value={articleDraftMarkdown}
                      onChange={(event) => setArticleDraftMarkdown(event.target.value)}
                      readOnly={!canEditGeneratedMarkdown}
                      className="mt-2 min-h-[220px] w-full rounded-[14px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.62)] px-4 py-3 font-mono text-[13px] leading-[1.75] text-[#1c221d] outline-none focus:border-[rgba(29,122,95,0.32)]"
                    />
                  )
                ) : (
                  <p className="mt-2 text-[12px] text-[#5e6860]">
                    只有 Brief 确认后才建议生成初稿。这样 SEO 和前端 review 时更容易判断问题出在 brief 还是 draft。
                  </p>
                )
              ) : null}
            </div>

            {isPublishedWorkflowStatus(workflowStatus) && (
              <div className="rounded-[14px] border border-[rgba(179,131,24,0.2)] bg-[rgba(255,248,232,0.7)] px-4 py-3 text-[12px] leading-[1.7] text-[#7b6324]">
                当前处于已发布状态，默认不再直接编辑 Brief 和初稿。
              </div>
            )}
          </div>
        </div>

        {/* Panel footer */}
        <div className="flex flex-wrap justify-center items-center gap-2 border-t border-[rgba(28,34,29,0.1)] px-5 py-4">
          {primaryActionHandler ? (
            <button
              type="button"
              disabled={actionBusy || !canWrite}
              onClick={() => void primaryActionHandler?.()}
              className="inline-flex items-center gap-2 rounded-full bg-[#1d7a5f] px-5 py-[10px] text-[13px] font-medium text-white transition-colors hover:bg-[#166b52] disabled:opacity-50"
            >
              {actionBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="size-4" aria-hidden />
              )}
              {primaryActionLabel}
            </button>
          ) : (
            <span className="text-[12px] text-[#5e6860]">当前没有下一步自动推进动作。</span>
          )}

          {hasDraftMarkdown && (
            <button
              type="button"
              onClick={handleDownloadDraft}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-4 py-[10px] text-[13px] font-medium text-[#1c221d] transition-colors hover:border-[rgba(29,122,95,0.24)] hover:text-[#1d7a5f]"
            >
              下载初稿
            </button>
          )}

          {(hasBriefMarkdown || hasDraftMarkdown) && (
            <button
              type="button"
              disabled={exportBusy || !canWrite}
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-4 py-[10px] text-[13px] font-medium text-[#1c221d] transition-colors hover:border-[rgba(29,122,95,0.24)] hover:text-[#1d7a5f] disabled:opacity-50"
            >
              {exportBusy ? (
                <LoaderCircle className="size-4 animate-spin" aria-hidden />
              ) : null}
              导出 Markdown
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
