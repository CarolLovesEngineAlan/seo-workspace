"use client";

import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PsPrompt } from "@/lib/types/prompt-system";
import { PAGE_TYPE_LABELS, PROMPT_STEP_LABELS } from "@/lib/types/prompt-system";

const panelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)]";

const inputClass =
  "mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] placeholder:text-[#a8b0a9] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50";

const labelClass = "text-[13px] font-medium text-[#1c221d]";
const hintClass = "ml-1 text-[11px] font-normal text-[#5e6860]";

type State = "idle" | "generating" | "done" | "error";

export function OutlineWorkbench({ outlinePrompts }: { outlinePrompts: PsPrompt[] }) {
  const router = useRouter();
  const [promptId, setPromptId] = useState(outlinePrompts[0]?.id ?? "");
  const [primaryKeyword, setPrimaryKeyword] = useState("");
  const [keywordVariants, setKeywordVariants] = useState("");
  // Multiple competitor URLs
  const [competitorUrls, setCompetitorUrls] = useState<string[]>([""]);
  const [notes, setNotes] = useState("");

  const [state, setState] = useState<State>("idle");
  const [output, setOutput] = useState("");
  const [model, setModel] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const selectedPrompt = outlinePrompts.find((p) => p.id === promptId);
  const hasPromptText = !!selectedPrompt?.promptText?.trim();

  // ── Competitor URL helpers ────────────────────────────────────
  const addCompetitorUrl = () => setCompetitorUrls((prev) => [...prev, ""]);

  const updateCompetitorUrl = (index: number, value: string) => {
    setCompetitorUrls((prev) => prev.map((u, i) => (i === index ? value : u)));
  };

  const removeCompetitorUrl = (index: number) => {
    setCompetitorUrls((prev) => (prev.length === 1 ? [""] : prev.filter((_, i) => i !== index)));
  };

  const competitorNotesValue = competitorUrls
    .map((u) => u.trim())
    .filter(Boolean)
    .join("\n");

  // ── Submit ────────────────────────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!promptId || !primaryKeyword.trim()) return;

    setState("generating");
    setOutput("");
    setModel("");
    setErrorMsg("");

    try {
      const res = await fetch("/api/prompt-system/generate-outline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          promptId,
          variables: {
            primary_keyword: primaryKeyword.trim(),
            keyword_variants: keywordVariants.trim(),
            competitor_notes: competitorNotesValue,
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
              markdown?: string;
              model?: string;
              error?: string;
            };

            if (msg.type === "delta" && msg.delta) {
              setOutput((prev) => {
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

  const handleCopy = () => {
    navigator.clipboard.writeText(output).catch(() => {});
  };

  const handleReset = () => {
    setState("idle");
    setOutput("");
    setModel("");
    setErrorMsg("");
  };

  const isGenerating = state === "generating";
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
        keyword_variants: keywordVariants.trim(),
        competitor_notes: competitorNotesValue,
        notes: notes.trim(),
      };

      let final = data.assembledText.replace(
        /\{([a-zA-Z0-9_]+)\}/g,
        (match, key: string) => vars[key]?.trim() || match
      );

      const contextLines: string[] = [`Primary keyword: ${vars.primary_keyword}`];
      if (vars.keyword_variants)
        contextLines.push(`Keyword variants: ${vars.keyword_variants}`);
      if (vars.competitor_notes)
        contextLines.push(`Competitor references:\n${vars.competitor_notes}`);
      if (vars.notes) contextLines.push(`Additional notes: ${vars.notes}`);

      final += `\n\n---\n## Context for this page\n${contextLines.join("\n")}`;

      await navigator.clipboard.writeText(final);
      alert(`已复制到剪贴板（${final.length} 字符）`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "复制失败");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[400px_1fr]">
      {/* ── Left: Form ── */}
      <div className={`${panelClass} p-6`}>
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Prompt selector */}
          <div>
            <label className={labelClass}>Outline Prompt</label>
            <select
              value={promptId}
              onChange={(e) => setPromptId(e.target.value)}
              disabled={isGenerating}
              className={inputClass}
            >
              {outlinePrompts.length === 0 ? (
                <option value="">暂无 Outline Prompt</option>
              ) : (
                outlinePrompts.map((p) => (
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
              <span className={hintClass}>可选，逗号分隔</span>
            </label>
            <input
              value={keywordVariants}
              onChange={(e) => setKeywordVariants(e.target.value)}
              placeholder="e.g. text to video generator, ai text to video"
              disabled={isGenerating}
              className={inputClass}
            />
          </div>

          {/* Competitor URLs — multi-entry */}
          <div>
            <div className="flex items-center justify-between">
              <label className={labelClass}>
                竞品参考页面
                <span className={hintClass}>可选</span>
              </label>
              {!isGenerating && (
                <button
                  type="button"
                  onClick={addCompetitorUrl}
                  className="text-[11px] font-medium text-[#1d7a5f] hover:underline"
                >
                  + 添加
                </button>
              )}
            </div>
            <div className="mt-1 space-y-2">
              {competitorUrls.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={url}
                    onChange={(e) => updateCompetitorUrl(i, e.target.value)}
                    placeholder={`https://competitor.com/page-${i + 1}`}
                    disabled={isGenerating}
                    className="flex-1 rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] placeholder:text-[#a8b0a9] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50"
                  />
                  {competitorUrls.length > 1 && !isGenerating && (
                    <button
                      type="button"
                      onClick={() => removeCompetitorUrl(i)}
                      className="flex-shrink-0 rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/60 px-2 py-1.5 text-[12px] text-[#5e6860] hover:text-[#b2483f]"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="mt-1 text-[11px] text-[#5e6860]">
              {competitorUrls.filter((u) => u.trim()).length} 条参考 URL
            </p>
          </div>

          {/* Notes */}
          <div>
            <label className={labelClass}>
              备注 / 特殊要求
              <span className={hintClass}>可选</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Feature eyebrow tags、目标受众、特殊限制等..."
              disabled={isGenerating}
              className={`${inputClass} resize-none`}
            />
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={isGenerating || !promptId || !primaryKeyword.trim() || !hasPromptText}
            className="w-full rounded-[12px] bg-[#1d7a5f] px-4 py-2.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(29,122,95,0.22)] transition-all hover:bg-[#186b52] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? "生成中..." : "生成大纲"}
          </button>

          {/* Copy prompt */}
          <button
            type="button"
            disabled={copying || !promptId || !primaryKeyword.trim() || !hasPromptText}
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
            <span className="text-[13px] font-semibold text-[#1c221d]">生成结果</span>
            {model && (
              <span className="rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(28,34,29,0.05)] px-2.5 py-0.5 text-[11px] text-[#5e6860]">
                {model}
              </span>
            )}
            {state === "generating" && (
              <span className="text-[11px] text-[#1d7a5f]">生成中…</span>
            )}
            {state === "done" && (
              <span className="text-[11px] text-[#1d7a5f]">完成</span>
            )}
          </div>
          <div className="flex gap-2">
            {(state === "done" || (state === "generating" && output)) && (
              <button
                onClick={handleCopy}
                className="rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/60 px-3 py-1 text-[12px] font-medium text-[#1c221d] hover:bg-white"
              >
                复制
              </button>
            )}
            {state === "done" && (
              <button
                onClick={() => {
                  sessionStorage.setItem(
                    "outline_prefill",
                    JSON.stringify({
                      primaryKeyword,
                      keywordVariants,
                      notes,
                      outline: output,
                    })
                  );
                  router.push("/prompt-system/workbench/copy");
                }}
                className="rounded-[8px] bg-[#1d7a5f] px-3 py-1 text-[12px] font-medium text-white hover:bg-[#165f4a]"
              >
                → 去生成 Copy
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

        {/* Output body */}
        <div
          ref={outputRef}
          className="flex-1 overflow-y-auto p-5"
          style={{ minHeight: "480px", maxHeight: "72vh" }}
        >
          {state === "idle" && (
            <p className="text-[13px] text-[#a8b0a9]">填写左侧参数并点击「生成大纲」。</p>
          )}
          {state === "error" && (
            <div className="rounded-[12px] border border-[rgba(178,72,63,0.2)] bg-[rgba(178,72,63,0.05)] p-4 text-[13px] text-[#b2483f]">
              {errorMsg}
            </div>
          )}
          {(state === "generating" || state === "done") && output && (
            <pre className="whitespace-pre-wrap font-mono text-[13px] leading-[1.7] text-[#1c221d]">
              {output}
              {state === "generating" && (
                <span className="inline-block h-4 w-0.5 animate-pulse bg-[#1d7a5f] align-middle" />
              )}
            </pre>
          )}
          {state === "generating" && !output && (
            <p className="text-[13px] text-[#a8b0a9]">正在生成…</p>
          )}
        </div>
      </div>
    </div>
  );
}
