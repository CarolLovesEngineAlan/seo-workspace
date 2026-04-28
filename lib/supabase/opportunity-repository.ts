import { getSupabaseAdmin } from "@/lib/supabase/admin-client";
import { SUPABASE_TABLES } from "@/lib/supabase/table-names";
import type {
  BriefGenerationRecord,
  OpportunityKeywordRow,
  PageOpportunity,
  PipelineStatus,
  ProductionStage,
  WorkbenchOpportunity,
} from "@/lib/types/opportunity";

export type OpportunitySupplement = {
  pipelineStatus: PipelineStatus;
  productionStage: ProductionStage;
  briefMarkdown: string | null;
  articleDraftMarkdown: string | null;
  whyNow: string | null;
  updatedAt: string | null;
};

export type BriefGenerationPageResult = {
  records: BriefGenerationRecord[];
  total: number;
  page: number;
  pageSize: number;
};

export type PageOpportunitySnapshot = {
  opportunity: PageOpportunity;
  legacySupplement: OpportunitySupplement | null;
};

type BriefGenerationInsert = {
  groupId: string;
  selectedRowIds: string[];
  inputMainKeywords: string[];
  inputContentTypes: string[];
  inputIntents: string[];
  inputKeywordVariants: string[];
  inputTopicClusterNames: string[];
  inputInternalLinkRoles: string[];
  inputPageBriefs: string[];
  briefMarkdown: string;
  model: string | null;
};

function withBriefRecordsMigrationHint(message: string): string {
  if (
    /(seo_brief_generation_records|brief_generation_records|input_intents|input_topic_cluster_names|input_internal_link_roles|input_page_briefs|search_text)/i.test(
      message
    )
  ) {
    return `${message}。请先执行 supabase/migrations/20260324120000_brief_generation_records.sql、supabase/migrations/20260324123000_extend_brief_generation_records_inputs.sql 与 supabase/migrations/20260324201200_add_brief_generation_records_search_text.sql`;
  }

  return message;
}

function withPageOpportunitiesMigrationHint(message: string): string {
  if (/(seo_page_opportunities|page_opportunities|source_keyword_rows)/i.test(message)) {
    return `${message}。请先执行 supabase/migrations/20250324120000_page_opportunities.sql`;
  }

  return message;
}

function buildBriefGenerationSearchText(input: BriefGenerationInsert): string {
  return [
    input.groupId,
    input.model ?? "",
    input.inputMainKeywords.join(" "),
    input.inputContentTypes.join(" "),
    input.inputIntents.join(" "),
    input.inputKeywordVariants.join(" "),
    input.inputTopicClusterNames.join(" "),
    input.inputInternalLinkRoles.join(" "),
    input.inputPageBriefs.join(" "),
    input.briefMarkdown,
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => (item == null ? "" : String(item).trim()))
    .filter(Boolean);
}

function parseNumber(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBoolean(value: unknown): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "1";
  }

  return false;
}

function parsePipelineStatus(value: unknown): PipelineStatus {
  if (
    value === "inbox" ||
    value === "in_queue" ||
    value === "in_production" ||
    value === "shipped"
  ) {
    return value;
  }

  return "inbox";
}

function parseProductionStage(value: unknown): ProductionStage {
  if (
    value === "none" ||
    value === "brief" ||
    value === "draft" ||
    value === "qa" ||
    value === "done"
  ) {
    return value;
  }

  return "none";
}

function parseKeywordRow(raw: Record<string, unknown>): OpportunityKeywordRow {
  return {
    notionPageId: raw.notionPageId != null ? String(raw.notionPageId) : "",
    keyword: raw.keyword != null ? String(raw.keyword).trim() : "",
    mainKeyword: raw.mainKeyword != null ? String(raw.mainKeyword).trim() : "",
    keywordVariants:
      raw.keywordVariants != null ? String(raw.keywordVariants).trim() : "",
    volume: parseNumber(raw.volume),
    contentType: raw.contentType != null ? String(raw.contentType).trim() : "",
    contentTypeLlm:
      raw.contentTypeLlm != null ? String(raw.contentTypeLlm).trim() : "",
    intent: raw.intent != null ? String(raw.intent).trim() : "",
    priority: raw.priority != null ? String(raw.priority).trim() : "",
    kd: parseNumber(raw.kd),
    url: raw.url != null ? String(raw.url).trim() : "",
  };
}

function parseKeywordRows(value: unknown): OpportunityKeywordRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter(
      (item): item is Record<string, unknown> =>
        item != null && typeof item === "object"
    )
    .map((item) => parseKeywordRow(item));
}

