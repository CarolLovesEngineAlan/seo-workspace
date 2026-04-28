import { Metadata } from "next";
import { requirePageRoleForPath } from "@/lib/auth/server";
import { loadOpportunities } from "@/lib/data/load-opportunities";
import { WorkbenchOpportunity } from "@/lib/types/opportunity";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { AssetExplorer } from "@/components/brief-records/brief-records-explorer";

export const metadata: Metadata = {
  title: "内容资产",
};

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const headerPanelClass =
  "rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";
const panelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";
const pillClass =
  "rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.85)] px-3 py-1 text-[12px] text-[#5e6860]";

export default async function BriefRecordsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const access = await requirePageRoleForPath("viewer", "/brief-records");
  const params = await searchParams;
  const initialGroupId =
    typeof params.id === "string" ? params.id : null;

  let opportunities: WorkbenchOpportunity[] = [];
  let loadError: string | null = null;

  try {
    const { opportunities: all } = await loadOpportunities();
    opportunities = all.filter(
      (opp) => opp.briefMarkdown?.trim() || opp.articleDraftMarkdown?.trim()
    );
  } catch (err) {
    loadError =
      err instanceof Error ? err.message : "加载数据时发生未知错误。";
  }

  const briefCount = opportunities.filter((o) => o.briefMarkdown?.trim()).length;
  const draftCount = opportunities.filter((o) => o.articleDraftMarkdown?.trim()).length;

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto max-w-[1540px] px-4 py-6 md:px-6">
        <header className={`${headerPanelClass} mb-[18px] px-[22px] py-4`}>
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[15px] font-semibold">内容资产库</div>
              <p className="mt-1 text-[12px] text-[#5e6860]">
                查看和修订每条关键词对应的文章大纲与初稿内容。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectNavigation activeKey="briefRecords" variant="warm" />
              <UserMenu
                userEmail={access.user.email || ""}
                role={access.role}
                canManageUsers={access.permissions.canManageUsers}
              />
              {!loadError && (
                <>
                  <span className={pillClass}>{briefCount} 篇大纲</span>
                  <span className={pillClass}>{draftCount} 篇初稿</span>
                </>
              )}
            </div>
          </div>
        </header>

        {loadError ? (
          <section className={panelClass}>
            <div className="px-5 py-10 text-center text-[13px] leading-[1.8] text-[#b2483f]">
              {loadError}
            </div>
          </section>
        ) : (
          <AssetExplorer
            opportunities={opportunities}
            initialGroupId={initialGroupId}
            canEdit={access.permissions.canWrite}
          />
        )}
      </div>
    </div>
  );
}
