export type ContentTypeResolution = {
  resolvedContentType: string;
  source: "content_type" | "content_type_llm" | "needs_review";
};

const EMPTY_TOKENS = new Set(["", "待分类", "未分类", "tbd", "n/a", "—", "-"]);

function isUsableContentType(value: string): boolean {
  const t = value.trim();
  if (t.length === 0) return false;
  if (EMPTY_TOKENS.has(t.toLowerCase())) return false;
  return true;
}

export function resolveContentType(
  contentType: string,
  contentTypeLlm: string
): ContentTypeResolution {
  if (isUsableContentType(contentType)) {
    return { resolvedContentType: contentType.trim(), source: "content_type" };
  }
  if (isUsableContentType(contentTypeLlm)) {
    return {
      resolvedContentType: contentTypeLlm.trim(),
      source: "content_type_llm",
    };
  }
  return { resolvedContentType: "needs_review", source: "needs_review" };
}
