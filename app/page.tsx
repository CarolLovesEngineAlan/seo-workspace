"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "motion/react";
import { useEffect } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Bot,
  Database,
  Layers,
  Radar,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import {
  ProjectNavigation,
  ProjectNavigationCards,
} from "@/components/navigation/project-navigation";
import { BrandMark } from "@/components/brand/brand-mark";
import { InfoTip } from "@/components/ui/info-tip";
import { cn } from "@/lib/utils";


const surfaceCards = [
  {
    icon: Radar,
    label: "机会总览",
    value: "导入",
    unit: "从 Notion 同步",
    hint: "从 Notion 数据库拉取关键词组，按搜索量、竞争难度和业务匹配自动评分。",
  },
  {
    icon: Waypoints,
    label: "优先队列",
    value: "排队",
    unit: "高分机会",
    hint: "高分机会自动进入本周执行列表，不确定的先进复核通道，不直接推入生产流。",
  },
  {
    icon: Bot,
    label: "内容生产",
    value: "生成",
    unit: "Brief · Draft · QA",
    hint: "选中机会，一键生成 Brief、文章骨架和 QA 清单，全套资产在同一界面完成。",
  },
  {
    icon: ShieldCheck,
    label: "审校导出",
    value: "导出",
    unit: "Markdown 交付",
    hint: "人工复核完成后一键导出 Markdown，直接交付写作或对接发布工具。",
  },
];


const systemRules = [
  {
    icon: Database,
    label: "Notion Live",
    hint: "主数据源保持实时，确保市场与 SEO 使用的是同一批页面机会。",
  },
  {
    icon: Layers,
    label: "Single Workspace",
    hint: "统一入口承载机会识别、排序、生产与复核，避免二次切换。",
  },
  {
    icon: ShieldCheck,
    label: "Protected Flow",
    hint: "异常机会不会自动放行，而是先进入受控的 review lane。",
  },
  {
    icon: Sparkles,
    label: "Content Ops",
    hint: "生产内容与策略上下文在同一个工作流里衔接，降低协作损耗。",
  },
];

const pageClass =
  "min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.24),transparent),radial-gradient(ellipse_42%_44%_at_92%_10%,rgba(29,122,95,0.12),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_52%,#ede8da_100%)] text-[#1c221d]";
const panelClass =
  "rounded-[2rem] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.92)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";
const softPanelClass =
  "rounded-[1.65rem] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.76)] shadow-[0_12px_28px_rgba(44,38,22,0.08)]";
const chipClass =
  "inline-flex items-center rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.88)] px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-[#1d7a5f]";
const mutedTextClass = "text-[#5e6860]";
const primaryActionClass =
  "inline-flex h-11 items-center gap-2 rounded-full bg-[#1d7a5f] px-6 text-base font-medium text-white shadow-[0_18px_36px_rgba(29,122,95,0.18)] transition-all hover:translate-y-[-1px] hover:bg-[#17654f]";
const secondaryActionClass =
  "inline-flex h-11 items-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.78)] px-6 text-base font-medium text-[#1c221d] shadow-[0_12px_24px_rgba(44,38,22,0.06)] transition-all hover:translate-y-[-1px] hover:border-[rgba(29,122,95,0.24)]";

