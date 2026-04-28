"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const items = [
  { href: "/prompt-system/workbench", label: "A · Outline", exact: true },
  { href: "/prompt-system/workbench/copy", label: "B · Copy", exact: true },
  { href: "/prompt-system/brand-context", label: "Brand Context" },
  { href: "/prompt-system/prompts", label: "Prompt Library" },
  { href: "/prompt-system/internal-links", label: "Internal Links" },
];

export function PromptSystemNav() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.72)] p-1 shadow-[0_12px_28px_rgba(44,38,22,0.08)]">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          className={cn(
            "inline-flex items-center rounded-full px-4 py-2 text-[13px] font-medium transition-all",
            (item.exact ? pathname === item.href : pathname.startsWith(item.href))
              ? "bg-[#1d7a5f] text-white shadow-[0_12px_24px_rgba(29,122,95,0.22)]"
              : "text-[#1c221d] hover:bg-[rgba(29,122,95,0.08)] hover:text-[#1d7a5f]"
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
