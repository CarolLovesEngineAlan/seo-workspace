import type { WorkbenchOpportunity } from "@/lib/types/opportunity";

/**
 * brief v2：结构化 Markdown，便于人工改稿与后续 LLM 替换。
 */
export function buildBriefV2Markdown(o: WorkbenchOpportunity): string {
  const lines = [
    `# Brief · ${o.mainKeyword}`,
    "",
    "## 一页摘要",
    `- **主关键词**: ${o.mainKeyword}`,
    `- **内容类型**: ${o.resolvedContentType}（来源: ${o.contentTypeSource}）`,
    `- **意图**: ${o.intent || "—"}`,
    `- **主题簇**: ${o.topicClusterName || "—"}`,
    `- **内链角色**: ${o.internalLinkRole || "—"}`,
    `- **Volume / KD / 变体**: ${o.volume} · ${o.kd} · ${o.variantCount}`,
    `- **机会分 (v1)**: ${o.opportunityScore}`,
    "",
    "## 关键词覆盖",
    o.allKeywords || "—",
    "",
    "## 变体与长尾",
    o.keywordVariants || "—",
    "",
    "## 页面简述（来自 Notion）",
    o.pageBrief.trim() || "—",
    "",
    "## 参考 URL",
    ...(o.sourceUrls.length ? o.sourceUrls.map((u) => `- ${u}`) : ["- —"]),
    "",
    "## 写作提示",
    "- 满足搜索意图，首屏点题；",
    "- 自然覆盖主词与变体，避免堆砌；",
    "- 与站点内链角色（pillar/support）一致。",
    "",
  ];
  if (o.whyNow) {
    lines.push("## Why now", o.whyNow, "");
  }
  return lines.join("\n");
}
