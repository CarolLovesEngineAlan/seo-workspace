create extension if not exists pgcrypto;

create table if not exists public.seo_brief_generation_records (
  id uuid primary key default gen_random_uuid(),
  group_id text not null,
  selected_row_ids jsonb not null default '[]'::jsonb,
  input_main_keywords jsonb not null default '[]'::jsonb,
  input_content_types jsonb not null default '[]'::jsonb,
  input_keyword_variants jsonb not null default '[]'::jsonb,
  brief_markdown text not null,
  model text,
  created_at timestamptz not null default now()
);

create index if not exists idx_seo_brief_generation_records_group_created
  on public.seo_brief_generation_records (group_id, created_at desc);

comment on table public.seo_brief_generation_records is '每次 brief 生成的输入快照与输出 Markdown，用于生产追踪与复盘';
