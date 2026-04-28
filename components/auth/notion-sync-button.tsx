"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

type SyncState =
  | { status: "idle" }
  | { status: "running" }
  | { status: "done"; rawRowCount?: number; groupCount?: number; durationMs?: number; syncedAt?: string }
  | { status: "error"; message: string };

export function NotionSyncButton() {
  const [state, setState] = useState<SyncState>({ status: "idle" });

  async function handleSync() {
    setState({ status: "running" });
    try {
      const res = await fetch("/api/admin/sync-notion", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setState({ status: "error", message: data.error ?? "同步失败" });
        return;
      }
      setState({
        status: "done",
        rawRowCount: data.rawRowCount,
        groupCount: data.groupCount,
        durationMs: data.durationMs,
        syncedAt: data.syncedAt,
      });
    } catch (err) {
      setState({ status: "error", message: err instanceof Error ? err.message : "网络错误" });
    }
  }

  const running = state.status === "running";

  return (
    <div className="flex flex-col gap-3">
      <button
        type="button"
        disabled={running}
        onClick={handleSync}
        className="inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(29,122,95,0.3)] bg-[rgba(29,122,95,0.08)] px-5 text-[14px] font-medium text-[#1d7a5f] transition-colors hover:bg-[rgba(29,122,95,0.14)] disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`size-4 ${running ? "animate-spin" : ""}`} aria-hidden />
        {running ? "同步中…" : "手动同步 Notion → 数据库"}
      </button>

      {state.status === "done" && (
        <div className="rounded-[14px] border border-[rgba(29,122,95,0.2)] bg-[rgba(236,248,243,0.72)] px-4 py-3 text-[13px] leading-6 text-[#1d7a5f]">
          同步完成 · 读取 {state.rawRowCount ?? 0} 条 Notion 记录 → {state.groupCount ?? 0} 个页面组
          {state.durationMs != null ? ` · ${(state.durationMs / 1000).toFixed(1)}s` : ""}
          {state.syncedAt ? ` · ${new Date(state.syncedAt).toISOString().replace("T", " ").slice(0, 16)}` : ""}
        </div>
      )}

      {state.status === "error" && (
        <div className="rounded-[14px] border border-[rgba(178,72,63,0.2)] bg-[rgba(255,240,238,0.8)] px-4 py-3 text-[13px] leading-6 text-[#b2483f]">
          {state.message}
        </div>
      )}
    </div>
  );
}
