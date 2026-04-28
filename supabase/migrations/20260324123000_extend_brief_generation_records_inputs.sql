alter table if exists public.seo_brief_generation_records
  add column if not exists input_intents jsonb not null default '[]'::jsonb,
  add column if not exists input_topic_cluster_names jsonb not null default '[]'::jsonb,
  add column if not exists input_internal_link_roles jsonb not null default '[]'::jsonb,
  add column if not exists input_page_briefs jsonb not null default '[]'::jsonb;
