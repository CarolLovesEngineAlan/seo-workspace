"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import type { PsPrompt } from "@/lib/types/prompt-system";
import { PAGE_TYPE_LABELS, PROMPT_STEP_LABELS } from "@/lib/types/prompt-system";
import { renderPageHtml } from "@/lib/production/html-renderer";

const panelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)]";

const inputClass =
  "mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] placeholder:text-[#a8b0a9] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50";

const labelClass = "text-[13px] font-medium text-[#1c221d]";
const hintClass = "ml-1 text-[11px] font-normal text-[#5e6860]";

type State = "idle" | "generating" | "done" | "error";

export function CopyWorkbench({ copyPrompts }: { copyPrompts: PsPrompt[] }) {
  const [promptId, setPromptId] = useState(copyPrompts[0]?.id ?? "");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [keywordVariants, setKeywordVariants] = useState("");
  const [outline, setOutline] = useState("");
  const [notes, setNotes] = useState("");

  const [state, setState] = useState<State>("idle");
  const [rawOutput, setRawOutput] = useState("");
  const [copyJson, setCopyJson] = useState<unknown>(null);
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [model, setModel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"raw" | "formatted">("formatted");

  useEffect(() => {
    const raw = sessionStorage.getItem("outline_prefill");
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        primaryKeyword?: string;
        keywordVariants?: string;
        notes?: string;
        outline?: string;
      };
      if (data.primaryKeyword) setPrimaryKeyword(data.primaryKeyword);
      if (data.keywordVariants) setKeywordVariants(data.keywordVariants);
      if (data.notes) setNotes(data.notes);
      if (data.outline) setOutline(data.outline);
      sessionStorage.removeItem("outline_prefill");
    } catch {
      // ignore
    }
  }, []);

  const selectedPrompt = copyPrompts.find((p) => p.id === promptId);
  const hasPromptText = !!selectedPrompt?.promptText?.trim();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!promptId || !primaryKeyword.trim() || !outline.trim()) return;

    setState("generating");
    setRawOutput("");
    setCopyJson(null);
    setJsonError(null);
    setModel("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/prompt-system/generate-copy", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          promptId,
          variables: {
            primary_keyword: primaryKeyword.trim(),
            outline: outline.trim(),
            keyword_variants: keywordVariants.trim(),
            notes: notes.trim(),
          },
        }),
      });

      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "请求失败" }));
        throw new Error((err as { error?: string }).error ?? "请求失败");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const msg = JSON.parse(trimmed) as {
              type: string;
              delta?: string;
              rawOutput?: string;
              copyJson?: unknown;
              jsonError?: string | null;
              model?: string;
              error?: string;
            };

            if (msg.type === "delta" && msg.delta) {
              setRawOutput((prev) => {
                const next = prev + msg.delta;
                requestAnimationFrame(() => {
                  if (outputRef.current) {
                    outputRef.current.scrollTop = outputRef.current.scrollHeight;
                  }
                });
                return next;
              });
            } else if (msg.type === "done") {
              if (msg.model) setModel(msg.model);
              if (msg.copyJson) setCopyJson(msg.copyJson);
              if (msg.jsonError) setJsonError(msg.jsonError);
              setState("done");
            } else if (msg.type === "error") {
              throw new Error(msg.error ?? "生成失败");
            }
          } catch (parseErr) {
            if (parseErr instanceof SyntaxError) continue;
            throw parseErr;
          }
        }
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "生成失败，请重试。");
      setState("error");
    }
  };

  const handleCopyOutput = () => {
    const text =
      viewMode === "formatted" && copyJson
        ? JSON.stringify(copyJson, null, 2)
        : rawOutput;
    navigator.clipboard.writeText(text).catch(() => {});
  };

  const handleDownloadJson = () => {
    const text = copyJson ? JSON.stringify(copyJson, null, 2) : rawOutput;
    const slug = primaryKeyword.trim().toLowerCase().replace(/\s+/g, "-") || "copy";
    const blob = new Blob([text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${slug}-copy.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadHtml = () => {
    if (!copyJson || !selectedPrompt) return;
    try {
      const html = renderPageHtml(selectedPrompt.pageType, copyJson);
      const slug = primaryKeyword.trim().toLowerCase().replace(/\s+/g, "-") || "page";
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}-draft.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err instanceof Error ? err.message : "HTML 导出失败");
    }
  };

  const handleReset = () => {
    setState("idle");
    setRawOutput("");
    setCopyJson(null);
    setJsonError(null);
    setModel("");
    setErrorMsg("");
  };

  const [copying, setCopying] = useState(false);

  const handleCopyPrompt = async () => {
    if (!promptId || !primaryKeyword.trim() || !hasPromptText) return;
    setCopying(true);
    try {
      const res = await fetch(`/api/prompt-system/assembled-prompt/${promptId}`);
      if (!res.ok) throw new Error("获取 Prompt 失败");
      const { data } = await res.json() as { data: { assembledText: string } };

      const vars: Record<string, string> = {
        primary_keyword: primaryKeyword.trim(),
        outline: outline.trim(),
        keyword_variants: keywordVariants.trim(),
        notes: notes.trim(),
      };

      const final = data.assembledText.replace(
        /\{([a-zA-Z0-9_]+)\}/g,
        (match, key: string) => vars[key]?.trim() || match
      );

      await navigator.clipboard.writeText(final);
      alert("已复制到剪贴板，粘贴到 Claude.ai 即可。");
    } catch (err) {
      alert(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopying(false);
    }
  };

  const isGenerating = state === "generating";
  const displayJson = copyJson ? JSON.stringify(copyJson, null, 2) : null;
  const canExportHtml = state === "done" && !jsonError && !!copyJson && !!selectedPrompt;

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* ── Left: Form ── */}
      <div className={`${panelClass} p-6`}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Prompt selector */}
          <div>
            <label className={labelClass}>Copy Prompt (B_copy)</label>
            <select
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              disabled={isGenerating}
              className={inputClass}
            >
              {copyPrompts.length === 0 ? (
                <option value="">暂无 Copy Prompt</option>
              ) : (
                copyPrompts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {PAGE_TYPE_LABELS[p.pageType]}
                  </option>
                ))
              )}
            </select>
            {selectedPrompt && !hasPromptText && (
              <p className="mt-1.5 text-[11px] text-[#b2483f]">
                该 Prompt 的文本内容为空，请先在 Prompt Library 中填写内容。
              </p>
            )}
            {selectedPrompt && (
              <p className="mt-1 text-[11px] text-[#5e6860]">
                Step: {PROMPT_STEP_LABELS[selectedPrompt.promptStep]} ·{" "}
                {PAGE_TYPE_LABELS[selectedPrompt.pageType]}
              </p>
            )}
          </div>

          {/* Primary keyword */}
          <div>
            <label className={labelClass}>
              Primary Keyword
              <span className="ml-1 text-[#b2483f]">*</span>
            </label>
            <input
              value={primaryKeyword}
              onChange={(e) => setPrimaryKeyword(e.target.value)}
              placeholder="e.g. text to video"
              required
              disabled={isGenerating}
              className={inputClass}
            />
          </div>

          {/* Keyword variants */}
          <div>
            <label className={labelClass}>
              Keyword Variants
              <span className={hintClass}>可选</span>
            </label>
            <input
              value={keywordVariants}
              onChange={(e) => setKeywordVariants(e.target.value)}
              placeholder="e.g. text to video generator, ai text to video"
              disabled={isGenerating}
              className={inputClass}
            />
          </div>

          {/* Outline (Step A output) */}
          <div>
            <label className={labelClass}>
              大纲（Step A 输出）
              <span className="ml-1 text-[#b2483f]">*</span>
            </label>
            <textarea
              value={outline}
              onChange={(e) => setOutline(e.target.value)}
              rows={8}
              placeholder="粘贴 Step A 生成的 Markdown 大纲..."
              required
              disabled={isGenerating}
              className={`${inputClass} resize-none font-mono text-[12px]`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>
              备注
              <span className={hintClass}>可选</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="特殊要求、语气调整等..."
              disabled={isGenerating}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={
              isGenerating ||
              !promptId ||
              !primaryKeyword.trim() ||
              !outline.trim() ||
              !hasPromptText
            }
            className="w-full rounded-[12px] bg-[#1d7a5f] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(29,122,95,0.22)] transition-all hover:bg-[#186b52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "生成中..." : "生成页面文案（JSON）"}
          </button>

          {/* Copy prompt */}
          <button
            type="button"
            disabled={
              copying ||
              !promptId ||
              !primaryKeyword.trim() ||
              !outline.trim() ||
              !hasPromptText
            }
            onClick={handleCopyPrompt}
            className="w-full rounded-[12px] border border-[rgba(28,34,29,0.2)] bg-white/70 px-4 py-2.5 text-[13px] font-medium text-[#1c221d] transition-all hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {copying ? "复制中..." : "复制完整 Prompt → 粘贴到 Claude.ai"}
          </button>
        </form>
      </div>

      {/* ── Right: Output ── */}
      <div className={`${panelClass} flex flex-col`}>
        {/* Output header */}
        <div className="flex items-center justify-between border-b border-[rgba(28,34,29,0.1)] px-5 py-3">
          <div className="flex items-center gap-3">
            <span className="text-[13px] font-semibold text-[#1c221d]">JSON 文案</span>
            {model && (
              <span className="rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(28,34,29,0.05)] px-2.5 py-0.5 text-[11px] text-[#5e6860]">
                {model}
              </span>
            )}
            {state === "generating" && (
              <span className="text-[11px] text-[#1d7a5f]">生成中…</span>
            )}
            {state === "done" && !jsonError && (
              <span className="rounded-full bg-[rgba(29,122,95,0.1)] px-2 py-0.5 text-[11px] font-medium text-[#1d7a5f]">
                JSON 有效 ✓
              </span>
            )}
            {state === "done" && jsonError && (
              <span className="rounded-full bg-[rgba(178,72,63,0.1)] px-2 py-0.5 text-[11px] font-medium text-[#b2483f]">
                JSON 解析错误
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {/* View toggle */}
            {state === "done" && (
              <div className="flex overflow-hidden rounded-[8px] border border-[rgba(28,34,29,0.15)]">
                <button
                  onClick={() => setViewMode("formatted")}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === "formatted"
                      ? "bg-[#1d7a5f] text-white"
                      : "bg-white/60 text-[#5e6860] hover:bg-white"
                  }`}
                >
                  格式化
                </button>
                <button
                  onClick={() => setViewMode("raw")}
                  className={`px-3 py-1 text-[11px] font-medium transition-colors ${
                    viewMode === "raw"
                      ? "bg-[#1d7a5f] text-white"
                      : "bg-white/60 text-[#5e6860] hover:bg-white"
                  }`}
                >
                  原始
                </button>
              </div>
            )}
            {(state === "done" || (state === "generating" && rawOutput)) && (
              <button
                onClick={handleCopyOutput}
                className="rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/60 px-3 py-1 text-[12px] font-medium text-[#1c221d] hover:bg-white"
              >
                复制
              </button>
            )}
            {state === "done" && (
              <button
                onClick={handleDownloadJson}
                className="rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/60 px-3 py-1 text-[12px] font-medium text-[#1c221d] hover:bg-white"
              >
                下载 JSON
              </button>
            )}
            {canExportHtml && (
              <button
                onClick={handleDownloadHtml}
                className="rounded-[8px] bg-[#1d7a5f] px-3 py-1 text-[12px] font-semibold text-white shadow-[0_4px_12px_rgba(29,122,95,0.3)] hover:bg-[#186b52]"
              >
                导出 HTML ↓
              </button>
            )}
            {(state === "done" || state === "error") && (
              <button
                onClick={handleReset}
                className="rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/60 px-3 py-1 text-[12px] font-medium text-[#1c221d] hover:bg-white"
              >
                清空
              </button>
            )}
          </div>
        </div>

        {/* JSON error warning */}
        {state === "done" && jsonError && (
          <div className="mx-5 mt-3 rounded-[10px] border border-[rgba(178,72,63,0.2)] bg-[rgba(178,72,63,0.05)] px-4 py-2.5 text-[12px] text-[#b2483f]">
            <strong>JSON 解析失败：</strong> {jsonError}
            <br />
            <span className="text-[11px] opacity-80">
              请切换到「原始」视图复制原文，手动检查格式，或重新生成。
            </span>
          </div>
        )}

        {/* HTML export hint */}
        {canExportHtml && (
          <div className="mx-5 mt-3 rounded-[10px] border border-[rgba(29,122,95,0.2)] bg-[rgba(29,122,95,0.05)] px-4 py-2.5 text-[12px] text-[#1d7a5f]">
            JSON 有效，可点击右上角「导出 HTML ↓」获取完整页面预览文件。
          </div>
        )}

        {/* Output body */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto p-5"
          style={{ minHeight: "480px", maxHeight: "72vh" }}
        >
          {state === "idle" && (
            <p className="text-[13px] text-[#a8b0a9]">
              1. 选择 B_copy Prompt<br />
              2. 填写关键词和 Step A 大纲<br />
              3. 点击「生成页面文案」
            </p>
          )}
          {state === "error" && (
            <div className="rounded-[12px] border border-[rgba(178,72,63,0.2)] bg-[rgba(178,72,63,0.05)] p-4 text-[13px] text-[#b2483f]">
              {errorMsg}
            </div>
          )}
          {(state === "generating" || state === "done") && (
            <pre className="whitespace-pre-wrap font-mono text-[12px] leading-[1.7] text-[#1c221d]">
              {state === "done" && viewMode === "formatted" && displayJson
                ? displayJson
                : rawOutput}
              {state === "generating" && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-[#1d7a5f] align-middle" />
              )}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
}