export default function Home() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();

  useEffect(() => {
    const warmRoutes = () => {
      router.prefetch("/login");
      router.prefetch("/workbench");
      router.prefetch("/brief-records");
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const handle = window.requestIdleCallback(warmRoutes, { timeout: 1200 });
      return () => window.cancelIdleCallback(handle);
    }

    const timeoutId = setTimeout(warmRoutes, 300);
    return () => clearTimeout(timeoutId);
  }, [router]);

  return (
    <div className={cn("relative flex flex-col overflow-x-hidden", pageClass)}>
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden>
        <div className="absolute left-[8%] top-10 h-72 w-72 rounded-full bg-[rgba(214,185,95,0.18)] blur-[120px]" />
        <div className="absolute right-[8%] top-14 h-80 w-80 rounded-full bg-[rgba(29,122,95,0.12)] blur-[130px]" />
        <div className="absolute bottom-[-8rem] left-1/2 h-[26rem] w-[26rem] -translate-x-1/2 rounded-full bg-[rgba(183,145,66,0.12)] blur-[160px]" />
      </div>

      <header className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-7 md:px-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-11" />
          <span className={chipClass}>
            SEO Opportunity Workspace
          </span>
          <InfoTip
            content="生产级 SEO 工作台，用于统一关键词机会、策略优先级和内容生产执行。"
            tone="warm"
          />
        </div>
        <ProjectNavigation activeKey="home" variant="warm" />
      </header>

      <main
        id="main-content"
        className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-8 px-6 pb-24 pt-4 md:gap-10 md:px-8"
      >
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1.02fr)_440px]">
          <div className={cn("relative p-7 md:p-10", panelClass)}>
            <div
              className="pointer-events-none absolute inset-x-10 top-0 h-40 rounded-full bg-[radial-gradient(circle,rgba(29,122,95,0.12),transparent_68%)]"
              aria-hidden
            />
            <div className="flex flex-wrap items-center gap-3">
              <span className={chipClass}>
                Notion to Production
              </span>
              <InfoTip
                content="从机会聚合、优先级判断到内容生成与 QA，全流程在一个入口里完成。"
                tone="warm"
              />
            </div>

            <div className="mt-6 max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] md:text-6xl md:leading-[1.02]">
                SEO 内容生产
                <br className="hidden sm:block" />
                从 Notion 到发布
              </h1>
              <p className={cn("max-w-2xl text-base leading-7 md:text-lg", mutedTextClass)}>
                关键词机会、优先级排序、Brief 生成、QA 与导出，全部在一个工作台里完成。
                不用在多个文档和表格之间来回切换。
              </p>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/workbench" className={primaryActionClass}>
                Open Workspace
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <Link href="/brief-records" className={secondaryActionClass}>
                Browse Brief Archive
                <ArrowRight className="size-4" aria-hidden />
              </Link>
              <div className="flex flex-wrap gap-2">
                {systemRules.map(({ icon: Icon, label, hint }) => (
                  <IconChip key={label} icon={Icon} label={label} hint={hint} />
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {(["① 机会导入", "② 优先排队", "③ 内容生产", "④ 审校导出"] as const).map(
                (label) => (
                  <div
                    key={label}
                    className={cn("px-4 py-3 text-sm font-medium", softPanelClass)}
                  >
                    {label}
                  </div>
                )
              )}
            </div>
          </div>

          <WorkflowSteps reduceMotion={reduceMotion} />
        </section>

        <section className={cn("p-5 md:p-6", panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-3">
                <span className={chipClass}>
                  Project Navigation
                </span>
                <InfoTip
                  content="首页负责项目总览，Workbench 负责执行，Brief Records 负责追溯和查询。"
                  tone="warm"
                />
              </div>
              <p className={cn("mt-2 text-sm leading-6", mutedTextClass)}>
                用一套稳定的页面入口把项目路径理顺，避免团队成员靠记忆找页面。
              </p>
            </div>
            <span className={chipClass}>
              3 routes
            </span>
          </div>

          <div className="mt-5">
            <ProjectNavigationCards activeKey="home" variant="warm" />
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {surfaceCards.map((item, index) => (
            <motion.div
              key={item.label}
              initial={reduceMotion ? false : { opacity: 0, y: 12 }}
              animate={reduceMotion ? false : { opacity: 1, y: 0 }}
              transition={
                reduceMotion
                  ? undefined
                  : { delay: 0.08 + index * 0.05, duration: 0.35, ease: "easeOut" as const }
              }
              className={cn(
                "p-5 transition-all hover:translate-y-[-2px]",
                panelClass
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="flex size-11 items-center justify-center rounded-2xl border border-[rgba(29,122,95,0.14)] bg-[rgba(29,122,95,0.08)] text-[#1d7a5f]">
                  <item.icon className="size-5" aria-hidden />
                </span>
                <InfoTip content={item.hint} tone="warm" />
              </div>
              <div className="mt-6 flex items-end justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[#1c221d]">{item.label}</p>
                  <p className={cn("mt-1 text-xs uppercase tracking-[0.2em]", mutedTextClass)}>
                    {item.unit}
                  </p>
                </div>
                <p className="text-3xl font-semibold tracking-tight text-[#1c221d]">
                  {item.value}
                </p>
              </div>
            </motion.div>
          ))}
        </section>

        <section className={cn("p-5 md:p-8", panelClass)}>
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div className="max-w-xl">
              <div className="flex items-center gap-3">
                <span className={chipClass}>如何开始</span>
                <InfoTip content="三步进入工作台，开始推进第一条内容。" tone="warm" />
              </div>
              <ol className={cn("mt-4 space-y-2 text-sm leading-6", mutedTextClass)}>
                <li><span className="font-semibold text-[#1c221d]">① 打开工作台</span>，在机会列表里找一条高分机会（绿色标签"Deploy this week"）。</li>
                <li><span className="font-semibold text-[#1c221d]">② 点击机会卡片</span>，在右侧面板选择"生成 Brief"，等待 AI 输出结构化 brief。</li>
                <li><span className="font-semibold text-[#1c221d]">③ 继续推进</span>，依次生成 Draft 和 QA 清单，最后点击"导出"交付 Markdown 文件。</li>
              </ol>
            </div>
            <Link href="/workbench" className={primaryActionClass}>
              Open Workspace
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

const workflowSteps = [
  {
    num: "01",
    title: "机会导入",
    tag: "Notion Sync",
    desc: "从 Notion 数据库同步关键词组，按搜索量、竞争难度和业务匹配自动评分，生成可操作的优先级列表。",
  },
  {
    num: "02",
    title: "优先排队",
    tag: "Smart Queue",
    desc: "高分机会自动进入本周执行列表。不确定的条目进入复核通道，不会直接推入自动生产流程。",
  },
  {
    num: "03",
    title: "内容生产",
    tag: "AI Production",
    desc: "选中机会，一键生成 Brief、文章骨架和 QA 清单。从策略到交付，全程在同一个界面完成。",
  },
  {
    num: "04",
    title: "审校导出",
    tag: "Export Ready",
    desc: "人工复核完成后，一键导出 Markdown 文件，直接交付写作或对接发布工具。",
  },
];

function WorkflowSteps({
  reduceMotion,
}: {
  reduceMotion: boolean | null | undefined;
}) {
  return (
    <section className={cn("p-6 md:p-7", panelClass)}>
      <div className="flex items-center gap-3">
        <span className={chipClass}>工作流程</span>
        <InfoTip
          content="四个阶段组成完整的内容生产链路，所有操作在同一工作台内完成。"
          tone="warm"
        />
      </div>
      <div className="mt-5 space-y-3">
        {workflowSteps.map((step, index) => (
          <motion.div
            key={step.num}
            initial={reduceMotion ? false : { opacity: 0, x: 10 }}
            animate={reduceMotion ? false : { opacity: 1, x: 0 }}
            transition={
              reduceMotion
                ? undefined
                : { delay: index * 0.08, duration: 0.32, ease: "easeOut" as const }
            }
            className={cn("flex gap-4 p-4", softPanelClass)}
          >
            <span className="mt-0.5 shrink-0 text-xs font-bold tracking-[0.3em] text-[#1d7a5f]">
              {step.num}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-[#1c221d]">{step.title}</p>
                <span className="inline-flex rounded-full border border-[rgba(28,34,29,0.1)] px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#5e6860]">
                  {step.tag}
                </span>
              </div>
              <p className={cn("mt-1.5 text-xs leading-5", mutedTextClass)}>
                {step.desc}
              </p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}


function IconChip({
  icon: Icon,
  label,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  hint: string;
}) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.88)] px-3 py-2 text-xs text-[#1c221d]">
      <Icon className="size-3.5 text-[#1d7a5f]" aria-hidden />
      <span>{label}</span>
      <InfoTip content={hint} tone="warm" />
    </span>
  );
}
