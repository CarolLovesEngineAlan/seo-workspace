"use client";

import { FormEvent, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  CustomPromptRecord,
  DocPromptRecord,
  PromptLibrary,
} from "@/lib/types/prompt";

type EditorSource = "manual" | "doc" | "custom";

type EditorState = {
  id: string | null;
  name: string;
  description: string;
  content: string;
  source: EditorSource;
};

const panelClass =
  "rounded-[22px] border border-[rgba(28,34,29,0.12)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.08)] p-6";

function formatCreatedAt(value: string) {
  try {
    return new Intl.DateTimeFormat("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

export function PromptManager({ canEdit }: { canEdit: boolean }) {
  const [library, setLibrary] = useState<PromptLibrary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState>({
    id: null,
    name: "",
    description: "",
    content: "",
    source: "manual",
  });

  const loadLibrary = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/prompts/library", { cache: "no-store" });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          payload.error ?? response.statusText ?? "无法加载 Prompt 列表。"
        );
      }
      const payload = (await response.json()) as PromptLibrary;
      setLibrary(payload);
    } catch (error) {
      setLoadError(
        error instanceof Error ? error.message : "无法加载 Prompt 列表。"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();
  }, []);

  const docPrompts = library?.docPrompts ?? [];
  const customPrompts = library?.customPrompts ?? [];

  const resetEditor = () => {
    setEditor({
      id: null,
      name: "",
      description: "",
      content: "",
      source: "manual",
    });
    setMessage(null);
    setSaveError(null);
  };

  const importDocPrompt = (doc: DocPromptRecord) => {
    setEditor({
      id: null,
      name: doc.name,
      description: doc.description ?? "",
      content: doc.content,
      source: "doc",
    });
    setMessage("已载入文档 Prompt，可以进一步编辑后保存。");
    setSaveError(null);
  };

  const editCustomPrompt = (prompt: CustomPromptRecord) => {
    setEditor({
      id: prompt.id,
      name: prompt.name,
      description: prompt.description ?? "",
      content: prompt.content,
      source: "custom",
    });
    setMessage("正在编辑已有的自定义 Prompt。");
    setSaveError(null);
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) {
      return;
    }

    setSaving(true);
    setSaveError(null);
    setMessage(null);

    try {
      const response = await fetch("/api/prompts/custom", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: editor.id ?? undefined,
          name: editor.name,
          description: editor.description || null,
          content: editor.content,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error ?? response.statusText ?? "保存失败。");
      }

      if (payload.prompt) {
        setEditor({
          id: payload.prompt.id,
          name: payload.prompt.name,
          description: payload.prompt.description ?? "",
          content: payload.prompt.content,
          source: "custom",
        });
      }

      setMessage("Prompt 已保存到自定义列表。");
      await loadLibrary();
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "保存 Prompt 时发生错误。"
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className={panelClass}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">文档 Prompt</h2>
            <p className="mt-1 text-sm text-[#5e6860]">
              自动读取 <code>doc</code> 目录下的 prompt 文件，可直接导入用于自定义管理。
            </p>
          </div>
          {loading ? (
            <span className="text-[12px] text-[#5e6860]">加载中...</span>
          ) : (
            <span className="text-[12px] text-[#5e6860]">
              共 {docPrompts.length} 个 Prompt
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {loading ? (
            <p className="text-[13px] text-[#5e6860]">正在加载文档 Prompt…</p>
          ) : docPrompts.length === 0 ? (
            <p className="text-[13px] text-[#5e6860]">
              未在 <code>doc/</code> 中找到包含 Prompt 的文件。
            </p>
          ) : (
            docPrompts.map((doc) => (
              <article
                key={doc.id}
                className="flex flex-col gap-3 rounded-[16px] border border-[rgba(28,34,29,0.08)] bg-white/70 p-4 shadow-[0_12px_30px_rgba(0,0,0,0.04)]"
              >
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-semibold">{doc.name}</h3>
                  <span className="whitespace-nowrap rounded-full border border-[rgba(28,34,29,0.18)] px-2 py-0.5 text-[11px] uppercase tracking-[0.2em] text-[#1d7a5f]">
                    文档
                  </span>
                </div>
                <p className="text-[13px] text-[#5e6860]">
                  {doc.description ?? (
                    <span className="text-[#bcbcbc]">暂无描述</span>
                  )}
                </p>
                <div className="mt-auto flex items-center justify-between gap-3 text-[11px] text-[#5e6860]">
                  <span className="truncate">{doc.fileName}</span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canEdit}
                    onClick={() => importDocPrompt(doc)}
                  >
                    导入
                  </Button>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={panelClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">自定义 Prompt</h2>
              <p className="text-[12px] text-[#5e6860]">
                管理已保存的 Prompt，用于生成文章大纲。
              </p>
            </div>
            <span className="text-[12px] text-[#5e6860]">
              {customPrompts.length} 项
            </span>
          </div>

          {loading ? (
            <p className="mt-4 text-[13px] text-[#5e6860]">正在加载自定义 Prompt…</p>
          ) : loadError ? (
            <p className="mt-4 text-[13px] text-[#b2483f]">{loadError}</p>
          ) : customPrompts.length === 0 ? (
            <p className="mt-4 text-[13px] text-[#5e6860]">还没有自定义的 Prompt。</p>
          ) : (
            <Table className="mt-4">
              <TableHeader>
                <tr>
                  <TableHead>名称</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead>创建于</TableHead>
                  <TableHead>操作</TableHead>
                </tr>
              </TableHeader>
              <TableBody>
                {customPrompts.map((prompt) => (
                  <TableRow key={prompt.id}>
                    <TableCell>{prompt.name}</TableCell>
                    <TableCell>
                      {prompt.description || (
                        <span className="text-[#bcbcbc]">—</span>
                      )}
                    </TableCell>
                    <TableCell>{formatCreatedAt(prompt.createdAt)}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={!canEdit}
                        onClick={() => editCustomPrompt(prompt)}
                      >
                        编辑
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </section>

        <section className={panelClass}>
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-lg font-semibold">编辑 Prompt</h2>
              <p className="text-[12px] text-[#5e6860]">
                新建或更新自定义 Prompt，用于 AI 生成流程中选择。
              </p>
            </div>
            <span className="rounded-full border border-[rgba(28,34,29,0.18)] px-3 py-1 text-[11px] text-[#5e6860]">
              {editor.source === "doc"
                ? "文档"
                : editor.source === "custom"
                  ? "自定义"
                  : "新建"}
            </span>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <div>
              <label className="text-sm font-medium text-[#1c221d]">名称</label>
              <input
                value={editor.name}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                disabled={!canEdit}
                className="mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1c221d]">描述</label>
              <input
                value={editor.description}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                disabled={!canEdit}
                className="mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-[#1c221d]">
                Prompt 内容
              </label>
              <textarea
                rows={10}
                value={editor.content}
                onChange={(event) =>
                  setEditor((current) => ({
                    ...current,
                    content: event.target.value,
                  }))
                }
                disabled={!canEdit}
                className="mt-1 w-full rounded-[12px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-3 py-2 text-[13px] text-[#1c221d] focus:border-[#1d7a5f] focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={!canEdit || saving}>
                {saving ? "保存中..." : editor.id ? "更新 Prompt" : "保存为自定义"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetEditor}
              >
                清空
              </Button>
            </div>

            {message && (
              <p className="text-[13px] text-[#2c7f52]">{message}</p>
            )}
            {saveError && (
              <p className="text-[13px] text-[#b2483f]">{saveError}</p>
            )}
            {!canEdit && (
              <p className="text-[12px] text-[#b2483f]">
                当前账号没有编辑 Prompt 的权限。
              </p>
            )}
          </form>
        </section>
      </div>
    </div>
  );
}
