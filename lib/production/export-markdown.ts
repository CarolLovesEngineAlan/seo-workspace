import type { WorkbenchOpportunity } from "@/lib/types/opportunity";
import { formatQaChecklistMarkdown } from "@/lib/production/qa-checklist";
import { buildQaChecklist } from "@/lib/production/qa-checklist";

export function buildExportBundleMarkdown(o: WorkbenchOpportunity): string {
  const qa = formatQaChecklistMarkdown(buildQaChecklist(o));
  const blocks = [
    `# 导出包 · ${o.mainKeyword}`,
    "",
    "---",
    "",
    "## Brief",
    o.briefMarkdown?.trim() || "_（尚未生成）_",
    "",
    "---",
    "",
    "## Article draft",
    o.articleDraftMarkdown?.trim() || "_（尚未生成）_",
    "",
    "---",
    "",
    "## Why now",
    o.whyNow?.trim() || "_（尚未生成）_",
    "",
    "---",
    "",
    qa,
  ];
  return blocks.join("\n");
}
