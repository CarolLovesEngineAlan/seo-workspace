import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  FilePenLine,
  House,
  LayoutPanelLeft,
  BookMarked,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectNavigationKey =
  | "home"
  | "workbench"
  | "briefRecords"
  | "promptSystem";

type NavigationItem = {
  key: ProjectNavigationKey;
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  cta: string;
};

export const projectNavigationItems: NavigationItem[] = [
  {
    key: "home",
    href: "/",
    label: "Home",
    description: "总览产品定位、系统结构和当前项目入口。",
    icon: House,
    cta: "查看概览",
  },
  {
    key: "workbench",
    href: "/workbench",
    label: "Workbench",
    description: "处理机会池、策略队列和内容生产流程。",
    icon: LayoutPanelLeft,
    cta: "进入工作台",
  },
  {
    key: "briefRecords",
    href: "/brief-records",
    label: "Assets",
    description: "查看和管理已生成的 Brief、Draft 与 QA 资产。",
    icon: FilePenLine,
    cta: "进入资产库",
  },
  {
    key: "promptSystem",
    href: "/prompt-system/brand-context",
    label: "Prompt System",
    description: "管理 Brand Context、Prompt 库和内链库。",
    icon: BookMarked,
    cta: "进入 Prompt System",
  },
];

function navigationShellClass(variant: "dark" | "warm") {
  if (variant === "warm") {
    return "rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.72)] p-1 shadow-[0_12px_28px_rgba(44,38,22,0.08)]";
  }

  return "surface-chip future-ring rounded-full border border-border/70 p-1";
}

function navigationItemClass(
  variant: "dark" | "warm",
  active: boolean
) {
  if (variant === "warm") {
    return cn(
      "inline-flex items-center gap-2 rounded-full px-4 py-2 text-[13px] font-medium transition-all",
      active
        ? "bg-[#1d7a5f] text-white shadow-[0_12px_24px_rgba(29,122,95,0.22)]"
        : "text-[#1c221d] hover:bg-[rgba(29,122,95,0.08)] hover:text-[#1d7a5f]"
    );
  }

  return cn(
    "inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-all",
    active
      ? "bg-[linear-gradient(135deg,#74e7ff_0%,#458fff_100%)] text-[#04111d] shadow-[0_16px_30px_rgba(69,143,255,0.22)]"
      : "text-foreground hover:bg-secondary/80 hover:text-primary"
  );
}

export function ProjectNavigation({
  activeKey,
  variant = "dark",
  className,
}: {
  activeKey: ProjectNavigationKey;
  variant?: "dark" | "warm";
  className?: string;
}) {
  return (
    <nav
      aria-label="project navigation"
      className={cn(
        "inline-flex flex-wrap items-center gap-1",
        navigationShellClass(variant),
        className
      )}
    >
      {projectNavigationItems.map((item) => {
        const Icon = item.icon;

        return (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.key === activeKey ? "page" : undefined}
            className={navigationItemClass(variant, item.key === activeKey)}
          >
            <Icon className="size-4" aria-hidden />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

export function ProjectNavigationCards({
  activeKey,
  variant = "dark",
}: {
  activeKey: ProjectNavigationKey;
  variant?: "dark" | "warm";
}) {
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {projectNavigationItems.map((item, index) => {
        const Icon = item.icon;
        const active = item.key === activeKey;

        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "rounded-[1.75rem] border p-5 transition-all",
              variant === "warm"
                ? active
                  ? "border-[rgba(29,122,95,0.22)] bg-[linear-gradient(180deg,rgba(255,255,255,1)_0%,rgba(243,249,246,0.98)_100%)] shadow-[0_18px_40px_rgba(29,122,95,0.12)] ring-1 ring-[rgba(29,122,95,0.12)]"
                  : "border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_14px_32px_rgba(44,38,22,0.1)] hover:border-[rgba(29,122,95,0.18)] hover:shadow-[0_18px_38px_rgba(29,122,95,0.08)]"
                : active
                  ? "surface-panel future-lift border-primary/30 shadow-[0_20px_46px_rgba(7,18,38,0.42),0_0_0_1px_rgba(116,231,255,0.1)]"
                  : "surface-panel future-lift border-border/70"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl",
                  variant === "warm"
                    ? "border border-[rgba(29,122,95,0.14)] bg-[rgba(29,122,95,0.08)] text-[#1d7a5f]"
                    : "border border-primary/20 bg-primary/10 text-primary"
                )}
              >
                <Icon className="size-5" aria-hidden />
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em]",
                  variant === "warm"
                    ? "border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.9)] text-[#5e6860]"
                    : "border border-border/70 bg-secondary/60 text-muted-foreground"
                )}
              >
                {active ? "current" : `0${index + 1}`}
              </span>
            </div>

            <div className="mt-5">
              <div
                className={cn(
                  "text-lg font-semibold",
                  variant === "warm" ? "text-[#1c221d]" : "text-foreground"
                )}
              >
                {item.label}
              </div>
              <p
                className={cn(
                  "mt-2 text-sm leading-6",
                  variant === "warm" ? "text-[#5e6860]" : "text-muted-foreground"
                )}
              >
                {item.description}
              </p>
            </div>

            <div
              className={cn(
                "mt-5 inline-flex items-center gap-2 text-sm font-medium",
                variant === "warm" ? "text-[#1d7a5f]" : "text-primary"
              )}
            >
              <span>{item.cta}</span>
              <ArrowRight className="size-4" aria-hidden />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
