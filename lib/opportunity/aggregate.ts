import type {
  NotionKeywordRow,
  OpportunityKeywordRow,
  PageOpportunity,
} from "@/lib/types/opportunity";
import { resolveContentType } from "@/lib/opportunity/resolve-content-type";
import { attachScores } from "@/lib/scoring/opportunity-score";

function uniqueJoin(segments: string[], separator: string): string {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const seg of segments) {
    const t = seg.trim();
    if (!t) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  return out.join(separator);
}

function pickPrimaryRow(rows: NotionKeywordRow[]): NotionKeywordRow {
  return [...rows].sort((a, b) => {
    if (b.volume !== a.volume) return b.volume - a.volume;
    return b.variantCount - a.variantCount;
  })[0];
}

function mergeRowsToOpportunity(
  groupId: string,
  rows: NotionKeywordRow[],
  groupIdMissing: boolean
): PageOpportunity {
  const primary = pickPrimaryRow(rows);
  const { resolvedContentType, source } = resolveContentType(
    primary.contentType,
    primary.contentTypeLlm
  );

  const needsReview = groupIdMissing || source === "needs_review";

  const volumeSum = rows.reduce((s, r) => s + r.volume, 0);
  const kdAvg =
    rows.length > 0
      ? rows.reduce((s, r) => s + r.kd, 0) / rows.length
      : 0;
  const variantSum = rows.reduce((s, r) => s + r.variantCount, 0);

  const pageBriefs = rows
    .map((r) => r.pageBrief.trim())
    .filter(Boolean)
    .sort((a, b) => b.length - a.length);
  const pageBrief = pageBriefs[0] ?? "";

  const urls = rows.map((r) => r.url.trim()).filter(Boolean);
  const sourceKeywordRows: OpportunityKeywordRow[] = rows.map((row) => ({
    notionPageId: row.notionPageId,
    keyword: row.keyword.trim(),
    mainKeyword: row.mainKeyword.trim(),
    keywordVariants: row.keywordVariants.trim(),
    volume: row.volume,
    contentType: row.contentType.trim(),
    contentTypeLlm: row.contentTypeLlm.trim(),
    intent: row.intent.trim(),
    priority: row.priority.trim(),
    kd: row.kd,
    url: row.url.trim(),
  }));

  return {
    groupId,
    mainKeyword: primary.mainKeyword || "(无主关键词)",
    allKeywords: uniqueJoin(
      rows.flatMap((r) => [r.mainKeyword, r.keyword, r.allKeywords]),
      " | "
    ),
    keywordVariants: uniqueJoin(
      rows.map((r) => r.keywordVariants),
      " | "
    ),
    topicClusterName: primary.topicClusterName,
    intent: primary.intent,
    resolvedContentType,
    contentTypeSource: source,
    volume: Math.round(volumeSum),
    kd: Math.round(kdAvg * 10) / 10,
    variantCount: variantSum,
    internalLinkRole: primary.internalLinkRole,
    pageBrief,
    sourceUrls: urls,
    needsReview,
    opportunityScore: 0,
    rowCount: rows.length,
    sourceKeywordRows,
  };
}

/**
 * 每行 Notion 记录对应一个 PageOpportunity；按 main_keyword 去重，
 * 同名条目保留 volume 最大的一行（用其 notionPageId 作为 groupId）。
 */
export function aggregatePageOpportunities(
  rows: NotionKeywordRow[]
): PageOpportunity[] {
  const byKeyword = new Map<string, NotionKeywordRow>();

  for (const row of rows) {
    const key = row.mainKeyword.trim().toLowerCase();
    if (!key) continue;
    const existing = byKeyword.get(key);
    if (!existing || row.volume > existing.volume) {
      byKeyword.set(key, row);
    }
  }

  const opportunities: PageOpportunity[] = [];

  for (const row of byKeyword.values()) {
    opportunities.push(
      mergeRowsToOpportunity(row.notionPageId, [row], false)
    );
  }

  return attachScores(opportunities).sort(
    (a, b) => b.opportunityScore - a.opportunityScore
  );
}
