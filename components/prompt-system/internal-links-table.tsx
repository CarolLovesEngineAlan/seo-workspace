"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  PsInternalLink,
  PsInternalLinkCreate,
  PsPageCategory,
  PsLinkPriority,
} from "@/lib/types/prompt-system";
import {
  PAGE_CATEGORY_LABELS,
  LINK_PRIORITY_LABELS,
} from "@/lib/types/prompt-system";

const panelClass =
  "overflow-hidden rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)]";

const formPanelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)] p-6";

const inputClass =
  "mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none";

const selectClass =
  "rounded-[10px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-1.5 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none";

const labelClass = "text-[13px] font-medium text-[#1c221d]";

const PAGE_CATEGORIES: PsPageCategory[] = [
  "feature", "use_case", "model", "guide", "blog", "other",
];
const LINK_PRIORITIES: PsLinkPriority[] = ["high", "medium", "low"];

const PRIORITY_COLORS: Record<PsLinkPriority, string> = {
  high: "border-[rgba(178,72,63,0.3)] text-[#b2483f]",
  medium: "border-[rgba(29,122,95,0.3)] text-[#1d7a5f]",
  low: "border-[rgba(28,34,29,0.2)] text-[#5e6860]",
};

function emptyForm(): PsInternalLinkCreate {
  return {
    pageTitle: "",
    url: "",
    pageCategory: "feature",
    primaryKeyword: "",
    anchorTextSuggestions: [],
    linkPriority: "medium",
    lastVerified: null,
  };
}

// ── Inline form for add/edit ──────────────────────────────────

