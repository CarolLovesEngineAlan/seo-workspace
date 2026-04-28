-- Notion -> Supabase 的 seo_page_opportunities 快照表。
-- /workbench 与 /api/opportunities 从该表读取基础机会数据，再与 seo_opportunity_supplements 合并 workflow 字段。
-- 本文件可重复执行；若表已存在，会补齐缺失列与索引。
create table if not exists public.seo_page_opportunities (
  group_id text primary key,
  main_keyword text not null default '',
  all_keywords text not null default '',
  keyword_variants text not null default '',
  topic_cluster_name text not null default '',
  intent text not null default '',
  resolved_content_type text not null default '',
  content_type_source text not null default '',
  volume integer not null default 0,
  kd double precision not null default 0,
  variant_count integer not null default 0,
  internal_link_role text not null default '',
  page_brief text not null default '',
  source_urls jsonb not null default '[]'::jsonb,
  source_keyword_rows jsonb not null default '[]'::jsonb,
  needs_review boolean not null default false,
  opportunity_score integer not null default 0,
  row_count integer not null default 0,
  pipeline_status text not null default 'inbox'
    check (pipeline_status in ('inbox', 'in_queue', 'in_production', 'shipped')),
  production_stage text not null default 'none'
    check (production_stage in ('none', 'brief', 'draft', 'qa', 'done')),
  brief_markdown text,
  article_draft_markdown text,
  why_now text,
  synced_at timestamptz not null default now()
);

alter table public.seo_page_opportunities
  add column if not exists source_keyword_rows jsonb not null default '[]'::jsonb;

create index if not exists idx_seo_page_opportunities_score
  on public.seo_page_opportunities (opportunity_score desc);

create index if not exists idx_seo_page_opportunities_pipeline
  on public.seo_page_opportunities (pipeline_status);

create index if not exists idx_seo_page_opportunities_synced_at
  on public.seo_page_opportunities (synced_at desc);

comment on table public.seo_page_opportunities is 'Notion 夜间/手动同步快照；/workbench 与 /api/opportunities 从该表读取基础机会数据，再与 seo_opportunity_supplements 合并 workflow 结果。';
comment on column public.seo_page_opportunities.source_keyword_rows is '同一个 same_page_group_id 下的源关键词行快照，用于 Strategy Queue 选择 MAIN_KEYWORD。';
