"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronRight, FileText, LoaderCircle, PenLine, Save, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  canGenerateDraftFromStatus,
  canMarkPublishedFromStatus,
  canMarkReadyToUploadFromStatus,
  deriveWorkflowStatus,
  getWorkflowSnapshot,
  getWorkflowStatusLabel,
} from "@/lib/opportunity/workflow-status";
import type { WorkbenchOpportunity, WorkflowStatus } from "@/lib/types/opportunity";

const panelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";

function getStatusStyle(status: WorkflowStatus): string {
  switch (status) {
    case "pending":
      return "bg-[rgba(28,34,29,0.07)] text-[#5e6860] border border-[rgba(28,34,29,0.12)]";
    case "brief_done":
      return "bg-[rgba(29,122,95,0.1)] text-[#1d7a5f] border border-[rgba(29,122,95,0.2)]";
    case "draft_done":
      return "bg-[rgba(29,95,122,0.1)] text-[#1d5f7a] border border-[rgba(29,95,122,0.2)]";
    case "ready_to_upload":
      return "bg-[rgba(188,128,29,0.1)] text-[#8a5e10] border border-[rgba(188,128,29,0.2)]";
    case "published":
      return "bg-[rgba(100,29,188,0.1)] text-[#5b1d8a] border border-[rgba(100,29,188,0.2)]";
    default:
      return "bg-[rgba(28,34,29,0.07)] text-[#5e6860] border border-[rgba(28,34,29,0.12)]";
  }
}

