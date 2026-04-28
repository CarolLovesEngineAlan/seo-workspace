"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-config";
import { normalizeNextPath } from "@/lib/auth/next-path";

type State = "idle" | "sending" | "sent" | "error";

export function EmailSignInForm({ next = "/workbench" }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email.trim() || state === "sending") return;

    setState("sending");
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const destination = normalizeNextPath(next);
      const redirectTo =
        getAuthRedirectUrl(destination, window.location.origin) ||
        `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;

      const { error: authError } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
      });

      if (authError) throw authError;
      setState("sent");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg.includes("timeout") || msg.includes("fetch")
        ? "网络请求超时，请检查网络后重试。"
        : "发送失败，请确认邮箱地址后重试。");
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <div className="rounded-[20px] border border-[rgba(29,122,95,0.2)] bg-[rgba(29,122,95,0.06)] px-5 py-5 text-[14px] leading-7 text-[#1c221d]">
        <div className="font-semibold text-[#1d7a5f]">登录链接已发送</div>
        <div className="mt-1 text-[13px] text-[#5e6860]">
          请查收 <span className="font-medium text-[#1c221d]">{email}</span> 的邮件，点击链接即可登录。
        </div>
        <button
          type="button"
          onClick={() => { setState("idle"); setEmail(""); }}
          className="mt-3 text-[12px] text-[#1d7a5f] underline underline-offset-2"
        >
          换一个邮箱
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="text-[13px] font-medium text-[#1c221d]" htmlFor="email">
          邮箱地址
        </label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={state === "sending"}
          className="mt-1.5 w-full rounded-[14px] border border-[rgba(28,34,29,0.15)] bg-white/80 px-4 py-2.5 text-[14px] text-[#1c221d] placeholder:text-[#a8b0a9] focus:border-[#1d7a5f] focus:outline-none disabled:opacity-50"
        />
      </div>

      {error && (
        <p className="text-[12px] text-[#b2483f]">{error}</p>
      )}

      <button
        type="submit"
        disabled={state === "sending" || !email.trim()}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-[#1d7a5f] px-6 text-[14px] font-medium text-white shadow-[0_18px_36px_rgba(29,122,95,0.18)] transition-all hover:translate-y-[-1px] hover:bg-[#17654f] disabled:opacity-60 disabled:translate-y-0"
      >
        {state === "sending" ? (
          <><LoaderCircle className="size-4 animate-spin" aria-hidden /><span>发送中…</span></>
        ) : (
          <span>发送登录链接</span>
        )}
      </button>

      <p className="text-center text-[12px] leading-6 text-[#7b837d]">
        仅限已授权的邮箱登录。
      </p>
    </form>
  );
}
