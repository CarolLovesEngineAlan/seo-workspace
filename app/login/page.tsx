import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  Radar,
  Sparkles,
  Waypoints,
} from "lucide-react";
import { BrandMark } from "@/components/brand/brand-mark";
import { EmailSignInForm } from "@/components/auth/email-sign-in-form";
import { LogoutButton } from "@/components/auth/logout-button";
import { normalizeNextPath } from "@/lib/auth/next-path";
import { getAccessContext } from "@/lib/auth/server";
import { getSupabaseAuthConfigError, isSupabaseAuthConfigured } from "@/lib/supabase/auth-config";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const highlights = [
  {
    icon: Radar,
    title: "Live Opportunity Radar",
    description: "Track search demand, group related queries, and stay close to what matters now.",
  },
  {
    icon: Waypoints,
    title: "Priority Queue",
    description: "Keep strategy decisions visible, shared, and ready for execution.",
  },
  {
    icon: Sparkles,
    title: "AI Production Layer",
    description: "Move from brief to draft and QA in one focused production flow.",
  },
] as const;

function getSingleValue(
  value: string | string[] | undefined
): string | undefined {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const next = normalizeNextPath(getSingleValue(params.next));
  const error = getSingleValue(params.error)?.trim() || null;
  const access = await getAccessContext();
  const authConfigError = getSupabaseAuthConfigError();

  if (access?.role) {
    redirect(next);
  }

  const loginUnavailable = !isSupabaseAuthConfigured() || Boolean(authConfigError);

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.24),transparent),radial-gradient(ellipse_42%_44%_at_92%_10%,rgba(29,122,95,0.12),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_52%,#ede8da_100%)] px-4 py-8 text-[#1c221d] md:px-6">
      <div className="mx-auto flex min-h-[84vh] max-w-[1180px] items-center justify-center">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1.14fr)_430px]">
          <section className="relative overflow-hidden rounded-[34px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] p-8 shadow-[0_24px_60px_rgba(44,38,22,0.11)] md:p-10">
            <div
              className="pointer-events-none absolute inset-x-10 top-0 h-40 rounded-full bg-[radial-gradient(circle,rgba(29,122,95,0.12),transparent_68%)]"
              aria-hidden
            />

            <div className="flex items-center gap-3">
              <BrandMark className="size-12" />
              <div>
                <div className="text-[13px] font-medium uppercase tracking-[0.16em] text-[#1d7a5f]">
                  Editorial Operating Layer
                </div>
                <div className="mt-1 text-[18px] font-semibold">SEO Opportunity Workspace</div>
              </div>
            </div>

            <div className="mt-10 max-w-3xl space-y-4">
              <h1 className="text-4xl font-semibold tracking-[-0.04em] md:text-6xl md:leading-[1.02]">
                Turn demand into
                <br className="hidden sm:block" />
                focused momentum.
              </h1>
              <p className="max-w-2xl text-[15px] leading-7 text-[#5e6860] md:text-[17px]">
                A calm operating layer for opportunity discovery, production planning,
                structured briefs, and delivery-ready output.
              </p>
            </div>

            <div className="mt-8 grid gap-3 md:grid-cols-3">
              {highlights.map((item) => {
                const Icon = item.icon;

                return (
                  <div
                    key={item.title}
                    className="rounded-[22px] border border-[rgba(28,34,29,0.08)] bg-[rgba(255,255,255,0.72)] p-4 shadow-[0_12px_28px_rgba(44,38,22,0.06)]"
                  >
                    <div className="flex size-10 items-center justify-center rounded-2xl border border-[rgba(29,122,95,0.14)] bg-[rgba(29,122,95,0.08)] text-[#1d7a5f]">
                      <Icon className="size-5" aria-hidden />
                    </div>
                    <div className="mt-4 text-[15px] font-semibold text-[#1c221d]">
                      {item.title}
                    </div>
                    <p className="mt-2 text-[13px] leading-6 text-[#5e6860]">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 rounded-[24px] border border-[rgba(28,34,29,0.08)] bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(244,240,230,0.68)_100%)] p-5">
              <div className="flex flex-wrap items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#5e6860]">
                <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] px-3 py-1">
                  synced context
                </span>
                <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] px-3 py-1">
                  structured briefs
                </span>
                <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] px-3 py-1">
                  export ready
                </span>
              </div>
              <div className="mt-4 flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-[#1d7a5f]" aria-hidden />
                <p className="text-[14px] leading-7 text-[#5e6860]">
                  Designed for teams who want strategy, production, and review to
                  feel like one continuous motion.
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-[34px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.94)] p-8 shadow-[0_24px_60px_rgba(44,38,22,0.11)]">
            <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#1d7a5f]">
              Continue
            </div>
            <h2 className="mt-4 text-[30px] font-semibold tracking-[-0.03em]">
              Enter the workspace
            </h2>
            <p className="mt-3 text-[14px] leading-7 text-[#5e6860]">
              输入邮箱，我们会发送一个登录链接。
            </p>

            {loginUnavailable ? (
              <div className="mt-8 rounded-[20px] border border-[rgba(178,72,63,0.18)] bg-[rgba(255,245,244,0.88)] px-4 py-4 text-[13px] leading-7 text-[#b2483f]">
                登录暂时不可用，请稍后再试。
              </div>
            ) : null}

            {access?.user ? (
              <div className="mt-8 space-y-4">
                <div className="rounded-[20px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.74)] px-4 py-4 text-[14px] leading-7 text-[#1c221d]">
                  <div className="font-medium">该账号暂无访问权限。</div>
                  <div className="mt-2 text-[#5e6860]">
                    邮箱已验证，但尚未被授权进入工作台。
                  </div>
                  <div className="mt-3 text-[13px] text-[#5e6860]">{access.user.email}</div>
                </div>
                <LogoutButton className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.78)] px-5 text-[14px] font-medium text-[#1c221d]" />
              </div>
            ) : (
              <div className="mt-8">
                {!loginUnavailable && <EmailSignInForm next={next} />}
              </div>
            )}

            <div className="mt-10 flex items-center justify-between gap-3 border-t border-[rgba(28,34,29,0.08)] pt-5">
              <div className="text-[12px] uppercase tracking-[0.18em] text-[#7b837d]">
                calm, structured, delivery-ready
              </div>
              <Link
                href="/"
                className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1d7a5f]"
              >
                <span>Back to overview</span>
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
