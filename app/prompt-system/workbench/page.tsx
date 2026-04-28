import { Metadata } from "next";
import { requirePageRoleForPath } from "@/lib/auth/server";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { PromptSystemNav } from "@/components/prompt-system/prompt-system-nav";
import { OutlineWorkbench } from "@/components/prompt-system/outline-workbench";
import { listPrompts } from "@/lib/supabase/prompt-system-repository";

export const metadata: Metadata = { title: "Outline Workbench" };
export const dynamic = "force-dynamic";

const headerPanelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";

export default async function WorkbenchPage() {
  const access = await requirePageRoleForPath("editor", "/prompt-system/workbench");

  const outlinePrompts = await listPrompts({ promptStep: "A_outline" }).catch(() => []);

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
        <header className={`${headerPanelClass} mb-6 px-[22px] py-5`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[15px] font-semibold">Outline Workbench</div>
              <p className="mt-1 text-[12px] text-[#5e6860]">
                输入关键词，选择 Outline Prompt，一键生成页面大纲。
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

        <OutlineWorkbench outlinePrompts={outlinePrompts} />
      </div>
    </div>
  );
}
