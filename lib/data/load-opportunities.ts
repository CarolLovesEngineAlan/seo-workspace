import { fetchAllKeywordRows } from "@/lib/notion/fetch-keyword-rows";
import { aggregatePageOpportunities } from "@/lib/opportunity/aggregate";
import type { PageOpportunity, WorkbenchOpportunity } from "@/lib/types/opportunity";
import { isSupabaseConfigured } from "@/lib/supabase/admin-client";
import { getFallbackOpportunities } from "@/lib/data/fallback-opportunities";
import {
  fetchPageOpportunitySnapshotByGroupId,
  fetchPageOpportunitiesSnapshot,
  fetchSupplementByGroupId,
  fetchSupplementsMap,
  mergeNotionWithSupplement,
} from "@/lib/supabase/opportunity-repository";
import { getErrorMessage, settlePromise, withTimeout } from "@/lib/utils/promise";

const SNAPSHOT_LOAD_TIMEOUT_MS = 5_000;
const SUPPLEMENT_LOAD_TIMEOUT_MS = 5_000;

export async function loadOpportunitiesFromNotion(): Promise<PageOpportunity[]> {
  const databaseId = process.env.NOTION_DATABASE_ID?.trim();
  if (!databaseId) {
    throw new Error("缺少环境变量 NOTION_DATABASE_ID");
  }
  const rows = await fetchAllKeywordRows(databaseId);
  return aggregatePageOpportunities(rows);
}

export type LoadOpportunitiesResult = {
  opportunities: WorkbenchOpportunity[];
  /** seo_opportunity_supplements 读取失败时非空；列表仍基于快照表。 */
  supplementLoadError: string | null;
  /** 工作台默认从 Supabase 快照表读取；快照不可用时才回退到系统保障数据。 */
  source: "supabase" | "fallback";
  /** 快照缺失或读取失败时记录原始错误，便于排查同步链路。 */
  sourceError: string | null;
};

/**
 * 工作台主列表读取 Supabase seo_page_opportunities 快照表；
 * workflow / AI 结果继续从 seo_opportunity_supplements 合并。
 */
export async function loadOpportunities(): Promise<LoadOpportunitiesResult> {
  if (!isSupabaseConfigured()) {
    return {
      opportunities: getFallbackOpportunities(),
      supplementLoadError: null,
      source: "fallback",
      sourceError:
        "缺少 SUPABASE_URL（或 NEXT_PUBLIC_SUPABASE_URL）与 SUPABASE_SERVICE_ROLE_KEY，无法读取 seo_page_opportunities 快照。",
    };
  }

  const snapshotPromise = settlePromise(
    withTimeout(
      fetchPageOpportunitiesSnapshot(),
      SNAPSHOT_LOAD_TIMEOUT_MS,
      "Supabase 机会快照读取"
    )
  );
  const supplementPromise = settlePromise(
    withTimeout(
      fetchSupplementsMap(),
      SUPPLEMENT_LOAD_TIMEOUT_MS,
      "Supabase 扩展数据读取"
    )
  );

  const snapshotResult = await snapshotPromise;

  if (!snapshotResult.ok) {
    return {
      opportunities: getFallbackOpportunities(),
      supplementLoadError: null,
      source: "fallback",
      sourceError: getErrorMessage(snapshotResult.error),
    };
  }

  const snapshots = snapshotResult.value;

  if (snapshots.length === 0) {
    return {
      opportunities: getFallbackOpportunities(),
      supplementLoadError: null,
      source: "fallback",
      sourceError:
        "Supabase 机会快照为空。请先调用 /api/sync/notion，或等待下一次夜间同步完成。",
    };
  }

  const supplementResult = await supplementPromise;
  const supplementLoadError = supplementResult.ok
    ? null
    : getErrorMessage(supplementResult.error);

  if (supplementLoadError) {
    console.warn(
      "[loadOpportunities] Supabase supplements skipped:",
      supplementLoadError
    );
  }

  const supplementMap = supplementResult.ok ? supplementResult.value : new Map();

  return {
    opportunities: snapshots.map((snapshot) =>
      mergeNotionWithSupplement(
        snapshot.opportunity,
        supplementMap.get(snapshot.opportunity.groupId) ?? snapshot.legacySupplement
      )
    ),
    supplementLoadError,
    source: "supabase",
    sourceError: null,
  };
}

/** 单次生成/详情：按 group_id 从 Supabase 快照中读取并合并扩展表。 */
export async function getWorkbenchOpportunityByGroupId(
  groupId: string
): Promise<WorkbenchOpportunity | null> {
  const fallback = getFallbackOpportunities().find((item) => item.groupId === groupId) ?? null;

  if (!isSupabaseConfigured()) {
    return fallback;
  }

  try {
    const snapshot = await withTimeout(
      fetchPageOpportunitySnapshotByGroupId(groupId),
      SNAPSHOT_LOAD_TIMEOUT_MS,
      "Supabase 单条机会快照读取"
    );

    if (!snapshot) {
      return fallback;
    }

    try {
      const supplement = await withTimeout(
        fetchSupplementByGroupId(groupId),
        SUPPLEMENT_LOAD_TIMEOUT_MS,
        "Supabase 单条扩展数据读取"
      );
      return mergeNotionWithSupplement(
        snapshot.opportunity,
        supplement ?? snapshot.legacySupplement
      );
    } catch {
      return mergeNotionWithSupplement(
        snapshot.opportunity,
        snapshot.legacySupplement
      );
    }
  } catch {
    return fallback;
  }
}
