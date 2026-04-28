import { UserMenu } from "@/components/auth/user-menu";
import { requirePageRoleForPath } from "@/lib/auth/server";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
// V1 → workspace-unified  V2 → workspace-v2  V3 → workspace-v3  (切换只改这一行)
import { WorkspaceV3 as WorkspaceUnified } from "@/components/workbench/workspace-v3";
import { loadOpportunities } from "@/lib/data/load-opportunities";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "SEO Opportunity Workspace",
};

export default async function WorkbenchPage() {
  const access = await requirePageRoleForPath("viewer", "/workbench");
  let errorMessage: string | null = null;
  let opportunities: Awaited<ReturnType<typeof loadOpportunities>>["opportunities"] =
    [];
  let supplementLoadError: string | null = null;
  let dataSource: Awaited<ReturnType<typeof loadOpportunities>>["source"] =
    "fallback";
  let sourceError: string | null = null;

  try {
    const loaded = await loadOpportunities();
    opportunities = loaded.opportunities;
    supplementLoadError = loaded.supplementLoadError;
    dataSource = loaded.source;
    sourceError = loaded.sourceError;
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  const supabaseConfigured = isSupabaseConfigured();
  const supabaseMode = dataSource === "supabase" && supabaseConfigured;

  if (errorMessage) {
    return (
      <div className="min-h-screen min-h-[100dvh] bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] px-4 py-8 text-[#1c221d] md:px-6">
        <div className="mx-auto max-w-[960px]">
          <div className="mb-4 flex flex-wrap items-center justify-end gap-3">
            <ProjectNavigation activeKey="workbench" variant="warm" />
            <UserMenu
              userEmail={access.user.email || ""}
              role={access.role}
              canManageUsers={access.permissions.canManageUsers}
            />
          </div>
        </div>
        <div className="mx-auto max-w-[960px] rounded-[24px] border border-[rgba(178,72,63,0.18)] bg-[rgba(255,252,244,0.9)] p-6 shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
          <h1 className="text-xl font-semibold">无法加载机会工作台</h1>
          <p className="mt-3 text-sm leading-7 text-[#5e6860]">{errorMessage}</p>
          <div className="mt-4 rounded-[18px] border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-4 py-3 text-sm leading-7 text-[#5e6860]">
            {supabaseConfigured ? (
              <>
                请确认已执行
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  supabase/migrations/20250324130000_opportunity_supplements.sql
                </code>
                与
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  supabase/migrations/20260324120000_brief_generation_records.sql
                </code>
                与
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  supabase/migrations/20260324123000_extend_brief_generation_records_inputs.sql
                </code>
                且
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  SUPABASE_URL
                </code>
                与
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  SUPABASE_SERVICE_ROLE_KEY
                </code>
                以及
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  OPENAI_API_KEY
                </code>
                正确。
              </>
            ) : (
              <>
                请检查
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  .env
                </code>
                中的
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  NOTION_API_KEY
                </code>
                与
                <code className="mx-1 text-[12px] text-[#1c221d]">
                  NOTION_DATABASE_ID
                </code>
                是否正确。
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <WorkspaceUnified
      opportunities={opportunities}
      supabaseMode={supabaseMode}
      dataSource={dataSource}
      sourceError={sourceError}
      supplementLoadError={supplementLoadError}
      authRole={access.role}
      userEmail={access.user.email || ""}
      canWrite={access.permissions.canWrite}
      canManageUsers={access.permissions.canManageUsers}
    />
  );
}
