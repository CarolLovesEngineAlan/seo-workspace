// ─────────────────────────────────────────────────────────────
// Prompt Management System — TypeScript types
// ─────────────────────────────────────────────────────────────

export type PsPageType =
  | "feature_page"
  | "use_case_page"
  | "model_page"
  | "blog_howto"
  | "blog_top_review"
  | "blog_tips"
  | "blog_product_review";

export type PsPromptStep = "A_outline" | "B_copy";

export type PsRecommendedModel = "claude_sonnet" | "claude_opus" | "gpt4o_mini";

export type PsPageCategory =
  | "feature"
  | "use_case"
  | "model"
  | "guide"
  | "blog"
  | "other";

export type PsLinkPriority = "high" | "medium" | "low";

// ── Brand Context ────────────────────────────────────────────

export type BrandContext = {
  id: string;
  productName: string;
  productPositioning: string;
  capabilitiesSummary: string;
  supportedPlatforms: string[];
  aiModelsUsed: string[];
  pricingInfo: string;
  brandVoice: string;
  expressionRules: string;
  bannedWords: string[];
  pexoMentionDensity: string;
  competitivePositioning: Record<string, string>;
  version: string;
  updatedAt: string;
};

export type BrandContextUpdate = Omit<BrandContext, "id" | "updatedAt">;

// ── Prompt ───────────────────────────────────────────────────

export type PsRequiredVariable = {
  name: string;
  description?: string;
  example?: string;
};

export type PsPrompt = {
  id: string;
  name: string;
  pageType: PsPageType;
  promptStep: PsPromptStep;
  promptText: string;
  requiredVariables: PsRequiredVariable[];
  exampleVariableSet: string;
  recommendedModel: PsRecommendedModel;
  useCache: boolean;
  version: string;
  notes: string;
  brandContextId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PsPromptCreate = Omit<PsPrompt, "id" | "createdAt" | "updatedAt">;
export type PsPromptUpdate = Partial<PsPromptCreate>;

// ── Internal Link ────────────────────────────────────────────

export type PsInternalLink = {
  id: string;
  pageTitle: string;
  url: string;
  pageCategory: PsPageCategory;
  primaryKeyword: string;
  anchorTextSuggestions: string[];
  linkPriority: PsLinkPriority;
  lastVerified: string | null;
  createdAt: string;
};

export type PsInternalLinkCreate = Omit<PsInternalLink, "id" | "createdAt">;
export type PsInternalLinkUpdate = Partial<PsInternalLinkCreate>;

// ── Assembled Prompt ─────────────────────────────────────────

export type AssembledPromptResult = {
  promptId: string;
  promptName: string;
  pageType: PsPageType;
  assembledText: string;
};

// ── Display helpers ──────────────────────────────────────────

export const PAGE_TYPE_LABELS: Record<PsPageType, string> = {
  feature_page: "Feature Page",
  use_case_page: "Use Case Page",
  model_page: "Model Page",
  blog_howto: "Blog How-to",
  blog_top_review: "Blog Top Review",
  blog_tips: "Blog Tips",
  blog_product_review: "Blog Product Review",
};

export const PROMPT_STEP_LABELS: Record<PsPromptStep, string> = {
  A_outline: "A — Outline",
  B_copy: "B — Copy",
};

export const MODEL_LABELS: Record<PsRecommendedModel, string> = {
  claude_sonnet: "Claude Sonnet",
  claude_opus: "Claude Opus",
  gpt4o_mini: "GPT-4o mini",
};

export const PAGE_CATEGORY_LABELS: Record<PsPageCategory, string> = {
  feature: "Feature",
  use_case: "Use Case",
  model: "Model",
  guide: "Guide",
  blog: "Blog",
  other: "Other",
};

export const LINK_PRIORITY_LABELS: Record<PsLinkPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};