function parseSupplementRow(raw: Record<string, unknown>): OpportunitySupplement {
  return {
    pipelineStatus: parsePipelineStatus(raw.pipeline_status),
    productionStage: parseProductionStage(raw.production_stage),
    briefMarkdown: raw.brief_markdown != null ? String(raw.brief_markdown) : null,
    articleDraftMarkdown:
      raw.article_draft_markdown != null ? String(raw.article_draft_markdown) : null,
    whyNow: raw.why_now != null ? String(raw.why_now) : null,
    updatedAt: raw.updated_at != null ? String(raw.updated_at) : null,
  };
}

function parseSnapshotSupplementRow(
  raw: Record<string, unknown>
): OpportunitySupplement | null {
  const hasWorkflowState =
    raw.pipeline_status != null ||
    raw.production_stage != null ||
    raw.brief_markdown != null ||
    raw.article_draft_markdown != null ||
    raw.why_now != null ||
    raw.synced_at != null;

  if (!hasWorkflowState) {
    return null;
  }

  return {
    pipelineStatus: parsePipelineStatus(raw.pipeline_status),
    productionStage: parseProductionStage(raw.production_stage),
    briefMarkdown: raw.brief_markdown != null ? String(raw.brief_markdown) : null,
    articleDraftMarkdown:
      raw.article_draft_markdown != null ? String(raw.article_draft_markdown) : null,
    whyNow: raw.why_now != null ? String(raw.why_now) : null,
    updatedAt: raw.synced_at != null ? String(raw.synced_at) : null,
  };
}

function parsePageOpportunitySnapshotRow(
  raw: Record<string, unknown>
): PageOpportunitySnapshot {
  return {
    opportunity: {
      groupId: raw.group_id != null ? String(raw.group_id) : "",
      mainKeyword: raw.main_keyword != null ? String(raw.main_keyword) : "",
      allKeywords: raw.all_keywords != null ? String(raw.all_keywords) : "",
      keywordVariants:
        raw.keyword_variants != null ? String(raw.keyword_variants) : "",
      topicClusterName:
        raw.topic_cluster_name != null ? String(raw.topic_cluster_name) : "",
      intent: raw.intent != null ? String(raw.intent) : "",
      resolvedContentType:
        raw.resolved_content_type != null ? String(raw.resolved_content_type) : "",
      contentTypeSource:
        raw.content_type_source === "content_type_llm" ||
        raw.content_type_source === "needs_review"
          ? raw.content_type_source
          : "content_type",
      volume: parseNumber(raw.volume),
      kd: parseNumber(raw.kd),
      variantCount: parseNumber(raw.variant_count),
      internalLinkRole:
        raw.internal_link_role != null ? String(raw.internal_link_role) : "",
      pageBrief: raw.page_brief != null ? String(raw.page_brief) : "",
      sourceUrls: parseStringArray(raw.source_urls),
      needsReview: parseBoolean(raw.needs_review),
      opportunityScore: parseNumber(raw.opportunity_score),
      rowCount: parseNumber(raw.row_count),
      sourceKeywordRows: parseKeywordRows(raw.source_keyword_rows),
    },
    legacySupplement: parseSnapshotSupplementRow(raw),
  };
}

function parseBriefGenerationRow(
  raw: Record<string, unknown>
): BriefGenerationRecord {
  return {
    id: raw.id != null ? String(raw.id) : "",
    groupId: raw.group_id != null ? String(raw.group_id) : "",
    selectedRowIds: parseStringArray(raw.selected_row_ids),
    inputMainKeywords: parseStringArray(raw.input_main_keywords),
    inputContentTypes: parseStringArray(raw.input_content_types),
    inputIntents: parseStringArray(raw.input_intents),
    inputKeywordVariants: parseStringArray(raw.input_keyword_variants),
    inputTopicClusterNames: parseStringArray(raw.input_topic_cluster_names),
    inputInternalLinkRoles: parseStringArray(raw.input_internal_link_roles),
    inputPageBriefs: parseStringArray(raw.input_page_briefs),
    briefMarkdown: raw.brief_markdown != null ? String(raw.brief_markdown) : "",
    model: raw.model != null ? String(raw.model) : null,
    createdAt: raw.created_at != null ? String(raw.created_at) : "",
  };
}

