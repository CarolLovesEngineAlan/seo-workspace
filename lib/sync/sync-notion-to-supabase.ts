import { fetchAllKeywordRows } from "@/lib/notion/fetch-keyword-rows";
import { aggregatePageOpportunities } from "@/lib/opportunity/aggregate";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/lib/supabase/admin-client";
import { SUPABASE_TABLES } from "@/lib/supabase/table-names";
import type { PageOpportunity } from "@/lib/types/opportunity";

const SNAPSHOT_BATCH_SIZE = 200;

export type SyncNotionResult = {
  ok: true;
  mode: "snapshot";
  message: string;
  durationMs: number;
  syncedAt: string;
  rawRowCount: number;
  groupCount: number;
  deletedCount: number;
};

export type SyncNotionError = {
  ok: false;
  error: string;
};

function withSnapshotMigrationHint(message: string): string {
  if (/(seo_page_opportunities|page_opportunities|source_keyword_rows)/i.test(message)) {
    return `${message}。请先执行 supabase/migrations/20250324120000_page_opportunities.sql`;
  }

  return message;
}

function chunkArray<T>(items: T[], size: number): T[][];
function chunkArray<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function buildSnapshotRow(
  opportunity: PageOpportunity,
  syncedAt: string,
  existing?: Record<string, unknown> | null
) {
  return {
    group_id: opportunity.groupId,
    main_keyword: opportunity.mainKeyword,
    all_keywords: opportunity.allKeywords,
    keyword_variants: opportunity.keywordVariants,
    topic_cluster_name: opportunity.topicClusterName,
    intent: opportunity.intent,
    resolved_content_type: opportunity.resolvedContentType,
    content_type_source: opportunity.contentTypeSource,
    volume: opportunity.volume,
    kd: opportunity.kd,
    variant_count: opportunity.variantCount,
    internal_link_role: opportunity.internalLinkRole,
    page_brief: opportunity.pageBrief,
    source_urls: opportunity.sourceUrls,
    source_keyword_rows: opportunity.sourceKeywordRows ?? [],
    needs_review: opportunity.needsReview,
    opportunity_score: opportunity.opportunityScore,
    row_count: opportunity.rowCount,
    pipeline_status:
      existing?.pipeline_status != null ? String(existing.pipeline_status) : "inbox",
    production_stage:
      existing?.production_stage != null
        ? String(existing.production_stage)
        : "none",
    brief_markdown:
      existing?.brief_markdown != null ? String(existing.brief_markdown) : null,
    article_draft_markdown:
      existing?.article_draft_markdown != null
        ? String(existing.article_draft_markdown)
        : null,
    why_now: existing?.why_now != null ? String(existing.why_now) : null,
    synced_at: syncedAt,
  };
}

/**
 * 每次同步把 Notion 聚合结果写入 seo_page_opportunities 快照表。
 * 工作台读取快照表，再与 seo_opportunity_supplements 合并 workflow / AI 扩展字段。
 */
export async function syncNotionToSupabase(): Promise<
  SyncNotionResult | SyncNotionError
> {
  const started = Date.now();

  if (!isSupabaseConfigured()) {
    return { ok: false, error: "Supabase 未配置" };
  }

  try {
    const databaseId = process.env.NOTION_DATABASE_ID?.trim();
    if (!databaseId) throw new Error("缺少环境变量 NOTION_DATABASE_ID");
    const rawRows = await fetchAllKeywordRows(databaseId);
    const rawRowCount = rawRows.length;
    const opportunities = aggregatePageOpportunities(rawRows);
    const supabase = getSupabaseAdmin();
    const syncedAt = new Date().toISOString();

    // 保留现有行的 workflow 字段（pipeline_status / brief_markdown 等），无行数限制地读取
    const { data: existingRows, error: readError } = await supabase
      .from(SUPABASE_TABLES.pageOpportunities)
      .select(
        "group_id, pipeline_status, production_stage, brief_markdown, article_draft_markdown, why_now"
      )
      .limit(10_000);

    if (readError) {
      throw new Error(withSnapshotMigrationHint(readError.message));
    }

    const existingByGroupId = new Map(
      (existingRows ?? []).map((row) => [
        String((row as Record<string, unknown>).group_id),
        row as Record<string, unknown>,
      ])
    );

    const rows = opportunities.map((opportunity) =>
      buildSnapshotRow(
        opportunity,
        syncedAt,
        existingByGroupId.get(opportunity.groupId) ?? null
      )
    );

    for (const batch of chunkArray(rows, SNAPSHOT_BATCH_SIZE)) {
      const { error } = await supabase
        .from(SUPABASE_TABLES.pageOpportunities)
        .upsert(batch, { onConflict: "group_id" });

      if (error) {
        throw new Error(withSnapshotMigrationHint(error.message));
      }
    }

    // 只删除"未处理"的过期行：不在本次同步结果中，且 pipeline_status 仍为 inbox，且无 brief/draft 内容
    const { error: deleteError, count: deletedCount } = await supabase
      .from(SUPABASE_TABLES.pageOpportunities)
      .delete({ count: "exact" })
      .neq("synced_at", syncedAt)
      .eq("pipeline_status", "inbox")
      .is("brief_markdown", null)
      .is("article_draft_markdown", null);

    if (deleteError) {
      throw new Error(withSnapshotMigrationHint(deleteError.message));
    }

    return {
      ok: true,
      mode: "snapshot",
      message:
        "Notion 机会池已同步到 Supabase seo_page_opportunities 快照表；工作台后续从快照读取，再与 seo_opportunity_supplements 合并 workflow 扩展字段。",
      durationMs: Date.now() - started,
      syncedAt,
      rawRowCount,
      groupCount: opportunities.length,
      deletedCount: deletedCount ?? 0,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
