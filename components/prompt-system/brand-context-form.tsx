"use client";

import { FormEvent, useState } from "react";
import { Button } from "@/components/ui/button";
import type { BrandContext, BrandContextUpdate } from "@/lib/types/prompt-system";

const panelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)] p-6";

const inputClass =
  "mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50";

const labelClass = "text-sm font-medium text-[#1c221d]";

const sectionHeadingClass =
  "mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5e6860]";

// ── Tag Input ─────────────────────────────────────────────────

function TagInput({
  values,
  onChange,
  disabled,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (v && !values.includes(v)) {
      onChange([...values, v]);
    }
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="mt-1 rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 p-2">
      <div className="flex flex-wrap gap-2">
        {values.map((v, i) => (
          <span
            key={i}
            className="inline-flex items-center gap-1 rounded-full bg-[rgba(29,122,95,0.1)] px-3 py-1 text-[12px] text-[#1d7a5f]"
          >
            {v}
            {!disabled && (
              <button
                type="button"
                onClick={() => remove(i)}
                className="ml-1 text-[#1d7a5f]/60 hover:text-[#1d7a5f]"
                aria-label={`Remove ${v}`}
              >
                ×
              </button>
            )}
          </span>
        ))}
      </div>
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder ?? "Add item, press Enter"}
            className="flex-1 bg-transparent text-[13px] text-[#1c221d] placeholder:text-[#bcbcbc] focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-full border border-[rgba(28,34,29,0.15)] px-3 py-0.5 text-[12px] text-[#5e6860] hover:border-[#1d7a5f] hover:text-[#1d7a5f]"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Competitive Positioning Editor ────────────────────────────

function CompetitivePositioningEditor({
  value,
  onChange,
  disabled,
}: {
  value: Record<string, string>;
  onChange: (next: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [draftKey, setDraftKey] = useState("");
  const [draftVal, setDraftVal] = useState("");
  const entries = Object.entries(value);

  const add = () => {
    const k = draftKey.trim();
    const v = draftVal.trim();
    if (k && v) {
      onChange({ ...value, [k]: v });
      setDraftKey("");
      setDraftVal("");
    }
  };

  const remove = (key: string) => {
    const next = { ...value };
    delete next[key];
    onChange(next);
  };

  const updateVal = (key: string, newVal: string) => {
    onChange({ ...value, [key]: newVal });
  };

  return (
    <div className="mt-1 space-y-2 rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 p-3">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2">
          <span className="w-36 shrink-0 rounded-[8px] border border-[rgba(28,34,29,0.1)] bg-[rgba(29,122,95,0.06)] px-2 py-1.5 text-[12px] text-[#1d7a5f]">
            {k}
          </span>
          <textarea
            rows={2}
            value={v}
            onChange={(e) => updateVal(k, e.target.value)}
            disabled={disabled}
            className="flex-1 rounded-[8px] border border-[rgba(28,34,29,0.12)] bg-white/90 px-2 py-1.5 text-[12px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50"
          />
          {!disabled && (
            <button
              type="button"
              onClick={() => remove(k)}
              className="self-start pt-1 text-[#bcbcbc] hover:text-[#b2483f]"
              aria-label={`Remove ${k}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="flex gap-2 pt-1">
          <input
            value={draftKey}
            onChange={(e) => setDraftKey(e.target.value)}
            placeholder="vs_competitor"
            className="w-36 shrink-0 rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-2 py-1.5 text-[12px] text-[#1c221d] placeholder:text-[#bcbcbc] focus:outline-none"
          />
          <input
            value={draftVal}
            onChange={(e) => setDraftVal(e.target.value)}
            placeholder="Positioning description"
            className="flex-1 rounded-[8px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-2 py-1.5 text-[12px] text-[#1c221d] placeholder:text-[#bcbcbc] focus:outline-none"
          />
          <button
            type="button"
            onClick={add}
            className="rounded-full border border-[rgba(28,34,29,0.15)] px-3 py-0.5 text-[12px] text-[#5e6860] hover:border-[#1d7a5f] hover:text-[#1d7a5f]"
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main Form ─────────────────────────────────────────────────

export function BrandContextForm({
  initial,
  canEdit,
}: {
  initial: BrandContext | null;
  canEdit: boolean;
}) {
  const [form, setForm] = useState<BrandContextUpdate>(
    initial
      ? {
          productName: initial.productName,
          productPositioning: initial.productPositioning,
          capabilitiesSummary: initial.capabilitiesSummary,
          supportedPlatforms: initial.supportedPlatforms,
          aiModelsUsed: initial.aiModelsUsed,
          pricingInfo: initial.pricingInfo,
          brandVoice: initial.brandVoice,
          expressionRules: initial.expressionRules,
          bannedWords: initial.bannedWords,
          pexoMentionDensity: initial.pexoMentionDensity,
          competitivePositioning: initial.competitivePositioning,
          version: initial.version,
        }
      : {
          productName: "",
          productPositioning: "",
          capabilitiesSummary: "",
          supportedPlatforms: [],
          aiModelsUsed: [],
          pricingInfo: "",
          brandVoice: "",
          expressionRules: "",
          bannedWords: [],
          pexoMentionDensity: "",
          competitivePositioning: {},
          version: "v1.0",
        }
  );

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof BrandContextUpdate>(
    key: K,
    val: BrandContextUpdate[K]
  ) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setSaving(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/prompt-system/brand-context", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error ?? res.statusText);
      setMessage("Brand Context 已保存。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Product Info */}
      <section className={panelClass}>
        <p className={sectionHeadingClass}>产品信息</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Product Name</label>
            <input
              value={form.productName}
              onChange={(e) => set("productName", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Product Positioning</label>
            <textarea
              rows={4}
              value={form.productPositioning}
              onChange={(e) => set("productPositioning", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Capabilities Summary</label>
            <textarea
              rows={4}
              value={form.capabilitiesSummary}
              onChange={(e) => set("capabilitiesSummary", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Supported Platforms</label>
            <TagInput
              values={form.supportedPlatforms}
              onChange={(v) => set("supportedPlatforms", v)}
              disabled={!canEdit}
              placeholder="Telegram, WhatsApp…"
            />
          </div>
          <div>
            <label className={labelClass}>AI Models Used</label>
            <TagInput
              values={form.aiModelsUsed}
              onChange={(v) => set("aiModelsUsed", v)}
              disabled={!canEdit}
              placeholder="Seedance, Kling…"
            />
          </div>
          <div>
            <label className={labelClass}>Pricing Info</label>
            <textarea
              rows={3}
              value={form.pricingInfo}
              onChange={(e) => set("pricingInfo", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Writing Rules */}
      <section className={panelClass}>
        <p className={sectionHeadingClass}>写作规则</p>
        <div className="space-y-4">
          <div>
            <label className={labelClass}>Brand Voice</label>
            <textarea
              rows={3}
              value={form.brandVoice}
              onChange={(e) => set("brandVoice", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Expression Rules</label>
            <textarea
              rows={4}
              value={form.expressionRules}
              onChange={(e) => set("expressionRules", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Banned Words</label>
            <TagInput
              values={form.bannedWords}
              onChange={(v) => set("bannedWords", v)}
              disabled={!canEdit}
              placeholder="revolutionary, cutting-edge…"
            />
          </div>
          <div>
            <label className={labelClass}>Pexo Mention Density</label>
            <textarea
              rows={3}
              value={form.pexoMentionDensity}
              onChange={(e) => set("pexoMentionDensity", e.target.value)}
              disabled={!canEdit}
              className={inputClass}
            />
          </div>
        </div>
      </section>

      {/* Competitive Positioning */}
      <section className={panelClass}>
        <p className={sectionHeadingClass}>竞品定位</p>
        <CompetitivePositioningEditor
          value={form.competitivePositioning}
          onChange={(v) => set("competitivePositioning", v)}
          disabled={!canEdit}
        />
      </section>

      {/* Footer */}
      <div className="flex flex-wrap items-center gap-3">
        {canEdit && (
          <Button type="submit" disabled={saving}>
            {saving ? "保存中..." : "保存 Brand Context"}
          </Button>
        )}
        <div className="ml-auto text-right">
          {initial && (
            <p className="text-[11px] text-[#5e6860]">
              版本 {initial.version} · 上次更新{" "}
              {new Intl.DateTimeFormat("zh-CN", {
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              }).format(new Date(initial.updatedAt))}
            </p>
          )}
        </div>
      </div>

      {message && <p className="text-[13px] text-[#2c7f52]">{message}</p>}
      {error && <p className="text-[13px] text-[#b2483f]">{error}</p>}
      {!canEdit && (
        <p className="text-[12px] text-[#b2483f]">当前账号没有编辑权限。</p>
      )}
    </form>
  );
}
