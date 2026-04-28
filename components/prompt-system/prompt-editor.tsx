"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type {
  PsPrompt,
  PsPromptCreate,
  PsPageType,
  PsPromptStep,
  PsRecommendedModel,
  PsRequiredVariable,
} from "@/lib/types/prompt-system";
import {
  PAGE_TYPE_LABELS,
  PROMPT_STEP_LABELS,
  MODEL_LABELS,
} from "@/lib/types/prompt-system";

const panelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)] p-6";

const inputClass =
  "mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50";

const labelClass = "text-sm font-medium text-[#1c221d]";

const PAGE_TYPES: PsPageType[] = [
  "feature_page",
  "use_case_page",
  "blog_howto",
  "blog_top_review",
  "blog_tips",
  "blog_product_review",
];

const PROMPT_STEPS: PsPromptStep[] = ["A_outline", "B_copy"];
const MODELS: PsRecommendedModel[] = ["claude_sonnet", "claude_opus", "gpt4o_mini"];

type FormState = Omit<PsPromptCreate, "requiredVariables"> & {
  requiredVariablesRaw: string;
};

function promptToForm(p: PsPrompt): FormState {
  return {
    name: p.name,
    pageType: p.pageType,
    promptStep: p.promptStep,
    promptText: p.promptText,
    requiredVariablesRaw: JSON.stringify(p.requiredVariables, null, 2),
    exampleVariableSet: p.exampleVariableSet,
    recommendedModel: p.recommendedModel,
    useCache: p.useCache,
    version: p.version,
    notes: p.notes,
    brandContextId: p.brandContextId,
  };
}

function defaultForm(): FormState {
  return {
    name: "",
    pageType: "feature_page",
    promptStep: "A_outline",
    promptText: "",
    requiredVariablesRaw: "[]",
    exampleVariableSet: "",
    recommendedModel: "claude_sonnet",
    useCache: false,
    version: "v1.0",
    notes: "",
    brandContextId: null,
  };
}

