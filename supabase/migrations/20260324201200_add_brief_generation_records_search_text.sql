create extension if not exists pg_trgm;

alter table if exists public.seo_brief_generation_records
  add column if not exists search_text text not null default '';

update public.seo_brief_generation_records
set search_text = trim(
  regexp_replace(
    concat_ws(
      ' ',
      group_id,
      coalesce(model, ''),
      coalesce(input_main_keywords::text, ''),
      coalesce(input_content_types::text, ''),
      coalesce(input_intents::text, ''),
      coalesce(input_keyword_variants::text, ''),
      coalesce(input_topic_cluster_names::text, ''),
      coalesce(input_internal_link_roles::text, ''),
      coalesce(input_page_briefs::text, ''),
      coalesce(brief_markdown, '')
    ),
    '\s+',
    ' ',
    'g'
  )
)
where coalesce(search_text, '') = '';

create index if not exists idx_seo_brief_generation_records_created_at
  on public.seo_brief_generation_records (created_at desc);

create index if not exists idx_seo_brief_generation_records_search_text
  on public.seo_brief_generation_records
  using gin (search_text gin_trgm_ops);
