import { Metadata } from "next";
import { requirePageRoleForPath } from "@/lib/auth/server";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { PromptSystemNav } from "@/components/prompt-system/prompt-system-nav";
import { InternalLinksTable } from "@/components/prompt-system/internal-links-table";
import { listInternalLinks } from "@/lib/supabase/prompt-system-repository";

type InternalLinks = Awaited<ReturnType<typeof listInternalLinks>>;

export const metadata: Metadata = { title: "Internal Links" };
export const dynamic = "force-dynamic";

const headerPanelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";

export default async function InternalLinksPage() {
  const access = await requirePageRoleForPath("viewer", "/prompt-system/internal-links");

  let links: InternalLinks = [];
  let loadError: string | null = null;

  try {
    links = await listInternalLinks();
  } catch (err) {
    loadError = err instanceof Error ? err.message : "加载数据时发生错误。";
  }

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
        <header className={`${headerPanelClass} mb-6 px-[22px] py-5`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[15px] font-semibold">Internal Link Library</div>
              <p className="mt-1 text-[12px] text-[#5e6860]">
                管理 Pexo 网站的内链库，供 AI 生成文案时自动引用。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <PromptSystemNav />
              <ProjectNavigation activeKey="promptSystem" variant="warm" />
              <UserMenu
                userEmail={access.user.email || ""}
                role={access.role}
                canManageUsers={access.permissions.canManageUsers}
              />
            </div>
          </div>
        </header>

        {loadError ? (
          <div className="rounded-[22px] border border-[rgba(178,72,63,0.2)] bg-[rgba(255,252,244,0.9)] p-6 text-[13px] text-[#b2483f]">
            {loadError}
          </div>
        ) : (
          <InternalLinksTable links={links} canEdit={access.permissions.canWrite} />
        )}
      </div>
    </div>
  );
}
