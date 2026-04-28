"use client";

import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { normalizeNextPath } from "@/lib/auth/next-path";

export function FeishuSignInButton({
  next = "/workbench",
  className,
}: {
  next?: string;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);

  function handleClick() {
    setIsPending(true);
    const destination = normalizeNextPath(next);
    window.location.href = `/api/auth/feishu?next=${encodeURIComponent(destination)}`;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className={className}
    >
      {isPending ? (
        <LoaderCircle className="size-4 animate-spin" aria-hidden />
      ) : (
        <svg viewBox="0 0 24 24" className="size-5" aria-hidden fill="currentColor">
          <path d="M12 2C6.477 2 2 6.477 2 12s4.477 10 10 10 10-4.477 10-10S17.523 2 12 2zm4.5 7.5h-3v6h-3v-6h-3V7h9v2.5z"/>
        </svg>
      )}
      <span>{isPending ? "跳转飞书中…" : "飞书账号登录"}</span>
    </button>
  );
}