export function mergeNotionWithSupplement(
  o: PageOpportunity,
  supplement: OpportunitySupplement | null
): WorkbenchOpportunity {
  return {
    ...o,
    pipelineStatus: supplement?.pipelineStatus ?? "inbox",
    productionStage: supplement?.productionStage ?? "none",
    briefMarkdown: supplement?.briefMarkdown ?? null,
    articleDraftMarkdown: supplement?.articleDraftMarkdown ?? null,
    whyNow: supplement?.whyNow ?? null,
    syncedAt: supplement?.updatedAt ?? null,
  };
}

export async function fetchPageOpportunitiesSnapshot(): Promise<
  PageOpportunitySnapshot[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.pageOpportunities)
    .select("*")
    .order("opportunity_score", { ascending: false });

  if (error) {
    throw new Error(
      `Supabase 读取机会快照失败: ${withPageOpportunitiesMigrationHint(error.message)}`
    );
  }

  return (data ?? []).map((row) =>
    parsePageOpportunitySnapshotRow(row as Record<string, unknown>)
  );
}

export async function fetchPageOpportunitySnapshotByGroupId(
  groupId: string
): Promise<PageOpportunitySnapshot | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.pageOpportunities)
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Supabase 读取机会快照失败: ${withPageOpportunitiesMigrationHint(error.message)}`
    );
  }

  if (!data) {
    return null;
  }

  return parsePageOpportunitySnapshotRow(data as Record<string, unknown>);
}

export async function fetchSupplementsMap(): Promise<Map<string, OpportunitySupplement>> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.opportunitySupplements)
    .select("*");

  if (error) {
    throw new Error(`Supabase 读取扩展数据失败: ${error.message}`);
  }

  const map = new Map<string, OpportunitySupplement>();
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    map.set(String(r.group_id), parseSupplementRow(r));
  }
  return map;
}

export async function fetchSupplementByGroupId(
  groupId: string
): Promise<OpportunitySupplement | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.opportunitySupplements)
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  if (error) {
    throw new Error(`Supabase 读取失败: ${error.message}`);
  }
  if (!data) {
    return null;
  }
  return parseSupplementRow(data as Record<string, unknown>);
}

export async function fetchBriefGenerationsByGroupId(
  groupId: string
): Promise<BriefGenerationRecord[]> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  return (data ?? []).map((row) =>
    parseBriefGenerationRow(row as Record<string, unknown>)
  );
}

export async function fetchLatestBriefGenerationByGroupId(
  groupId: string
): Promise<BriefGenerationRecord | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  if (!data) {
    return null;
  }

  return parseBriefGenerationRow(data as Record<string, unknown>);
}

export async function fetchAllBriefGenerations(): Promise<
  BriefGenerationRecord[]
> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  return (data ?? []).map((row) =>
    parseBriefGenerationRow(row as Record<string, unknown>)
  );
}

export async function fetchBriefGenerationPage(params: {
  query?: string;
  page: number;
  pageSize: number;
}): Promise<BriefGenerationPageResult> {
  const supabase = getSupabaseAdmin();
  const normalizedQuery = params.query?.trim() ?? "";
  const safePageSize = Math.max(1, params.pageSize);

  let countQuery = supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("id", { count: "exact", head: true });

  if (normalizedQuery) {
    countQuery = countQuery.ilike("search_text", `%${normalizedQuery}%`);
  }

  const { count, error: countError } = await countQuery;

  if (countError) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(countError.message)}`
    );
  }

  const total = count ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / safePageSize));
  const safePage = Math.min(Math.max(1, params.page), totalPages);
  const from = (safePage - 1) * safePageSize;
  const to = from + safePageSize - 1;

  let dataQuery = supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("*")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (normalizedQuery) {
    dataQuery = dataQuery.ilike("search_text", `%${normalizedQuery}%`);
  }

  const { data, error } = await dataQuery;

  if (error) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  return {
    records: (data ?? []).map((row) =>
      parseBriefGenerationRow(row as Record<string, unknown>)
    ),
    total,
    page: safePage,
    pageSize: safePageSize,
  };
}

