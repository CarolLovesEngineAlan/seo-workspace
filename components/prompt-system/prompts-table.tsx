"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
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
import type { PsPrompt, PsPageType, PsPromptStep } from "@/lib/types/prompt-system";
import {
  PAGE_TYPE_LABELS,
  PROMPT_STEP_LABELS,
  MODEL_LABELS,
} from "@/lib/types/prompt-system";

const panelClass =
  "overflow-hidden rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)]";

const selectClass =
  "rounded-[10px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-1.5 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none";

const PAGE_TYPES: PsPageType[] = [
  "feature_page",
  "use_case_page",
  "blog_howto",
  "blog_top_review",
  "blog_tips",
  "blog_product_review",
];

const PROMPT_STEPS: PsPromptStep[] = ["A_outline", "B_copy"];

function formatDate(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function PromptsTable({
  prompts,
  canEdit,
}: {
  prompts: PsPrompt[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [filterPageType, setFilterPageType] = useState<PsPageType | "">("");
  const [filterStep, setFilterStep] = useState<PsPromptStep | "">("");
  const [deleting, setDeleting] = useState<string | null>(null);

  const filtered = prompts.filter((p) => {
    if (filterPageType && p.pageType !== filterPageType) return false;
    if (filterStep && p.promptStep !== filterStep) return false;
    return true;
  });

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确认删除 "${name}"？此操作不可撤销。`)) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/prompt-system/prompts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("删除失败");
      router.refresh();
    } catch {
      alert("删除失败，请重试。");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filters + New button */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterPageType}
          onChange={(e) => setFilterPageType(e.target.value as PsPageType | "")}
          className={selectClass}
        >
          <option value="">All Page Types</option>
          {PAGE_TYPES.map((t) => (
            <option key={t} value={t}>
              {PAGE_TYPE_LABELS[t]}
            </option>
          ))}
        </select>

        <select
          value={filterStep}
          onChange={(e) => setFilterStep(e.target.value as PsPromptStep | "")}
          className={selectClass}
        >
          <option value="">All Steps</option>
          {PROMPT_STEPS.map((s) => (
            <option key={s} value={s}>
              {PROMPT_STEP_LABELS[s]}
            </option>
          ))}
        </select>

        <span className="ml-auto text-[12px] text-[#5e6860]">
          {filtered.length} / {prompts.length} 条
        </span>

        {canEdit && (
          <Button
            size="sm"
            onClick={() => router.push("/prompt-system/prompts/new")}
          >
            + 新建 Prompt
          </Button>
        )}
      </div>

      {/* Table */}
      <section className={panelClass}>
        <Table className="text-[#1c221d]">
          <TableHeader>
            <tr>
              <TableHead className="text-[#5e6860]">Name</TableHead>
              <TableHead className="text-[#5e6860]">Page Type</TableHead>
              <TableHead className="text-[#5e6860]">Step</TableHead>
              <TableHead className="text-[#5e6860]">Model</TableHead>
              <TableHead className="text-[#5e6860]">Version</TableHead>
              <TableHead className="text-[#5e6860]">Updated</TableHead>
              <TableHead className="text-[#5e6860]">操作</TableHead>
            </tr>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow className="hover:bg-[rgba(29,122,95,0.04)]">
                <TableCell colSpan={7} className="py-10 text-center text-[13px] text-[#5e6860]">
                  暂无 Prompt 记录。
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((p) => (
                <TableRow
                  key={p.id}
                  className="cursor-pointer hover:bg-[rgba(29,122,95,0.04)]"
                  onClick={() => router.push(`/prompt-system/prompts/${p.id}`)}
                >
                  <TableCell className="font-medium text-[#1c221d]">{p.name}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center rounded-full border border-[rgba(28,34,29,0.18)] bg-[rgba(28,34,29,0.06)] px-2.5 py-1 text-xs font-medium text-[#1c221d]">
                      {PAGE_TYPE_LABELS[p.pageType]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={
                        p.promptStep === "A_outline"
                          ? "inline-flex items-center rounded-full border border-[rgba(29,122,95,0.3)] bg-[rgba(29,122,95,0.08)] px-2.5 py-1 text-xs font-medium text-[#1d7a5f]"
                          : "inline-flex items-center rounded-full border border-[rgba(218,188,96,0.4)] bg-[rgba(218,188,96,0.1)] px-2.5 py-1 text-xs font-medium text-[#9a7a2e]"
                      }
                    >
                      {PROMPT_STEP_LABELS[p.promptStep]}
                    </span>
                  </TableCell>
                  <TableCell className="text-[12px] text-[#5e6860]">
                    {MODEL_LABELS[p.recommendedModel]}
                  </TableCell>
                  <TableCell className="text-[12px] text-[#5e6860]">
                    {p.version}
                  </TableCell>
                  <TableCell className="text-[12px] text-[#5e6860]">
                    {formatDate(p.updatedAt)}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      <button
                        className="text-[13px] font-medium text-[#1d7a5f] hover:underline"
                        onClick={() => router.push(`/prompt-system/prompts/${p.id}`)}
                      >
                        编辑
                      </button>
                      {canEdit && (
                        <button
                          disabled={deleting === p.id}
                          onClick={() => handleDelete(p.id, p.name)}
                          className="text-[13px] font-medium text-[#b2483f] hover:underline disabled:opacity-50"
                        >
                          {deleting === p.id ? "删除中…" : "删除"}
                        </button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
