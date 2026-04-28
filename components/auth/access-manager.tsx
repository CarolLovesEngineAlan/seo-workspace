"use client";

import { LoaderCircle, Save } from "lucide-react";
import { useMemo, useState } from "react";
import type { AppRole } from "@/lib/auth/roles";
import type { ManagedUserAccess } from "@/lib/auth/admin";

type SaveState = "idle" | "saving" | "saved" | "error";

export function AccessManager({
  users,
  currentUserId,
}: {
  users: ManagedUserAccess[];
  currentUserId: string;
}) {
  const [draftRoles, setDraftRoles] = useState<Record<string, AppRole | "none">>(() =>
    Object.fromEntries(
      users.map((user) => [user.id, user.role ?? "none"])
    )
  );
  const [saveStates, setSaveStates] = useState<Record<string, SaveState>>({});
  const [messages, setMessages] = useState<Record<string, string | null>>({});

  const sortedUsers = useMemo(() => users, [users]);

  async function handleSave(user: ManagedUserAccess) {
    const nextRole = draftRoles[user.id] ?? "none";

    if (user.id === currentUserId && user.role === "admin" && nextRole !== "admin") {
      setSaveStates((current) => ({ ...current, [user.id]: "error" }));
      setMessages((current) => ({
        ...current,
        [user.id]: "不能移除你自己的 admin 权限，避免把系统锁死。",
      }));
      return;
    }

    setSaveStates((current) => ({ ...current, [user.id]: "saving" }));
    setMessages((current) => ({ ...current, [user.id]: null }));

    try {
      const response = await fetch(`/api/admin/user-roles/${user.id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          email: user.email,
          role: nextRole === "none" ? null : nextRole,
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        role?: AppRole | null;
      };

      if (!response.ok) {
        throw new Error(payload.error || "保存用户权限失败。");
      }

      setSaveStates((current) => ({ ...current, [user.id]: "saved" }));
      setMessages((current) => ({
        ...current,
        [user.id]: nextRole === "none" ? "访问权限已移除。" : `已更新为 ${nextRole}。`,
      }));
    } catch (error) {
      setSaveStates((current) => ({ ...current, [user.id]: "error" }));
      setMessages((current) => ({
        ...current,
        [user.id]: error instanceof Error ? error.message : String(error),
      }));
    }
  }

  return (
    <div className="space-y-4">
      {sortedUsers.map((user) => {
        const currentRole = user.role ?? "none";
        const nextRole = draftRoles[user.id] ?? currentRole;
        const isDirty = nextRole !== currentRole;
        const saveState = saveStates[user.id] ?? "idle";
        const message = messages[user.id];

        return (
          <div
            key={user.id}
            className="rounded-[20px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] p-4"
          >
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="text-[16px] font-semibold text-[#1c221d]">
                  {user.displayName || user.email || user.id}
                </div>
                <div className="mt-1 text-[13px] text-[#5e6860]">{user.email || "—"}</div>
                <div className="mt-2 flex flex-wrap gap-2 text-[12px] text-[#5e6860]">
                  <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.88)] px-3 py-1">
                    current: {currentRole}
                  </span>
                  {user.id === currentUserId ? (
                    <span className="rounded-full border border-[rgba(29,122,95,0.18)] bg-[rgba(236,248,243,0.88)] px-3 py-1 text-[#1d7a5f]">
                      you
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <select
                  value={nextRole}
                  onChange={(event) =>
                    setDraftRoles((current) => ({
                      ...current,
                      [user.id]: event.target.value as AppRole | "none",
                    }))
                  }
                  className="h-11 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-4 text-[14px] text-[#1c221d] outline-none"
                >
                  <option value="none">No access</option>
                  <option value="viewer">viewer</option>
                  <option value="editor">editor</option>
                  <option value="admin">admin</option>
                </select>

                <button
                  type="button"
                  onClick={() => handleSave(user)}
                  disabled={!isDirty || saveState === "saving"}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#1d7a5f] px-5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveState === "saving" ? (
                    <LoaderCircle className="size-4 animate-spin" aria-hidden />
                  ) : (
                    <Save className="size-4" aria-hidden />
                  )}
                  <span>{saveState === "saving" ? "Saving..." : "保存权限"}</span>
                </button>
              </div>
            </div>

            {message ? (
              <div
                className={`mt-3 text-[12px] ${
                  saveState === "error" ? "text-[#b2483f]" : "text-[#1d7a5f]"
                }`}
              >
                {message}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
