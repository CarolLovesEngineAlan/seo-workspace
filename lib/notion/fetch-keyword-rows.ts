import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionKeywordRow } from "@/lib/types/opportunity";
import { mapNotionPageToKeywordRow } from "@/lib/notion/map-page-to-row";

/** 32 位无连字符 id → UUID */
export function toNotionDatabaseUuid(databaseId: string): string {
  const clean = databaseId.replace(/-/g, "");
  if (clean.length !== 32) return databaseId;
  return `${clean.slice(0, 8)}-${clean.slice(8, 12)}-${clean.slice(12, 16)}-${clean.slice(16, 20)}-${clean.slice(20, 32)}`;
}

export function createNotionClient(): Client {
  const key = process.env.NOTION_API_KEY;
  if (!key) {
    throw new Error("缺少环境变量 NOTION_API_KEY");
  }
  return new Client({ auth: key });
}

/**
 * 拉取关键词库全部页面并映射为行（分页直至结束）。
 */
export async function fetchAllKeywordRows(
  databaseIdRaw: string
): Promise<NotionKeywordRow[]> {
  const client = createNotionClient();
  const databaseId = toNotionDatabaseUuid(databaseIdRaw.trim());

  const rows: NotionKeywordRow[] = [];
  let cursor: string | undefined;

  do {
    const response = await client.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
    });

    for (const block of response.results) {
      if (!("properties" in block)) continue;
      const row = mapNotionPageToKeywordRow(block as PageObjectResponse);
      if (row) rows.push(row);
    }

    cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
  } while (cursor);

  return rows;
}
