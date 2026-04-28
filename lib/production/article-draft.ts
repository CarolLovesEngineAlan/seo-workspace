import type { WorkbenchOpportunity } from "@/lib/types/opportunity";

/** 占位草稿骨架；可替换为 LLM 输出。 */
export function buildArticleDraftMarkdown(o: WorkbenchOpportunity): string {
  const title = o.mainKeyword;
  return [
    `# ${title}`,
    "",
    "> 状态：自动骨架 · 请替换为正式正文",
    "",
    "## 引言",
    `围绕「${o.mainKeyword}」说明读者将获得什么，并呼应意图：${o.intent || "未标注"}。`,
    "",
    "## 要点",
    "- …",
    "- …",
    "",
    "## 总结",
    "收束并给出可执行下一步。",
    "",
    "---",
    `_brief 摘要_: ${o.pageBrief.slice(0, 200)}${o.pageBrief.length > 200 ? "…" : ""}`,
    "",
  ].join("\n");
}
