-- Prompt Management System tables
-- 3 tables: seo_ps_brand_context, seo_ps_prompts, seo_ps_internal_links
-- 本文件可重复执行；若表已存在，会补齐缺失列与索引。

-- ────────────────────────────────────────────────────────────
-- ENUMs
-- ────────────────────────────────────────────────────────────

do $$ begin
  create type public.ps_page_type as enum (
    'feature_page',
    'use_case_page',
    'blog_howto',
    'blog_top_review',
    'blog_tips',
    'blog_product_review'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.ps_prompt_step as enum (
    'A_outline',
    'B_copy'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.ps_recommended_model as enum (
    'claude_sonnet',
    'claude_opus',
    'gpt4o_mini'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.ps_page_category as enum (
    'feature',
    'use_case',
    'model',
    'guide',
    'blog',
    'other'
  );
exception
  when duplicate_object then null;
end $$;

do $$ begin
  create type public.ps_link_priority as enum (
    'high',
    'medium',
    'low'
  );
exception
  when duplicate_object then null;
end $$;

-- ────────────────────────────────────────────────────────────
-- Table 1: seo_ps_brand_context  (single-row config)
-- ────────────────────────────────────────────────────────────

create table if not exists public.seo_ps_brand_context (
  id                      uuid primary key default gen_random_uuid(),
  product_name            text not null default 'Pexo',
  product_positioning     text not null default '',
  capabilities_summary    text not null default '',
  supported_platforms     text[] not null default '{}',
  ai_models_used          text[] not null default '{}',
  pricing_info            text not null default '',
  brand_voice             text not null default '',
  expression_rules        text not null default '',
  banned_words            text[] not null default '{}',
  pexo_mention_density    text not null default '',
  competitive_positioning jsonb not null default '{}'::jsonb,
  version                 text not null default 'v1.0',
  updated_at              timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- Table 2: seo_ps_prompts
-- ────────────────────────────────────────────────────────────

create table if not exists public.seo_ps_prompts (
  id                    uuid primary key default gen_random_uuid(),
  name                  text not null,
  page_type             public.ps_page_type not null,
  prompt_step           public.ps_prompt_step not null,
  prompt_text           text not null default '',
  required_variables    jsonb not null default '[]'::jsonb,
  example_variable_set  text not null default '',
  recommended_model     public.ps_recommended_model not null default 'claude_sonnet',
  use_cache             boolean not null default false,
  version               text not null default 'v1.0',
  notes                 text not null default '',
  brand_context_id      uuid references public.seo_ps_brand_context(id) on delete set null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists seo_ps_prompts_page_type_idx on public.seo_ps_prompts(page_type);
create index if not exists seo_ps_prompts_step_idx      on public.seo_ps_prompts(prompt_step);

-- ────────────────────────────────────────────────────────────
-- Table 3: seo_ps_internal_links
-- ────────────────────────────────────────────────────────────

create table if not exists public.seo_ps_internal_links (
  id                      uuid primary key default gen_random_uuid(),
  page_title              text not null,
  url                     text not null,
  page_category           public.ps_page_category not null,
  primary_keyword         text not null default '',
  anchor_text_suggestions text[] not null default '{}',
  link_priority           public.ps_link_priority not null default 'medium',
  last_verified           timestamptz,
  created_at              timestamptz not null default now()
);

create index if not exists seo_ps_internal_links_category_idx on public.seo_ps_internal_links(page_category);
create index if not exists seo_ps_internal_links_priority_idx on public.seo_ps_internal_links(link_priority);

-- ────────────────────────────────────────────────────────────
-- Seed: Brand Context (single row)
-- ────────────────────────────────────────────────────────────

insert into public.seo_ps_brand_context (
  product_name, product_positioning, capabilities_summary,
  supported_platforms, ai_models_used, pricing_info,
  brand_voice, expression_rules, banned_words,
  pexo_mention_density, competitive_positioning, version
) values (
  'Pexo',
  'Pexo is the first AI video agent that creates with you, not a tool you operate on. Instead of writing prompts or learning complex editing software, users simply describe their video idea in natural language. Pexo interprets intent, suggests creative directions, selects the best AI models behind the scenes, and delivers a complete, polished video.',
  'Smart script generation from raw text; AI voice & lip-sync (audio as part of production, not afterthought); Visual style control (applied as creative direction, not filter); Camera direction (natural language camera commands); Multi-scene continuity (character/setting/plot consistency); Reference-based creation (image/clip + text to video); Auto model selection from multiple leading models.',
  ARRAY['Telegram', 'WhatsApp', 'Discord', 'Web App'],
  ARRAY['Seedance', 'Kling', 'Sora'],
  'Free starter plan with starter credits, no credit card required. 3 bonus projects on first registration. 1 free project daily.',
  'Confident but not hype-y. Conversational — like a knowledgeable friend making a recommendation. Write like you genuinely understand what makes this creative niche exciting and what challenges creators face.',
  'NEVER use possessive forms like ''Pexo''s [keyword] generator''. ALWAYS use phrasing like ''Pexo acts / works / serves / functions / operates as a [keyword] generator'' and natural variations. Pexo is a partner that thinks with you, not a tool you configure.',
  ARRAY['revolutionary', 'cutting-edge', 'unleash', 'unlock', 'game-changing', 'seamlessly', 'elevate your content', 'harness the power of', 'in today''s fast-paced world'],
  'Landing pages: per feature row as appropriate. Blog articles: 30-40% of sections, not every section. Introduction: 0-1 mentions. Conclusion: 1 soft CTA.',
  '{
    "vs_heygen": "Pexo is conversational, HeyGen is form-based. HeyGen focuses on avatar/talking-head videos, Pexo handles full video production.",
    "vs_invideo": "Pexo auto-selects models, InVideo requires manual selection. Pexo works in messaging apps, InVideo is web-only.",
    "vs_runway": "Pexo handles end-to-end production including script/voiceover, Runway is single-clip generation focused on visual quality.",
    "vs_viggle": "Viggle requires template or reference video for dance, Pexo generates from text description. Viggle has no audio integration or multi-scene support.",
    "vs_imagineart": "ImagineArt requires detailed prompts and manual model selection, Pexo uses conversational interface with auto model selection."
  }'::jsonb,
  'v1.0'
) on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- Seed: Prompts (9 records, prompt_text left empty)
-- ────────────────────────────────────────────────────────────

insert into public.seo_ps_prompts (name, page_type, prompt_step, recommended_model, use_cache, version, required_variables)
values
  (
    'Feature Page — Outline',
    'feature_page', 'A_outline', 'claude_sonnet', true, 'v1.0',
    '[{"name":"primary_keyword","description":"Main SEO keyword","example":"text to video"},{"name":"keyword_variants","description":"Comma-separated variants","example":"text to video generator, ai text to video"}]'::jsonb
  ),
  (
    'Feature Page — Copy',
    'feature_page', 'B_copy', 'claude_opus', true, 'v1.0',
    '[{"name":"outline","description":"Full outline from Prompt A","example":"(paste outline)"}]'::jsonb
  ),
  (
    'Use Case Page — Outline',
    'use_case_page', 'A_outline', 'claude_sonnet', true, 'v1.0',
    '[{"name":"primary_keyword","description":"Main keyword","example":"ai dance video generator"},{"name":"keyword_variants","description":"Variants","example":"ai dance video, dance video maker"},{"name":"competitor_notes","description":"Competitor analysis","example":"Viggle AI is the main competitor..."}]'::jsonb
  ),
  (
    'Use Case Page — Copy',
    'use_case_page', 'B_copy', 'claude_opus', true, 'v1.0',
    '[{"name":"outline","description":"Full outline from Prompt A","example":"(paste outline)"}]'::jsonb
  ),
  (
    'Blog How-to — Outline',
    'blog_howto', 'A_outline', 'claude_sonnet', false, 'v1.0',
    '[{"name":"target_keyword"},{"name":"secondary_keywords"},{"name":"target_audience"},{"name":"pexo_feature"}]'::jsonb
  ),
  (
    'Blog Top Review — Outline',
    'blog_top_review', 'A_outline', 'claude_sonnet', false, 'v1.0',
    '[{"name":"target_keyword"},{"name":"secondary_keywords"},{"name":"tools_list"},{"name":"comparison_angle"}]'::jsonb
  ),
  (
    'Blog Tips — Outline',
    'blog_tips', 'A_outline', 'claude_sonnet', false, 'v1.0',
    '[{"name":"target_keyword"},{"name":"secondary_keywords"},{"name":"tip_count"},{"name":"target_audience"}]'::jsonb
  ),
  (
    'Blog Product Review — Outline',
    'blog_product_review', 'A_outline', 'claude_sonnet', false, 'v1.0',
    '[{"name":"target_keyword"},{"name":"secondary_keywords"},{"name":"product_name"},{"name":"relationship"}]'::jsonb
  ),
  (
    'Blog — Article (Universal)',
    'blog_howto', 'B_copy', 'gpt4o_mini', true, 'v1.0',
    '[{"name":"outline","description":"Full outline from any Blog Prompt A"}]'::jsonb
  )
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- Seed: Internal Links (13 records)
-- ────────────────────────────────────────────────────────────

insert into public.seo_ps_internal_links (page_title, url, page_category, primary_keyword, anchor_text_suggestions, link_priority)
values
  ('Text to Video',        'https://pexo.ai/features/text-to-video',        'feature',  'text to video',         ARRAY['text to video','turn text into video','AI text to video generator'],       'high'),
  ('URL to Video',         'https://pexo.ai/features/url-to-video',         'feature',  'url to video',          ARRAY['URL to video','turn any link into a video'],                               'high'),
  ('Product Ad Video',     'https://pexo.ai/create/product-video',          'use_case', 'ai product video',      ARRAY['product video ads','AI product video maker'],                              'high'),
  ('Social Media Video',   'https://pexo.ai/create/social-media-video',     'use_case', 'ai social media video', ARRAY['social media video','create social videos'],                               'high'),
  ('Short Story Video',    'https://pexo.ai/create/short-video',            'use_case', 'ai short video',        ARRAY['short story video','AI short film maker'],                                 'medium'),
  ('Music Video',          'https://pexo.ai/create/music-video',            'use_case', 'ai music video',        ARRAY['AI music video','music video generator'],                                  'medium'),
  ('Explainer Video',      'https://pexo.ai/create/explainer-video',        'use_case', 'ai explainer video',    ARRAY['explainer video','AI explainer video maker'],                              'medium'),
  ('Anime Video',          'https://pexo.ai/create/anime-video',            'use_case', 'ai anime video',        ARRAY['anime video generator','create anime with AI'],                            'medium'),
  ('Seedance 2.0',         'https://pexo.ai/model/seedance-2-0',            'model',    'seedance 2.0',          ARRAY['Seedance 2.0','Seedance AI video model'],                                  'medium'),
  ('Getting Started',      'https://pexo.ai/guide/getting-start',           'guide',    'how to use pexo',       ARRAY['getting started with Pexo','how to use Pexo'],                             'medium'),
  ('Credit Rules',         'https://pexo.ai/guide/credits-rules',           'guide',    'pexo credits',          ARRAY['credit rules','how Pexo credits work'],                                    'low'),
  ('OpenClaw',             'https://pexo.ai/connect/openclaw',              'guide',    'pexo openclaw',         ARRAY['connect to OpenClaw','use Pexo in your chat'],                             'medium'),
  ('Pricing',              'https://pexo.ai/pricing',                       'other',    'pexo pricing',          ARRAY['Pexo pricing','free plan','see pricing'],                                  'low')
on conflict do nothing;
