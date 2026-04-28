import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { SUPABASE_TABLES } from "@/lib/supabase/table-names";
import type {
  BrandContext,
  BrandContextUpdate,
  PsInternalLink,
  PsInternalLinkCreate,
  PsInternalLinkUpdate,
  PsPageCategory,
  PsLinkPriority,
  PsPageType,
  PsPrompt,
  PsPromptCreate,
  PsPromptStep,
  PsPromptUpdate,
  AssembledPromptResult,
} from "@/lib/types/prompt-system";

// ── Row mappers ───────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToBrandContext(row: any): BrandContext {
  return {
    id: row.id,
    productName: row.product_name,
    productPositioning: row.product_positioning,
    capabilitiesSummary: row.capabilities_summary,
    supportedPlatforms: row.supported_platforms ?? [],
    aiModelsUsed: row.ai_models_used ?? [],
    pricingInfo: row.pricing_info,
    brandVoice: row.brand_voice,
    expressionRules: row.expression_rules,
    bannedWords: row.banned_words ?? [],
    pexoMentionDensity: row.pexo_mention_density,
    competitivePositioning: row.competitive_positioning ?? {},
    version: row.version,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToPrompt(row: any): PsPrompt {
  return {
    id: row.id,
    name: row.name,
    pageType: row.page_type,
    promptStep: row.prompt_step,
    promptText: row.prompt_text,
    requiredVariables: row.required_variables ?? [],
    exampleVariableSet: row.example_variable_set,
    recommendedModel: row.recommended_model,
    useCache: row.use_cache,
    version: row.version,
    notes: row.notes,
    brandContextId: row.brand_context_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToInternalLink(row: any): PsInternalLink {
  return {
    id: row.id,
    pageTitle: row.page_title,
    url: row.url,
    pageCategory: row.page_category,
    primaryKeyword: row.primary_keyword,
    anchorTextSuggestions: row.anchor_text_suggestions ?? [],
    linkPriority: row.link_priority,
    lastVerified: row.last_verified,
    createdAt: row.created_at,
  };
}

// ── Brand Context ─────────────────────────────────────────────

export async function getBrandContext(): Promise<BrandContext | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(SUPABASE_TABLES.psBrandContext)
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToBrandContext(data);
}

export async function upsertBrandContext(
  update: BrandContextUpdate
): Promise<BrandContext> {
  const db = getSupabaseAdmin();

  // Try to get existing row id
  const existing = await getBrandContext();

  const payload = {
    product_name: update.productName,
    product_positioning: update.productPositioning,
    capabilities_summary: update.capabilitiesSummary,
    supported_platforms: update.supportedPlatforms,
    ai_models_used: update.aiModelsUsed,
    pricing_info: update.pricingInfo,
    brand_voice: update.brandVoice,
    expression_rules: update.expressionRules,
    banned_words: update.bannedWords,
    pexo_mention_density: update.pexoMentionDensity,
    competitive_positioning: update.competitivePositioning,
    version: update.version,
    updated_at: new Date().toISOString(),
  };

  let data;
  let error;

  if (existing) {
    ({ data, error } = await db
      .from(SUPABASE_TABLES.psBrandContext)
      .update(payload)
      .eq("id", existing.id)
      .select()
      .single());
  } else {
    ({ data, error } = await db
      .from(SUPABASE_TABLES.psBrandContext)
      .insert(payload)
      .select()
      .single());
  }

  if (error) throw new Error(error.message);
  return rowToBrandContext(data);
}

// ── Prompts ───────────────────────────────────────────────────

export async function listPrompts(filters?: {
  pageType?: PsPageType;
  promptStep?: PsPromptStep;
}): Promise<PsPrompt[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from(SUPABASE_TABLES.psPrompts)
    .select("*")
    .order("created_at", { ascending: true });

  if (filters?.pageType) {
    query = query.eq("page_type", filters.pageType);
  }
  if (filters?.promptStep) {
    query = query.eq("prompt_step", filters.promptStep);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToPrompt);
}

export async function getPromptById(id: string): Promise<PsPrompt | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(SUPABASE_TABLES.psPrompts)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return rowToPrompt(data);
}

export async function createPrompt(input: PsPromptCreate): Promise<PsPrompt> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(SUPABASE_TABLES.psPrompts)
    .insert({
      name: input.name,
      page_type: input.pageType,
      prompt_step: input.promptStep,
      prompt_text: input.promptText,
      required_variables: input.requiredVariables,
      example_variable_set: input.exampleVariableSet,
      recommended_model: input.recommendedModel,
      use_cache: input.useCache,
      version: input.version,
      notes: input.notes,
      brand_context_id: input.brandContextId,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToPrompt(data);
}

export async function updatePrompt(
  id: string,
  input: PsPromptUpdate
): Promise<PsPrompt> {
  const db = getSupabaseAdmin();

  // Build partial update payload
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = { updated_at: new Date().toISOString() };
  if (input.name !== undefined) payload.name = input.name;
  if (input.pageType !== undefined) payload.page_type = input.pageType;
  if (input.promptStep !== undefined) payload.prompt_step = input.promptStep;
  if (input.promptText !== undefined) payload.prompt_text = input.promptText;
  if (input.requiredVariables !== undefined) payload.required_variables = input.requiredVariables;
  if (input.exampleVariableSet !== undefined) payload.example_variable_set = input.exampleVariableSet;
  if (input.recommendedModel !== undefined) payload.recommended_model = input.recommendedModel;
  if (input.useCache !== undefined) payload.use_cache = input.useCache;
  if (input.version !== undefined) payload.version = input.version;
  if (input.notes !== undefined) payload.notes = input.notes;
  if (input.brandContextId !== undefined) payload.brand_context_id = input.brandContextId;

  const { data, error } = await db
    .from(SUPABASE_TABLES.psPrompts)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToPrompt(data);
}

export async function deletePrompt(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from(SUPABASE_TABLES.psPrompts)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ── Internal Links ────────────────────────────────────────────

export async function listInternalLinks(filters?: {
  category?: PsPageCategory;
  priority?: PsLinkPriority;
}): Promise<PsInternalLink[]> {
  const db = getSupabaseAdmin();
  let query = db
    .from(SUPABASE_TABLES.psInternalLinks)
    .select("*")
    .order("link_priority", { ascending: true })
    .order("page_title", { ascending: true });

  if (filters?.category) {
    query = query.eq("page_category", filters.category);
  }
  if (filters?.priority) {
    query = query.eq("link_priority", filters.priority);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToInternalLink);
}

export async function createInternalLink(
  input: PsInternalLinkCreate
): Promise<PsInternalLink> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(SUPABASE_TABLES.psInternalLinks)
    .insert({
      page_title: input.pageTitle,
      url: input.url,
      page_category: input.pageCategory,
      primary_keyword: input.primaryKeyword,
      anchor_text_suggestions: input.anchorTextSuggestions,
      link_priority: input.linkPriority,
      last_verified: input.lastVerified,
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToInternalLink(data);
}

export async function updateInternalLink(
  id: string,
  input: PsInternalLinkUpdate
): Promise<PsInternalLink> {
  const db = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: Record<string, any> = {};
  if (input.pageTitle !== undefined) payload.page_title = input.pageTitle;
  if (input.url !== undefined) payload.url = input.url;
  if (input.pageCategory !== undefined) payload.page_category = input.pageCategory;
  if (input.primaryKeyword !== undefined) payload.primary_keyword = input.primaryKeyword;
  if (input.anchorTextSuggestions !== undefined) payload.anchor_text_suggestions = input.anchorTextSuggestions;
  if (input.linkPriority !== undefined) payload.link_priority = input.linkPriority;
  if (input.lastVerified !== undefined) payload.last_verified = input.lastVerified;

  const { data, error } = await db
    .from(SUPABASE_TABLES.psInternalLinks)
    .update(payload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return rowToInternalLink(data);
}

export async function deleteInternalLink(id: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from(SUPABASE_TABLES.psInternalLinks)
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);
}

// ── Assembled Prompt ──────────────────────────────────────────

export async function assemblePrompt(
  id: string
): Promise<AssembledPromptResult> {
  const [prompt, brandContext, internalLinks] = await Promise.all([
    getPromptById(id),
    getBrandContext(),
    listInternalLinks(),
  ]);

  if (!prompt) throw new Error(`Prompt not found: ${id}`);

  // Format brand context as readable text block
  const brandContextText = brandContext
    ? [
        `Product Name: ${brandContext.productName}`,
        `Positioning: ${brandContext.productPositioning}`,
        `Capabilities: ${brandContext.capabilitiesSummary}`,
        `Platforms: ${brandContext.supportedPlatforms.join(", ")}`,
        `AI Models: ${brandContext.aiModelsUsed.join(", ")}`,
        `Pricing: ${brandContext.pricingInfo}`,
        `Brand Voice: ${brandContext.brandVoice}`,
        `Expression Rules: ${brandContext.expressionRules}`,
        `Banned Words: ${brandContext.bannedWords.join(", ")}`,
        `Pexo Mention Density: ${brandContext.pexoMentionDensity}`,
        `Competitive Positioning:\n${Object.entries(brandContext.competitivePositioning)
          .map(([k, v]) => `  ${k}: ${v}`)
          .join("\n")}`,
      ].join("\n\n")
    : "(Brand context not available)";

  // Format internal link library
  const internalLinkText =
    internalLinks.length === 0
      ? "(No internal links available)"
      : internalLinks
          .map(
            (link) =>
              `- ${link.pageTitle} | ${link.url} | [${link.linkPriority}] | Anchors: ${link.anchorTextSuggestions.join(" / ")}`
          )
          .join("\n");

  const assembledText = prompt.promptText
    .replace(/\{brand_context\}/g, brandContextText)
    .replace(/\{internal_link_library\}/g, internalLinkText);

  return {
    promptId: prompt.id,
    promptName: prompt.name,
    pageType: prompt.pageType,
    assembledText,
  };
}