function StatusBadge({ status }: { status: WorkflowStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-[9px] py-1 text-[11px] font-medium ${getStatusStyle(status)}`}
    >
      {getWorkflowStatusLabel(status)}
    </span>
  );
}

function MarkdownPreview({ content, className }: { content: string; className?: string }) {
  return (
    <div className={`text-[13px] leading-[1.75] text-[#1c221d] ${className ?? ""}`}>
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

export function AssetExplorer({
  opportunities,
  initialGroupId,
  canEdit,
}: {
  opportunities: WorkbenchOpportunity[];
  initialGroupId: string | null;
  canEdit: boolean;
}) {
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(
    initialGroupId ?? opportunities[0]?.groupId ?? null
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<"all" | "brief" | "draft">("all");
  const [assetTab, setAssetTab] = useState<"brief" | "draft">("brief");
  const [localBriefMarkdown, setLocalBriefMarkdown] = useState("");
  const [localDraftMarkdown, setLocalDraftMarkdown] = useState("");
  const [lastSavedBrief, setLastSavedBrief] = useState("");
  const [lastSavedDraft, setLastSavedDraft] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState(true);
  const [workflowBusy, setWorkflowBusy] = useState(false);
  const [localStatusOverrides, setLocalStatusOverrides] = useState<Record<string, WorkflowStatus>>({});

  const selected = useMemo(
    () => opportunities.find((o) => o.groupId === selectedGroupId) ?? null,
    [opportunities, selectedGroupId]
  );

  const effectiveStatus = useMemo((): WorkflowStatus => {
    if (!selected) return "pending";
    return localStatusOverrides[selected.groupId] ?? deriveWorkflowStatus(selected);
  }, [selected, localStatusOverrides]);

  const filteredItems = useMemo(() => {
    let items = opportunities;

    if (filterTab === "brief") {
      items = items.filter((o) => o.briefMarkdown?.trim());
    } else if (filterTab === "draft") {
      items = items.filter((o) => o.articleDraftMarkdown?.trim());
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      items = items.filter(
        (o) =>
          o.mainKeyword.toLowerCase().includes(q) ||
          o.topicClusterName.toLowerCase().includes(q)
      );
    }

    return items;
  }, [opportunities, filterTab, searchQuery]);

  const briefCount = useMemo(
    () => opportunities.filter((o) => o.briefMarkdown?.trim()).length,
    [opportunities]
  );

  const draftCount = useMemo(
    () => opportunities.filter((o) => o.articleDraftMarkdown?.trim()).length,
    [opportunities]
  );

  const hasUnsavedChanges =
    assetTab === "brief"
      ? localBriefMarkdown !== lastSavedBrief
      : localDraftMarkdown !== lastSavedDraft;

  // Reset local state when selection changes
  useEffect(() => {
    const brief = selected?.briefMarkdown ?? "";
    const draft = selected?.articleDraftMarkdown ?? "";
    setLocalBriefMarkdown(brief);
    setLocalDraftMarkdown(draft);
    setLastSavedBrief(brief);
    setLastSavedDraft(draft);
    setSaveState("idle");
    setSaveMessage(null);
    setPreviewMode(true);
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Reset preview mode when switching tabs
  useEffect(() => {
    setPreviewMode(true);
  }, [assetTab]);

  // Auto-select asset tab based on content
  useEffect(() => {
    if (!selected) return;
    const hasBrief = !!selected.briefMarkdown?.trim();
    const hasDraft = !!selected.articleDraftMarkdown?.trim();
    if (!hasBrief && hasDraft) {
      setAssetTab("draft");
    } else {
      setAssetTab("brief");
    }
  }, [selectedGroupId]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleSelect(groupId: string) {
    if (hasUnsavedChanges) {
      const ok = window.confirm("当前内容有未保存的修改。确定切换到另一条记录吗？");
      if (!ok) return;
    }
    setSelectedGroupId(groupId);
    window.history.replaceState(
      window.history.state,
      "",
      `/brief-records?id=${encodeURIComponent(groupId)}`
    );
  }

  async function handleSave() {
    if (!selected || !canEdit) return;

    setSaveState("saving");
    setSaveMessage(null);

    const body =
      assetTab === "brief"
        ? { briefMarkdown: localBriefMarkdown }
        : { articleDraftMarkdown: localDraftMarkdown };

    try {
      const res = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.groupId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const payload = (await res.json()) as {
        ok?: boolean;
        groupId?: string;
        workflowStatus?: WorkflowStatus;
        error?: string;
      };

      if (!res.ok || !payload.ok) {
        throw new Error(payload.error ?? "保存失败。");
      }

      if (assetTab === "brief") {
        setLastSavedBrief(localBriefMarkdown);
      } else {
        setLastSavedDraft(localDraftMarkdown);
      }

      setSaveState("saved");
      setSaveMessage("已保存。");
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "保存时发生错误。");
    }
  }

  async function handleGenerateDraft() {
    if (!selected || !canEdit) return;
    setWorkflowBusy(true);
    setSaveMessage(null);
    try {
      const res = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.groupId)}/generate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ kind: "draft" }),
        }
      );
      const data = (await res.json().catch(() => ({}))) as { markdown?: string; error?: string };
      if (!res.ok) throw new Error(data.error ?? "生成初稿失败");
      if (typeof data.markdown === "string") {
        const snapshot = getWorkflowSnapshot("draft_done");
        setLocalDraftMarkdown(data.markdown);
        setLastSavedDraft(data.markdown);
        setLocalStatusOverrides((cur) => ({ ...cur, [selected.groupId]: "draft_done" }));
        setAssetTab("draft");
        // persist workflow state
        await fetch(`/api/opportunities/${encodeURIComponent(selected.groupId)}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pipelineStatus: snapshot.pipelineStatus,
            productionStage: snapshot.productionStage,
          }),
        });
      }
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "生成初稿失败");
    } finally {
      setWorkflowBusy(false);
    }
  }

  async function handleAdvanceStatus(targetStatus: WorkflowStatus) {
    if (!selected || !canEdit) return;
    setWorkflowBusy(true);
    const snapshot = getWorkflowSnapshot(targetStatus);
    try {
      const res = await fetch(
        `/api/opportunities/${encodeURIComponent(selected.groupId)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            pipelineStatus: snapshot.pipelineStatus,
            productionStage: snapshot.productionStage,
          }),
        }
      );
      const payload = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !payload.ok) throw new Error(payload.error ?? "操作失败");
      setLocalStatusOverrides((cur) => ({ ...cur, [selected.groupId]: targetStatus }));
    } catch (err) {
      setSaveState("error");
      setSaveMessage(err instanceof Error ? err.message : "操作失败");
    } finally {
      setWorkflowBusy(false);
    }
  }

  function handleReset() {
    if (assetTab === "brief") {
      setLocalBriefMarkdown(lastSavedBrief);
    } else {
      setLocalDraftMarkdown(lastSavedDraft);
    }
  }

  const currentText = assetTab === "brief" ? localBriefMarkdown : localDraftMarkdown;
  const setCurrentText = assetTab === "brief" ? setLocalBriefMarkdown : setLocalDraftMarkdown;

  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      {/* Left panel */}
      <aside className={panelClass}>
        {/* Search + filter */}
        <div className="border-b border-[rgba(28,34,29,0.1)] px-[18px] py-4 space-y-3">
          <div className="flex items-center gap-2 rounded-[16px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] px-3 py-2">
            <Search className="size-4 shrink-0 text-[#5e6860]" aria-hidden />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="搜索关键词或 cluster"
              className="w-full bg-transparent text-[13px] text-[#1c221d] outline-none placeholder:text-[#8b938d]"
            />
          </div>

          {/* Filter tabs */}
          <div className="flex gap-2">
            {(
              [
                { key: "all", label: `全部 ${opportunities.length}` },
                { key: "brief", label: `大纲 ${briefCount}` },
                { key: "draft", label: `初稿 ${draftCount}` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setFilterTab(tab.key)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  filterTab === tab.key
                    ? "border-[rgba(29,122,95,0.3)] bg-[rgba(29,122,95,0.1)] text-[#1d7a5f]"
                    : "border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] text-[#5e6860] hover:border-[rgba(29,122,95,0.2)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="max-h-[680px] overflow-y-auto p-3 space-y-2">
          {filteredItems.length === 0 ? (
            <div className="rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.58)] px-4 py-4 text-[13px] text-[#5e6860]">
              {searchQuery ? "没有匹配的内容。" : "暂无内容。"}
            </div>
          ) : (
            filteredItems.map((opp) => {
              const status = localStatusOverrides[opp.groupId] ?? deriveWorkflowStatus(opp);
              const isActive = opp.groupId === selectedGroupId;
              const hasBrief = !!opp.briefMarkdown?.trim();
              const hasDraft = !!opp.articleDraftMarkdown?.trim();

              return (
                <button
                  key={opp.groupId}
                  type="button"
                  onClick={() => handleSelect(opp.groupId)}
                  className={`block w-full rounded-[18px] border p-4 text-left transition-all ${
                    isActive
                      ? "border-[rgba(29,122,95,0.42)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(236,248,243,0.98)_100%)] shadow-[0_16px_34px_rgba(29,122,95,0.14)] ring-1 ring-[rgba(29,122,95,0.18)]"
                      : "border-[rgba(28,34,29,0.1)] bg-[rgba(255,253,248,1)] hover:border-[rgba(29,122,95,0.24)] hover:shadow-[0_12px_24px_rgba(29,122,95,0.08)]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-[14px] font-semibold leading-[1.3] text-[#1c221d]">
                        {opp.mainKeyword}
                      </div>
                      <div className="mt-0.5 truncate text-[12px] text-[#5e6860]">
                        {opp.topicClusterName}
                      </div>
                    </div>
                    <StatusBadge status={status} />
                  </div>

                  <div className="mt-2 flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[11px] text-[#5e6860]">
                      <span
                        className={`inline-block size-[7px] rounded-full ${hasBrief ? "bg-[#1d7a5f]" : "bg-[#c8cec9]"}`}
                      />
                      大纲
                    </span>
                    <span className="flex items-center gap-1 text-[11px] text-[#5e6860]">
                      <span
                        className={`inline-block size-[7px] rounded-full ${hasDraft ? "bg-[#1d7a5f]" : "bg-[#c8cec9]"}`}
                      />
                      初稿
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* Right panel */}
      <section className={panelClass}>
        {!selected ? (
          <div className="flex h-full min-h-[400px] items-center justify-center text-[14px] text-[#5e6860]">
            从左侧选择一条内容查看详情。
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="border-b border-[rgba(28,34,29,0.1)] px-[22px] py-5">
              <div className="text-[22px] font-bold text-[#1c221d]">
                {selected.mainKeyword}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-[9px] py-1 text-[11px] font-medium text-[#1c221d]">
                  {selected.topicClusterName}
                </span>
                {selected.resolvedContentType && (
                  <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-[9px] py-1 text-[11px] font-medium text-[#1c221d]">
                    {selected.resolvedContentType}
                  </span>
                )}
                {selected.intent && (
                  <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-[9px] py-1 text-[11px] font-medium text-[#1c221d]">
                    {selected.intent}
                  </span>
                )}
                <StatusBadge status={effectiveStatus} />
                {canGenerateDraftFromStatus(effectiveStatus) && (
                  <button
                    type="button"
                    disabled={workflowBusy}
                    onClick={handleGenerateDraft}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(29,95,122,0.3)] bg-[rgba(29,95,122,0.08)] px-3 py-1 text-[11px] font-medium text-[#1d5f7a] transition-colors hover:bg-[rgba(29,95,122,0.16)] disabled:opacity-50"
                  >
                    {workflowBusy ? <LoaderCircle className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                    生成初稿
                  </button>
                )}
                {canMarkReadyToUploadFromStatus(effectiveStatus) && (
                  <button
                    type="button"
                    disabled={workflowBusy}
                    onClick={() => handleAdvanceStatus("ready_to_upload")}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(188,128,29,0.3)] bg-[rgba(188,128,29,0.08)] px-3 py-1 text-[11px] font-medium text-[#8a5e10] transition-colors hover:bg-[rgba(188,128,29,0.16)] disabled:opacity-50"
                  >
                    {workflowBusy ? <LoaderCircle className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                    进入待上传
                  </button>
                )}
                {canMarkPublishedFromStatus(effectiveStatus) && (
                  <button
                    type="button"
                    disabled={workflowBusy}
                    onClick={() => handleAdvanceStatus("published")}
                    className="inline-flex items-center gap-1 rounded-full border border-[rgba(100,29,188,0.25)] bg-[rgba(100,29,188,0.07)] px-3 py-1 text-[11px] font-medium text-[#5b1d8a] transition-colors hover:bg-[rgba(100,29,188,0.14)] disabled:opacity-50"
                  >
                    {workflowBusy ? <LoaderCircle className="size-3 animate-spin" /> : <ChevronRight className="size-3" />}
                    标记为已发布
                  </button>
                )}
              </div>
              <div className="mt-3">
                <a
                  href={`/workbench`}
                  className="inline-flex items-center gap-1 text-[11px] text-[#5e6860] hover:text-[#1d7a5f]"
                >
                  ← 返回工作台
                </a>
              </div>
            </div>

            {/* Tab bar */}
            <div className="flex border-b border-[rgba(28,34,29,0.1)]">
              {(
                [
                  {
                    key: "brief" as const,
                    label: "文章大纲",
                    Icon: FileText,
                    hasContent: !!selected.briefMarkdown?.trim(),
                  },
                  {
                    key: "draft" as const,
                    label: "文章初稿",
                    Icon: PenLine,
                    hasContent: !!selected.articleDraftMarkdown?.trim(),
                  },
                ]
              ).map(({ key, label, Icon, hasContent }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAssetTab(key)}
                  className={`flex items-center gap-2 border-b-2 px-5 py-[14px] text-[13px] font-medium transition-colors ${
                    assetTab === key
                      ? "border-[#1d7a5f] text-[#1d7a5f]"
                      : "border-transparent text-[#5e6860] hover:text-[#1c221d]"
                  }`}
                >
                  <Icon className="size-[15px]" aria-hidden />
                  {label}
                  <span
                    className={`inline-block size-[7px] rounded-full ${hasContent ? "bg-[#1d7a5f]" : "bg-[#c8cec9]"}`}
                  />
                </button>
              ))}
            </div>

            {/* Editor area */}
            <div className="px-[22px] py-5">
              {/* Toolbar row */}
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-[13px]">
                  <span className="font-medium text-[#1c221d]">
                    {assetTab === "brief" ? "文章大纲" : "文章初稿"}
                  </span>
                  {hasUnsavedChanges && (
                    <span className="text-[12px] text-amber-600">· 有未保存的修改</span>
                  )}
                  {saveMessage && !hasUnsavedChanges && (
                    <span
                      className={`text-[12px] ${saveState === "error" ? "text-[#b2483f]" : "text-[#1d7a5f]"}`}
                    >
                      {saveMessage}
                    </span>
                  )}
                  {saveMessage && saveState === "error" && (
                    <span className="text-[12px] text-[#b2483f]">{saveMessage}</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPreviewMode((v) => !v)}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.75)] px-4 py-[9px] text-[13px] font-medium text-[#5e6860] hover:text-[#1c221d]"
                  >
                    {previewMode ? "编辑" : "预览"}
                  </button>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={!canEdit || !hasUnsavedChanges || saveState === "saving"}
                    className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.75)] px-4 py-[9px] text-[13px] font-medium text-[#1c221d] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    重置
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canEdit || !hasUnsavedChanges || saveState === "saving"}
                    className="inline-flex items-center gap-2 rounded-full bg-[#1d7a5f] px-4 py-[9px] text-[13px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saveState === "saving" ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Save className="size-4" aria-hidden />
                    )}
                    <span>
                      {saveState === "saving"
                        ? "保存中…"
                        : hasUnsavedChanges
                          ? "保存修改"
                          : "已保存"}
                    </span>
                  </button>
                </div>
              </div>

              {!canEdit && (
                <div className="mb-3 rounded-[14px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.55)] px-3 py-3 text-[12px] leading-[1.7] text-[#5e6860]">
                  当前角色只有只读权限，无法修改内容。
                </div>
              )}

              {!currentText && !canEdit ? (
                <div className="flex min-h-[120px] items-center justify-center rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.4)] text-[13px] text-[#5e6860]">
                  暂无内容。
                </div>
              ) : previewMode && currentText ? (
                <div className="min-h-[520px] rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[#fffcf6] px-5 py-5">
                  <MarkdownPreview content={currentText} />
                </div>
              ) : (
                <textarea
                  value={currentText}
                  onChange={(e) => setCurrentText(e.target.value)}
                  readOnly={!canEdit}
                  placeholder={
                    assetTab === "brief"
                      ? "在此输入文章大纲（Markdown 格式）…"
                      : "在此输入文章初稿（Markdown 格式）…"
                  }
                  className="min-h-[520px] w-full resize-y rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[#fffcf6] px-4 py-4 font-mono text-[13px] leading-[1.7] text-[#1c221d] outline-none transition-colors focus:border-[rgba(29,122,95,0.35)] read-only:cursor-default"
                  spellCheck={false}
                />
              )}
            </div>
          </>
        )}
      </section>
    </div>
  );
}
