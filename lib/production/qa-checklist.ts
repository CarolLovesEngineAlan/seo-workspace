import type { WorkbenchOpportunity } from "@/lib/types/opportunity";

export type QaChecklistItem = { id: string; label: string; done: boolean };

export function buildQaChecklist(_o: WorkbenchOpportunity): QaChecklistItem[] {
  return [
    { id: "intent", label: "标题与首段是否对齐搜索意图", done: false },
    { id: "h1", label: "H1 唯一且包含主关键词（自然）", done: false },
    { id: "variants", label: "变体词在正文中有分布而非堆砌", done: false },
    { id: "links", label: "内链与 pillar/support 角色一致", done: false },
    { id: "meta", label: "Meta 描述可读、含价值点", done: false },
  ];
}

export function formatQaChecklistMarkdown(items: QaChecklistItem[]): string {
  return [
    "## QA Checklist",
    "",
    ...items.map((i) => `- [ ] ${i.label}`),
    "",
  ].join("\n");
}