export function PromptEditor({
  prompt,
  canEdit,
}: {
  prompt: PsPrompt | null;
  canEdit: boolean;
}) {
  const router = useRouter();
  const isNew = !prompt;

  const [form, setForm] = useState<FormState>(
    prompt ? promptToForm(prompt) : defaultForm()
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [variablesError, setVariablesError] = useState<string | null>(null);

  const set = <K extends keyof FormState>(key: K, val: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;

    // Validate required_variables JSON
    let requiredVariables: PsRequiredVariable[] = [];
    try {
      requiredVariables = JSON.parse(form.requiredVariablesRaw);
      setVariablesError(null);
    } catch {
      setVariablesError("Required Variables 不是合法的 JSON。");
      return;
    }

    setSaving(true);
    setMessage(null);
    setError(null);

    const payload: PsPromptCreate = {
      name: form.name,
      pageType: form.pageType,
      promptStep: form.promptStep,
      promptText: form.promptText,
      requiredVariables,
      exampleVariableSet: form.exampleVariableSet,
      recommendedModel: form.recommendedModel,
      useCache: form.useCache,
      version: form.version,
      notes: form.notes,
      brandContextId: form.brandContextId,
    };

    try {
      const url = isNew
        ? "/api/prompt-system/prompts"
        : `/api/prompt-system/prompts/${prompt.id}`;
      const method = isNew ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? res.statusText);

      setMessage(isNew ? "Prompt 已创建。" : "Prompt 已更新。");
      if (isNew && body.data?.id) {
        router.push(`/prompt-system/prompts/${body.data.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <section className={panelClass}>
        <div className="grid gap-4 md:grid-cols-2">
          {/* Name */}
          <div className="md:col-span-2">
            <label className={labelClass}>Name *</label>
            <input
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={!canEdit}
              required
              placeholder="Feature Page — Outline"
              className={inputClass}
            />
          </div>

          {/* Page Type */}
          <div>
            <label className={labelClass}>Page Type *</label>
            <select
              value={form.pageType}
              onChange={(e) => set("pageType", e.target.value as PsPageType)}
              disabled={!canEdit}
              className={inputClass}
            >
              {PAGE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {PAGE_TYPE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>

          {/* Prompt Step */}
          <div>
            <label className={labelClass}>Prompt Step *</label>
            <select
              value={form.promptStep}
              onChange={(e) => set("promptStep", e.target.value as PsPromptStep)}
              disabled={!canEdit}
              className={inputClass}
            >
              {PROMPT_STEPS.map((s) => (
                <option key={s} value={s}>
                  {PROMPT_STEP_LABELS[s]}
                </option>
              ))}
            </select>
          </div>

          {/* Recommended Model */}
          <div>
            <label className={labelClass}>Recommended Model</label>
            <select
              value={form.recommendedModel}
              onChange={(e) => set("recommendedModel", e.target.value as PsRecommendedModel)}
              disabled={!canEdit}
              className={inputClass}
            >
              {MODELS.map((m) => (
                <option key={m} value={m}>
                  {MODEL_LABELS[m]}
                </option>
              ))}
            </select>
          </div>

          {/* Version + Use Cache */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className={labelClass}>Version</label>
              <input
                value={form.version}
                onChange={(e) => set("version", e.target.value)}
                disabled={!canEdit}
                className={inputClass}
              />
            </div>
            <div className="flex items-end gap-2 pb-2">
              <input
                id="use-cache"
                type="checkbox"
                checked={form.useCache}
                onChange={(e) => set("useCache", e.target.checked)}
                disabled={!canEdit}
                className="h-4 w-4 accent-[#1d7a5f]"
              />
              <label htmlFor="use-cache" className="text-[13px] text-[#1c221d]">
                Use Cache
              </label>
            </div>
          </div>
        </div>
      </section>

      {/* Prompt Text */}
      <section className={panelClass}>
        <label className={labelClass}>
          Prompt Text
          <span className="ml-2 text-[11px] font-normal text-[#5e6860]">
            支持 {"{brand_context}"} 和 {"{internal_link_library}"} 占位符
          </span>
        </label>
        <textarea
          rows={20}
          value={form.promptText}
          onChange={(e) => set("promptText", e.target.value)}
          disabled={!canEdit}
          placeholder="在此输入完整 Prompt 内容…"
          className="mt-2 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-4 py-3 font-mono text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50"
        />
      </section>

      {/* Variables + Notes */}
      <section className={panelClass}>
        <div className="grid gap-6 md:grid-cols-2">
          <div>
            <label className={labelClass}>
              Required Variables
              <span className="ml-2 text-[11px] font-normal text-[#5e6860]">JSON 数组</span>
            </label>
            <textarea
              rows={8}
              value={form.requiredVariablesRaw}
              onChange={(e) => {
                set("requiredVariablesRaw", e.target.value);
                setVariablesError(null);
              }}
              disabled={!canEdit}
              className="mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 font-mono text-[12px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50"
            />
            {variablesError && (
              <p className="mt-1 text-[12px] text-[#b2483f]">{variablesError}</p>
            )}
          </div>

          <div className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Example Variable Set</label>
              <textarea
                rows={5}
                value={form.exampleVariableSet}
                onChange={(e) => set("exampleVariableSet", e.target.value)}
                disabled={!canEdit}
                placeholder="primary_keyword: text to video&#10;keyword_variants: text to video generator, ai text to video"
                className={`${inputClass} font-mono`}
              />
            </div>
            <div>
              <label className={labelClass}>Notes / Changelog</label>
              <textarea
                rows={4}
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
                disabled={!canEdit}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : isNew ? "创建 Prompt" : "更新 Prompt"}
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => router.push("/prompt-system/prompts")}
        >
          返回列表
        </Button>
      </div>

      {message && <p className="text-[13px] text-[#2c7f52]">{message}</p>}
      {error && <p className="text-[13px] text-[#b2483f]">{error}</p>}
    </form>
  );
}