export async function updateBriefGenerationRecordMarkdown(params: {
  id: string;
  briefMarkdown: string;
}): Promise<BriefGenerationRecord> {
  const supabase = getSupabaseAdmin();
  const recordId = params.id.trim();

  if (!recordId) {
    throw new Error("缺少 brief record id。");
  }

  if (!params.briefMarkdown.trim()) {
    throw new Error("Generated Markdown 不能为空。");
  }

  const { data: existing, error: readError } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .select("*")
    .eq("id", recordId)
    .maybeSingle();

  if (readError) {
    throw new Error(
      `读取 brief 记录失败: ${withBriefRecordsMigrationHint(readError.message)}`
    );
  }

  if (!existing) {
    throw new Error("未找到要更新的 brief record。");
  }

  const raw = existing as Record<string, unknown>;
  const searchText = buildBriefGenerationSearchText({
    groupId: raw.group_id != null ? String(raw.group_id) : "",
    selectedRowIds: parseStringArray(raw.selected_row_ids),
    inputMainKeywords: parseStringArray(raw.input_main_keywords),
    inputContentTypes: parseStringArray(raw.input_content_types),
    inputIntents: parseStringArray(raw.input_intents),
    inputKeywordVariants: parseStringArray(raw.input_keyword_variants),
    inputTopicClusterNames: parseStringArray(raw.input_topic_cluster_names),
    inputInternalLinkRoles: parseStringArray(raw.input_internal_link_roles),
    inputPageBriefs: parseStringArray(raw.input_page_briefs),
    briefMarkdown: params.briefMarkdown,
    model: raw.model != null ? String(raw.model) : null,
  });

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .update({
      brief_markdown: params.briefMarkdown,
      search_text: searchText,
    })
    .eq("id", recordId)
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(
      `更新 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  if (!data) {
    throw new Error("更新 brief 记录失败：数据库未返回更新结果。");
  }

  return parseBriefGenerationRow(data as Record<string, unknown>);
}

type WorkflowPatch = Partial<{
  pipeline_status: PipelineStatus;
  production_stage: ProductionStage;
  brief_markdown: string | null;
  article_draft_markdown: string | null;
  why_now: string | null;
}>;

export async function updateOpportunityWorkflow(
  groupId: string,
  patch: WorkflowPatch
): Promise<void> {
  const supabase = getSupabaseAdmin();
  const { data: existing, error: readError } = await supabase
    .from(SUPABASE_TABLES.opportunitySupplements)
    .select("*")
    .eq("group_id", groupId)
    .maybeSingle();

  if (readError) {
    throw new Error(`读取扩展数据失败: ${readError.message}`);
  }

  const base = (existing as Record<string, unknown> | null) ?? null;
  const row = {
    group_id: groupId,
    pipeline_status:
      patch.pipeline_status ??
      (base?.pipeline_status as PipelineStatus | undefined) ??
      "inbox",
    production_stage:
      patch.production_stage ??
      (base?.production_stage as ProductionStage | undefined) ??
      "none",
    brief_markdown:
      patch.brief_markdown !== undefined
        ? patch.brief_markdown
        : base?.brief_markdown != null
          ? String(base.brief_markdown)
          : null,
    article_draft_markdown:
      patch.article_draft_markdown !== undefined
        ? patch.article_draft_markdown
        : base?.article_draft_markdown != null
          ? String(base.article_draft_markdown)
          : null,
    why_now:
      patch.why_now !== undefined
        ? patch.why_now
        : base?.why_now != null
          ? String(base.why_now)
          : null,
    updated_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from(SUPABASE_TABLES.opportunitySupplements)
    .upsert(row, { onConflict: "group_id" });

  if (upsertError) {
    throw new Error(`写入扩展数据失败: ${upsertError.message}`);
  }
}

export async function insertBriefGenerationRecord(
  input: BriefGenerationInsert
): Promise<BriefGenerationRecord> {
  const [record] = await insertBriefGenerationRecords([input]);
  return record;
}

export async function insertBriefGenerationRecords(
  inputs: BriefGenerationInsert[]
): Promise<BriefGenerationRecord[]> {
  if (inputs.length === 0) {
    return [];
  }

  const supabase = getSupabaseAdmin();
  const rows = inputs.map((input) => ({
    group_id: input.groupId,
    selected_row_ids: input.selectedRowIds,
    input_main_keywords: input.inputMainKeywords,
    input_content_types: input.inputContentTypes,
    input_intents: input.inputIntents,
    input_keyword_variants: input.inputKeywordVariants,
    input_topic_cluster_names: input.inputTopicClusterNames,
    input_internal_link_roles: input.inputInternalLinkRoles,
    input_page_briefs: input.inputPageBriefs,
    brief_markdown: input.briefMarkdown,
    model: input.model,
    search_text: buildBriefGenerationSearchText(input),
  }));

  const { data, error } = await supabase
    .from(SUPABASE_TABLES.briefGenerationRecords)
    .insert(rows)
    .select("*");

  if (error) {
    throw new Error(
      `写入 brief 记录失败: ${withBriefRecordsMigrationHint(error.message)}`
    );
  }

  return (data ?? []).map((row) =>
    parseBriefGenerationRow(row as Record<string, unknown>)
  );
}
