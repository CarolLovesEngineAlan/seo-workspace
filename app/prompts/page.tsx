import { Metadata } from "next";

import { requirePageRoleForPath } from "@/lib/auth/server";
import { ProjectNavigation } from "@/components/navigation/project-navigation";
import { UserMenu } from "@/components/auth/user-menu";
import { PromptManager } from "@/components/prompts/prompt-manager";

export const metadata: Metadata = {
  title: "Prompt 管理",
};

const headerPanelClass =
  "overflow-hidden rounded-[24px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] shadow-[0_20px_60px_rgba(44,38,22,0.11)]";

export default async function PromptLibraryPage() {
  const access = await requirePageRoleForPath("editor", "/prompts");

  return (
    <div className="min-h-full bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.22),transparent),radial-gradient(ellipse_40%_50%_at_92%_10%,rgba(29,122,95,0.1),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_50%,#ede8da_100%)] text-[#1c221d]">
      <div className="mx-auto max-w-[1480px] px-4 py-6 md:px-6">
        <header className={`${headerPanelClass} mb-6 px-[22px] py-5`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-[15px] font-semibold">Prompt 管理</div>
              <p className="mt-1 text-[12px] text-[#5e6860]">
                统一管理 doc 目录下的 prompt 模板，并维护自定义 prompt，用于内容生成调用。
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <ProjectNavigation activeKey="promptSystem" variant="warm" />
              <UserMenu
                userEmail={access.user.email || ""}
                role={access.role}
                canManageUsers={access.permissions.canManageUsers}
              />
            </div>
          </div>
        </header>

        <PromptManager canEdit={access.permissions.canWrite} />
      </div>
    </div>
  );
}
