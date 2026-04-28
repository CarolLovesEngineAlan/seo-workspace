-- 仅存工作台 / 生成物 / 后续 AI 分析；与 Notion 中的机会数据按 group_id 关联，不在此复制 volume 等指标。
create table if not exists public.seo_opportunity_supplements (
  group_id text primary key,
  pipeline_status text not null default 'inbox'
    check (pipeline_status in ('inbox', 'in_queue', 'in_production', 'shipped')),
  production_stage text not null default 'none'
    check (production_stage in ('none', 'brief', 'draft', 'qa', 'done')),
  brief_markdown text,
  article_draft_markdown text,
  why_now text,
  updated_at timestamptz not null default now()
);

create index if not exists idx_seo_opportunity_supplements_pipeline
  on public.seo_opportunity_supplements (pipeline_status);

comment on table public.seo_opportunity_supplements is 'Notion 外持久化：队列状态、Brief/草稿/why_now 及后续 AI 结果；主数据从 seo_page_opportunities 读';
