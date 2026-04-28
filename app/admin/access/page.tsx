import Link from "next/link";
import { AccessManager } from "@/components/auth/access-manager";
import { UserMenu } from "@/components/auth/user-menu";
import { NotionSyncButton } from "@/components/auth/notion-sync-button";
import { listManagedUsers } from "@/lib/auth/admin";
import { requirePageRoleForPath } from "@/lib/auth/server";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Access Control",
};

const roleGuides = [
  {
    role: "viewer",
    summary: "适合只需要查看机会与记录的成员。",
    permissions: "可访问 Workbench 与 Brief Records，但不能生成内容、编辑 Markdown 或推进流程。",
  },
  {
    role: "editor",
    summary: "适合参与生产推进与内容整理的成员。",
    permissions: "在 viewer 基础上，可生成 brief、编辑 Markdown、更新 pipeline 与 production 状态。",
  },
  {
    role: "admin",
    summary: "适合负责权限治理与系统维护的成员。",
    permissions: "在 editor 基础上，可访问 Access Control 并为其他用户分配或移除角色。",
  },
] as const;

export default async function AccessControlPage() {
  const access = await requirePageRoleForPath("admin", "/admin/access");
  const users = await listManagedUsers();

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_60%_40%_at_8%_0%,rgba(218,188,96,0.24),transparent),radial-gradient(ellipse_42%_44%_at_92%_10%,rgba(29,122,95,0.12),transparent),linear-gradient(180deg,#ede6d0_0%,#f2ebd8_52%,#ede8da_100%)] px-4 py-8 text-[#1c221d] md:px-6">
      <div className="mx-auto max-w-[1240px]">
        <header className="mb-5 rounded-[28px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.9)] px-6 py-5 shadow-[0_20px_60px_rgba(44,38,22,0.11)]">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[15px] font-semibold uppercase tracking-[0.16em] text-[#1d7a5f]">
                Access Control
              </div>
              <h1 className="mt-2 text-3xl font-semibold tracking-[-0.03em]">
                用户权限管理
              </h1>
              <p className="mt-2 text-[14px] leading-7 text-[#5e6860]">
                通过 Google 登录后的用户会出现在这里。未授予角色的账号无法访问业务数据。
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/workbench"
                className="inline-flex h-11 items-center rounded-full border border-[rgba(28,34,29,0.12)] bg-[rgba(255,255,255,0.78)] px-5 text-[14px] font-medium text-[#1c221d]"
              >
                返回 Workbench
              </Link>
              <UserMenu
                userEmail={access.user.email || ""}
                role={access.role}
                canManageUsers={access.permissions.canManageUsers}
              />
            </div>
          </div>
        </header>

        <section className="rounded-[28px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.92)] p-5 shadow-[0_20px_60px_rgba(44,38,22,0.11)] md:p-6">
          <div className="mb-4 flex flex-wrap items-center gap-2 text-[13px] text-[#5e6860]">
            <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.88)] px-3 py-1">
              {users.length} users
            </span>
            <span className="rounded-full border border-[rgba(28,34,29,0.1)] bg-[rgba(244,240,230,0.88)] px-3 py-1">
              roles: viewer / editor / admin
            </span>
          </div>

          <div className="mb-5 grid gap-3 lg:grid-cols-3">
            {roleGuides.map((item) => (
              <div
                key={item.role}
                className="rounded-[20px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,255,255,0.72)] p-4"
              >
                <div className="text-[12px] font-medium uppercase tracking-[0.18em] text-[#1d7a5f]">
                  {item.role}
                </div>
                <div className="mt-2 text-[15px] font-semibold text-[#1c221d]">
                  {item.summary}
                </div>
                <p className="mt-2 text-[13px] leading-6 text-[#5e6860]">
                  {item.permissions}
                </p>
              </div>
            ))}
          </div>

          <AccessManager users={users} currentUserId={access.user.id} />
        </section>

        <section className="mt-5 rounded-[28px] border border-[rgba(28,34,29,0.1)] bg-[rgba(255,252,244,0.92)] p-5 shadow-[0_20px_60px_rgba(44,38,22,0.11)] md:p-6">
          <div className="mb-4">
            <div className="text-[14px] font-semibold text-[#1c221d]">数据同步</div>
            <p className="mt-1 text-[13px] leading-6 text-[#5e6860]">
              手动将 Notion 数据库同步到 Supabase 快照。通常由定时任务自动执行，此处用于临时触发。
            </p>
          </div>
          <NotionSyncButton />
        </section>
      </div>
    </div>
  );
}
