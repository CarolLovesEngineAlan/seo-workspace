-- Add model_page to ps_page_type enum
-- Safe to run multiple times: ALTER TYPE ADD VALUE IF NOT EXISTS

ALTER TYPE public.ps_page_type ADD VALUE IF NOT EXISTS 'model_page';

-- Insert model page prompts (prompt_text filled separately via 20260427000001)
INSERT INTO public.seo_ps_prompts (name, page_type, prompt_step, recommended_model, use_cache, version, required_variables)
VALUES
  (
    'Model Page — Outline',
    'model_page', 'A_outline', 'claude_sonnet', true, 'v1.0',
    '[{"name":"primary_keyword","description":"Model name as primary keyword","example":"Seedance 2.0"},{"name":"keyword_variants","description":"Comma-separated variants","example":"seedance video model, seedance ai"},{"name":"competitor_notes","description":"Competitor model pages to reference for angles","example":"https://kling.ai/"},{"name":"notes","description":"Eyebrow tags and special instructions","example":"EYEBROW 1: RESOLUTION / EYEBROW 2: SPEED"}]'::jsonb
  ),
  (
    'Model Page — Copy',
    'model_page', 'B_copy', 'claude_opus', true, 'v1.0',
    '[{"name":"outline","description":"Full outline from Prompt A","example":"(paste outline)"}]'::jsonb
  )
ON CONFLICT DO NOTHING;
