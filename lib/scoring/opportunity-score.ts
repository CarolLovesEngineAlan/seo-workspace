import type { PageOpportunity } from "@/lib/types/opportunity";

/**
 * 策略层 v1：可解释的简单加权，后续可替换为 field-spec 正式公式。
 */
export function computeOpportunityScore(input: {
  volume: number;
  kd: number;
  variantCount: number;
  pageBrief: string;
  intent: string;
  internalLinkRole: string;
  resolvedContentType: string;
  needsReview: boolean;
}): number {
  if (input.needsReview || input.resolvedContentType === "needs_review") {
    return Math.round(
      baseScore(input) * 0.35
    );
  }
  return Math.round(baseScore(input) + intentBonus(input.intent) + roleBonus(input.internalLinkRole));
}

function baseScore(input: {
  volume: number;
  kd: number;
  variantCount: number;
  pageBrief: string;
}): number {
  const vol = Math.max(0, input.volume);
  const kd = Math.min(100, Math.max(0, input.kd));
  const volumePart = Math.min(Math.log10(vol + 10) * 25, 80);
  const kdPart = ((100 - kd) / 100) * 45;
  const variantPart = Math.min(input.variantCount * 1.5, 25);
  const briefPart = input.pageBrief.trim().length > 50 ? 12 : 0;
  return volumePart + kdPart + variantPart + briefPart;
}

function intentBonus(intent: string): number {
  const i = intent.toLowerCase();
  if (i.includes("commercial") || i.includes("交易") || i.includes("购买")) {
    return 8;
  }
  if (i.includes("transactional")) return 8;
  if (i.includes("navigational") || i.includes("导航")) return 4;
  return 0;
}

function roleBonus(role: string): number {
  const r = role.toLowerCase();
  if (r.includes("pillar")) return 6;
  if (r.includes("support")) return 3;
  return 0;
}

export function attachScores(opportunities: PageOpportunity[]): PageOpportunity[] {
  return opportunities.map((o) => ({
    ...o,
    opportunityScore: computeOpportunityScore({
      volume: o.volume,
      kd: o.kd,
      variantCount: o.variantCount,
      pageBrief: o.pageBrief,
      intent: o.intent,
      internalLinkRole: o.internalLinkRole,
      resolvedContentType: o.resolvedContentType,
      needsReview: o.needsReview,
    }),
  }));
}
