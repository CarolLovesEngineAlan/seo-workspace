# SEO Opportunity Workspace

Next.js 16（App Router）+ React 19 + TypeScript + **Tailwind CSS v4** + **shadcn/ui** + **Motion**。MVP 目标见仓库内 `PRD.md`、`arc.md`、`field-spec.md`。

## 本地开发

```bash
npm install
npm run dev
```

浏览器打开 [http://localhost:3000](http://localhost:3000)。

## 环境变量

复制 `.env.example` 为 `.env`（本仓库可按团队约定直接提交 `.env`）。部署到 Vercel 时需在控制台同步配置同名变量。

## 数据流

- **Notion**：关键词库真源；同步任务会拉取数据库、按 `same_page_group_id` 聚合并打分。
- **Supabase `seo_page_opportunities`**：Notion 的快照表；`GET /api/opportunities` 与 `/workbench` 默认从这里读取基础机会数据。
- **Supabase `seo_opportunity_supplements`**：工作台 workflow 状态、Brief/草稿/why_now 等扩展字段，按 `group_id` 与快照表合并。
- **Supabase `seo_brief_generation_records`**：每次 brief 生成时的输入快照（`content_type / intent / main_keyword / keyword_variants / topic_cluster_name / internal_link_role / page_brief`）与输出 Markdown。
- **OpenAI（用于 brief_v2）**：`OPENAI_API_KEY` 用于根据所选 `MAIN_KEYWORD`、[`brief-spec-by-content-type.md`](doc/brief-spec-by-content-type.md) 规范文档和 [`brief-generation-prompt.md`](doc/brief-generation-prompt.md) 指令文档生成真实 brief。

在 Supabase SQL Editor 中执行：

- [`supabase/migrations/20250324120000_page_opportunities.sql`](supabase/migrations/20250324120000_page_opportunities.sql)
- [`supabase/migrations/20250324130000_opportunity_supplements.sql`](supabase/migrations/20250324130000_opportunity_supplements.sql)（推荐）
- [`supabase/migrations/20260324120000_brief_generation_records.sql`](supabase/migrations/20260324120000_brief_generation_records.sql)
- [`supabase/migrations/20260324123000_extend_brief_generation_records_inputs.sql`](supabase/migrations/20260324123000_extend_brief_generation_records_inputs.sql)
- [`supabase/migrations/20260324201200_add_brief_generation_records_search_text.sql`](supabase/migrations/20260324201200_add_brief_generation_records_search_text.sql)
- [`supabase/migrations/20260325093000_create_user_roles.sql`](supabase/migrations/20260325093000_create_user_roles.sql)

当前 migrations 已直接使用 `seo_` 前缀表名，后续维护只需要围绕这些原始 migration 即可。

环境变量：

- `SUPABASE_URL` 或 `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID`
- `SUPABASE_SERVICE_ROLE_KEY`
- `AUTH_ADMIN_EMAILS`
- `OPENAI_API_KEY`

可选 `OPENAI_BRIEF_MODEL` 覆盖默认模型；若本机外网需走代理，可设置 `OPENAI_HTTP_PROXY`（例如 Clash 默认 `http://127.0.0.1:7890`）；若本机网络无法直连 `api.openai.com`，也可通过 `OPENAI_BASE_URL` 指向兼容 OpenAI Responses API 的网关基础地址（例如 `https://your-gateway.example.com/v1`）。

## 登录与权限

工作台、Brief Records 与写接口现在默认受 Supabase Auth 保护，不再对匿名访问暴露数据。

Supabase 需要额外完成以下配置：

1. 在 `Authentication -> Providers` 中启用 `Google`
2. 在 `Authentication -> URL Configuration` 中配置站点地址，例如本地开发 `http://localhost:3000`
3. 在 `Authentication -> URL Configuration` 中添加 OAuth 回调地址 `http://localhost:3000/auth/callback`
4. 线上环境补充对应域名的 `/auth/callback`
5. 若要启用 Google One Tap，在 `.env` 中补充 `NEXT_PUBLIC_GOOGLE_CLIENT_ID`

生产环境建议明确配置：

- `Site URL`：`https://seo-automatic.vercel.app`
- `Redirect URLs`：至少包含 `https://seo-automatic.vercel.app/auth/callback` 与 `http://localhost:3000/auth/callback`
- 如果使用 Vercel Preview，可额外加 `https://*-your-project.vercel.app/auth/callback`

如果 `Site URL` 仍然是 `http://localhost:3000`，或者线上 `/auth/callback` 不在 `Redirect URLs` 白名单里，Google OAuth 很容易在成功后回落到 localhost。

Google 账号选择页里显示 `*.supabase.co` 是 Supabase 托管 OAuth 的默认表现，不是前端按钮文案问题；如果必须显示你自己的域名，需要给 Supabase Auth 配置自定义域名。

角色模型：

- `viewer`：可查看 Workbench 与 Brief Records
- `editor`：在 `viewer` 基础上可生成 brief、编辑 markdown、推进生产流程
- `admin`：在 `editor` 基础上可访问 `/admin/access` 管理用户角色

接入步骤：

1. 执行 [`supabase/migrations/20260325093000_create_user_roles.sql`](supabase/migrations/20260325093000_create_user_roles.sql)
2. 在 `.env` 或 `.env.local` 中配置 `NEXT_PUBLIC_SUPABASE_ANON_KEY` 与 `AUTH_ADMIN_EMAILS`
3. 白名单邮箱首次通过 Google 登录后会自动成为 `admin`
4. 管理员进入 `/admin/access` 为其他登录用户授予 `viewer / editor / admin`

本地开发可直接参考 [.env.local.example](/Users/jeek/Documents/code/github/seo-automatic/.env.local.example)。`localhost` 回调默认会自动使用当前站点 origin，不需要额外 env。

如果登录时报错 `Unsupported provider: provider is not enabled`，表示 Google provider 尚未在 Supabase 开启，不是前端回调地址拼错。

如果登录阶段报 `timeout`、`timed out`、`fetch failed` 或长时间卡住，优先检查这几项：

1. `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_URL` 是否指向正确项目，且本机能访问该域名
2. `NEXT_PUBLIC_SUPABASE_ANON_KEY` 是否为当前项目的 anon/public key，而不是 service role key
3. Supabase 项目是否处于暂停、限流或所在网络对 Supabase 域名有限制
4. 若本机需代理才能访问外网，先确认浏览器本身能正常打开你的 Supabase 项目域名

## 定时任务（Cron）与 `/api/sync/notion`

- 配置见根目录 `vercel.json`。当前为每日 UTC `0 16 * * *`，对应北京时间 `00:00` 执行一次夜间同步。
- `GET /api/cron/notion-sync` 与 `GET`/`POST /api/sync/notion` 需 `Authorization: Bearer <CRON_SECRET>`。
- `syncNotionToSupabase()` 会执行完整的 Notion -> Supabase 快照同步：upsert `seo_page_opportunities`，并清理已从 Notion 删除的旧快照记录。

## 工作台 API

- `GET /api/opportunities`：读取聚合机会列表，需 `viewer`
- `PATCH /api/opportunities/[groupId]`：`{"pipelineStatus":"in_queue"}` 或 `productionStage`，需 `editor`
- `POST /api/opportunities/[groupId]/generate`：`{"kind":"brief"|"draft"|"why_now"|"qa"|"export","selectedKeywordIds?:string[]"}`；生成结果写入扩展表，`brief` 还会额外写入 `seo_brief_generation_records`，需 `editor`
- `GET /api/opportunities/[groupId]/brief-records`：读取该 `same_page_group_id` 的 brief 生成记录，需 `viewer`
- `PATCH /api/brief-records/[recordId]`：`{"briefMarkdown":"..."}`；更新单条 brief record 的 Markdown，并同步刷新搜索字段，需 `editor`
- `PATCH /api/admin/user-roles/[userId]`：更新单个用户角色，需 `admin`

## 静态原型

根目录下的 `prototype.html`、`keyword-opportunity-view.html` 为早期 HTML 原型，与 App 并存，可逐步迁移到 `app/`。