function LinkForm({
  initial,
  onSave,
  onCancel,
}: {
  initial: PsInternalLinkCreate;
  onSave: (data: PsInternalLinkCreate) => Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<PsInternalLinkCreate>(initial);
  const [anchorsRaw, setAnchorsRaw] = useState(
    initial.anchorTextSuggestions.join(", ")
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof PsInternalLinkCreate>(
    key: K,
    val: PsInternalLinkCreate[K]
  ) => setForm((prev) => ({ ...prev, [key]: val }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const anchors = anchorsRaw
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      await onSave({ ...form, anchorTextSuggestions: anchors });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败。");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`${formPanelClass} space-y-4`}>
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <label className={labelClass}>Page Title *</label>
          <input
            value={form.pageTitle}
            onChange={(e) => set("pageTitle", e.target.value)}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>URL *</label>
          <input
            value={form.url}
            onChange={(e) => set("url", e.target.value)}
            required
            type="url"
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>Category</label>
          <select
            value={form.pageCategory}
            onChange={(e) => set("pageCategory", e.target.value as PsPageCategory)}
            className={`${inputClass} mt-1`}
          >
            {PAGE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {PAGE_CATEGORY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select
            value={form.linkPriority}
            onChange={(e) => set("linkPriority", e.target.value as PsLinkPriority)}
            className={`${inputClass} mt-1`}
          >
            {LINK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {LINK_PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>Primary Keyword</label>
          <input
            value={form.primaryKeyword}
            onChange={(e) => set("primaryKeyword", e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label className={labelClass}>
            Anchor Texts
            <span className="ml-1 text-[11px] font-normal text-[#5e6860]">逗号分隔</span>
          </label>
          <input
            value={anchorsRaw}
            onChange={(e) => setAnchorsRaw(e.target.value)}
            placeholder="text to video, AI text to video"
            className={inputClass}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={saving}>
          {saving ? "保存中..." : "保存"}
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          取消
        </Button>
        {error && <span className="text-[12px] text-[#b2483f]">{error}</span>}
      </div>
    </form>
  );
}

// ── Main Table ────────────────────────────────────────────────

export function InternalLinksTable({
  links,
  canEdit,
}: {
  links: PsInternalLink[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [filterCategory, setFilterCategory] = useState<PsPageCategory | "">("");
  const [filterPriority, setFilterPriority] = useState<PsLinkPriority | "">("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = links.filter((l) => {
    if (filterCategory && l.pageCategory !== filterCategory) return false;
    if (filterPriority && l.linkPriority !== filterPriority) return false;
    return true;
  });

  const handleAdd = async (data: PsInternalLinkCreate) => {
    const res = await fetch("/api/prompt-system/internal-links", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "创建失败");
    setShowAddForm(false);
    router.refresh();
  };

  const handleEdit = async (id: string, data: PsInternalLinkCreate) => {
    const res = await fetch(`/api/prompt-system/internal-links/${id}`, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(data),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error ?? "更新失败");
    setEditingId(null);
    router.refresh();
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`确认删除 "${title}"？`)) return;
    setDeleting(id);
    try {
      await fetch(`/api/prompt-system/internal-links/${id}`, { method: "DELETE" });
      router.refresh();
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value as PsPageCategory | "")}
          className={selectClass}
        >
          <option value="">All Categories</option>
          {PAGE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{PAGE_CATEGORY_LABELS[c]}</option>
          ))}
        </select>

        <select
          value={filterPriority}
          onChange={(e) => setFilterPriority(e.target.value as PsLinkPriority | "")}
          className={selectClass}
        >
          <option value="">All Priorities</option>
          {LINK_PRIORITIES.map((p) => (
            <option key={p} value={p}>{LINK_PRIORITY_LABELS[p]}</option>
          ))}
        </select>

        <span className="ml-auto text-[12px] text-[#5e6860]">
          {filtered.length} / {links.length} 条
        </span>

        {canEdit && !showAddForm && (
          <Button size="sm" onClick={() => setShowAddForm(true)}>
            + 新增内链
          </Button>
        )}
      </div>

      {/* Add Form */}
      {showAddForm && (
        <LinkForm
          initial={emptyForm()}
          onSave={handleAdd}
          onCancel={() => setShowAddForm(false)}
        />
      )}

      {/* Table */}
      <section className={panelClass}>
        <Table className="text-[#1c221d]">
          <TableHeader>
            <tr>
              <TableHead className="text-[#5e6860]">Page Title</TableHead>
              <TableHead className="text-[#5e6860]">URL</TableHead>
              <TableHead className="text-[#5e6860]">Category</TableHead>
              <TableHead className="text-[#5e6860]">Priority</TableHead>
              <TableHead className="text-[#5e6860]">Anchor Texts</TableHead>
              {canEdit && <TableHead className="text-[#5e6860]">操作</TableHead>}
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-[rgba(29,122,95,0.04)]">
                <TableCell colSpan={6} className="py-10 text-center text-[13px] text-[#5e6860]">
                  暂无内链记录。
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((link) =>
                editingId === link.id ? (
                  <TableRow key={link.id} className="hover:bg-transparent">
                    <TableCell colSpan={6} className="p-0">
                      <LinkForm
                        initial={{
                          pageTitle: link.pageTitle,
                          url: link.url,
                          pageCategory: link.pageCategory,
                          primaryKeyword: link.primaryKeyword,
                          anchorTextSuggestions: link.anchorTextSuggestions,
                          linkPriority: link.linkPriority,
                          lastVerified: link.lastVerified,
                        }}
                        onSave={(data) => handleEdit(link.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </TableCell>
                  </TableRow>
                ) : (
                  <TableRow key={link.id} className="hover:bg-[rgba(29,122,95,0.04)]">
                    <TableCell className="font-medium text-[#1c221d]">{link.pageTitle}</TableCell>
                    <TableCell>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="max-w-[200px] truncate text-[12px] text-[#1d7a5f] hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {link.url}
                      </a>
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full border border-[rgba(28,34,29,0.18)] bg-[rgba(28,34,29,0.06)] px-2.5 py-1 text-xs font-medium text-[#1c221d]">
                        {PAGE_CATEGORY_LABELS[link.pageCategory]}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${
                        link.linkPriority === "high"
                          ? "border-[rgba(178,72,63,0.3)] bg-[rgba(178,72,63,0.06)] text-[#b2483f]"
                          : link.linkPriority === "medium"
                          ? "border-[rgba(29,122,95,0.3)] bg-[rgba(29,122,95,0.06)] text-[#1d7a5f]"
                          : "border-[rgba(28,34,29,0.2)] bg-[rgba(28,34,29,0.04)] text-[#5e6860]"
                      }`}>
                        {LINK_PRIORITY_LABELS[link.linkPriority]}
                      </span>
                    </TableCell>
                    <TableCell className="text-[12px] text-[#5e6860]">
                      {link.anchorTextSuggestions.join(" / ")}
                    </TableCell>
                    {canEdit && (
                      <TableCell>
                        <div className="flex gap-2">
                          <button
                            className="text-[13px] font-medium text-[#1d7a5f] hover:underline"
                            onClick={() => setEditingId(link.id)}
                          >
                            编辑
                          </button>
                          <button
                            disabled={deleting === link.id}
                            onClick={() => handleDelete(link.id, link.pageTitle)}
                            className="text-[13px] font-medium text-[#b2483f] hover:underline disabled:opacity-50"
                          >
                            {deleting === link.id ? "删除中…" : "删除"}
                          </button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                )
              )
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
