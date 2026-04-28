import type { WorkbenchOpportunity } from "@/lib/types/opportunity";

/**
 * 无 API Key 时的可解释占位；有 OPENAI_API_KEY 时可改为真实调用。
 */
export function buildWhyNowText(o: WorkbenchOpportunity): string {
  const parts: string[] = [];
  if (o.volume >= 500) {
    parts.push(`搜索体量较高（volume ${o.volume}），值得优先占位。`);
  } else if (o.volume > 0) {
    parts.push(`存在一定搜索需求（volume ${o.volume}），可与簇内其它词协同。`);
  }
  if (o.kd <= 30) {
    parts.push(`KD 相对温和（${o.kd}），新内容有机会进入可见范围。`);
  } else if (o.kd > 0) {
    parts.push(`竞争度 ${o.kd}，需要更差异化的角度与内链支持。`);
  }
  if (o.needsReview) {
    parts.push("内容类型或分组待复核，确认后再加大投入。");
  }
  if (parts.length === 0) {
    return "基于当前字段信息有限；建议在 Notion 补全 volume/KD 与 brief 后再评估优先级。";
  }
  return parts.join(" ");
}
