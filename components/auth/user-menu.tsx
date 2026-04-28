"use client";

import Link from "next/link";
import { ChevronDown, ShieldCheck } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import type { AppRole } from "@/lib/auth/roles";
import { LogoutButton } from "@/components/auth/logout-button";

function buildAvatarLabel(email: string): string {
  const normalized = email.trim();

  if (!normalized) {
    return "U";
  }

  return normalized[0]?.toUpperCase() || "U";
}

export function UserMenu({
  userEmail,
  role,
  canManageUsers,
  className,
}: {
  userEmail: string;
  role: AppRole;
  canManageUsers: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const menuId = useId();
  const avatarLabel = buildAvatarLabel(userEmail);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [open]);

  return (
    <div ref={menuRef} className={`relative ${className ?? ""}`.trim()}>
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.82)] px-2.5 py-2 shadow-[0_12px_24px_rgba(44,38,22,0.06)] transition-all hover:border-[rgba(29,122,95,0.24)] hover:shadow-[0_16px_28px_rgba(29,122,95,0.08)]"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-[#1d7a5f] text-[13px] font-semibold text-white">
          {avatarLabel}
        </span>
        <ChevronDown
          className={`size-4 text-[#5e6860] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 top-[calc(100%+12px)] z-50 w-[280px] rounded-[22px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.96)] p-3 shadow-[0_24px_50px_rgba(44,38,22,0.16)] backdrop-blur-[16px]"
        >
          <div className="rounded-[18px] border border-[rgba(29,122,95,0.14)] bg-[rgba(236,248,243,0.72)] px-4 py-3">
            <div className="text-[14px] font-medium text-[#1c221d]">{userEmail}</div>
            <div className="mt-1 text-[12px] font-medium uppercase tracking-[0.16em] text-[#1d7a5f]">
              {role}
            </div>
          </div>

          <div className="mt-3 flex flex-col gap-2">
            {canManageUsers ? (
              <Link
                href="/admin/access"
                role="menuitem"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center gap-2 rounded-[16px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.78)] px-4 text-[14px] font-medium text-[#1c221d] transition-colors hover:border-[rgba(29,122,95,0.22)]"
              >
                <ShieldCheck className="size-4" aria-hidden />
                <span>Access Control</span>
              </Link>
            ) : null}

            <LogoutButton className="inline-flex h-11 items-center justify-center gap-2 rounded-[16px] bg-[#1d7a5f] px-4 text-[14px] font-medium text-white" />
          </div>
        </div>
      ) : null}
    </div>
  );
}
