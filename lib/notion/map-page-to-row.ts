import type { PageObjectResponse } from "@notionhq/client/build/src/api-endpoints";
import type { NotionKeywordRow } from "@/lib/types/opportunity";
import {
  getGroupIdProperty,
  getNumberProperty,
  getRichTextProperty,
  getSelectProperty,
  getTitleProperty,
  getUrlProperty,
} from "@/lib/notion/notion-properties";

/**
 * 将 Notion 页面映射为内部行；属性名与 field-spec.md 一致。
 * 若你库中列名不同，在此做一层别名映射即可。
 */
export function mapNotionPageToKeywordRow(
  page: PageObjectResponse
): NotionKeywordRow | null {
  if (!("properties" in page)) return null;

  const mainKeyword =
    getTitleProperty(page, "main_keyword") ||
    getRichTextProperty(page, "main_keyword");

  return {
    notionPageId: page.id,
    samePageGroupId: getGroupIdProperty(page, "same_page_group_id"),
    mainKeyword,
    keyword: getRichTextProperty(page, "keyword"),
    keywordVariants: getRichTextProperty(page, "keyword_variants"),
    allKeywords: getRichTextProperty(page, "all_keywords"),
    pageBrief: getRichTextProperty(page, "page_brief"),
    topicClusterName: getRichTextProperty(page, "topic_cluster_name"),
    volume: getNumberProperty(page, "volume"),
    kd: getNumberProperty(page, "kd"),
    variantCount: getNumberProperty(page, "variant_count"),
    contentType: getSelectProperty(page, "content_type"),
    contentTypeLlm: getSelectProperty(page, "content_type_llm"),
    intent: getSelectProperty(page, "intent"),
    priority: getSelectProperty(page, "priority"),
    internalLinkRole: getSelectProperty(page, "internal_link_role"),
    url: getUrlProperty(page, "url"),
  };
}
