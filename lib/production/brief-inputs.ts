type BriefInputSource = {
  mainKeyword: string;
  intent?: string;
  contentType?: string;
  contentTypeLlm?: string;
  keywordVariants?: string;
  topicClusterName?: string;
  internalLinkRole?: string;
  pageBrief?: string;
};

export type BriefInputSummary = {
  mainKeywords: string[];
  contentTypes: string[];
  intents: string[];
  keywordVariants: string[];
  topicClusterNames: string[];
  internalLinkRoles: string[];
  pageBriefs: string[];
};

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const normalized = value.trim();
    if (!normalized) continue;

    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;

    seen.add(key);
    output.push(normalized);
  }

  return output;
}

function splitKeywordVariants(raw: string | undefined): string[] {
  if (!raw) return [];

  return raw
    .split(/\||\n|,/)
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function resolveBriefInputContentType(source: BriefInputSource): string {
  return source.contentType?.trim() || source.contentTypeLlm?.trim() || "unknown";
}

export function buildBriefInputSummary(
  sources: BriefInputSource[]
): BriefInputSummary {
  return {
    mainKeywords: uniqueValues(sources.map((source) => source.mainKeyword)),
    contentTypes: uniqueValues(
      sources.map((source) => resolveBriefInputContentType(source))
    ),
    intents: uniqueValues(sources.map((source) => source.intent ?? "")),
    keywordVariants: uniqueValues(
      sources.flatMap((source) => splitKeywordVariants(source.keywordVariants))
    ),
    topicClusterNames: uniqueValues(
      sources.map((source) => source.topicClusterName ?? "")
    ),
    internalLinkRoles: uniqueValues(
      sources.map((source) => source.internalLinkRole ?? "")
    ),
    pageBriefs: uniqueValues(sources.map((source) => source.pageBrief ?? "")),
  };
}
