import { URL } from "node:url";
import type { BriefGenerationRecord, WorkbenchOpportunity } from "@/lib/types/opportunity";
import { buildWhyNowText } from "@/lib/production/why-now";
import {
  DEFAULT_OPENAI_MODEL,
  type OpenAiResponsePayload,
  extractOutputText,
  extractPromptTemplate,
  firstNonEmpty,
  formatRequestFailure,
  interpolatePromptTemplate,
  postJson,
  postJsonStream,
  readPromptAsset,
  resolveOpenAiBaseUrl,
  resolveOpenAiProxyUrl,
  sanitizeMarkdown,
} from "@/lib/production/openai-shared";

type GenerateDraftParams = {
  opportunity: WorkbenchOpportunity;
  latestBriefRecord: BriefGenerationRecord | null;
};

const PROMPT_FILE_URLS = {
  briefSpec: new URL("../../doc/brief-spec-by-content-type.md", import.meta.url),
  draftPrompt: new URL("../../doc/draft-generation-prompt.md", import.meta.url),
} as const;

function joinValues(values: string[]): string {
  const normalized = values.map((value) => value.trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.join(", ") : "—";
}

function buildInputSnapshot(record: BriefGenerationRecord | null): string {
  if (!record) {
    return "无可用的 brief generation record；请基于当前已保存的 Brief Markdown 与机会上下文生成文章初稿。";
  }

  const sections = [
    `record_id: ${record.id}`,
    `record_created_at: ${record.createdAt}`,
    `selected_row_ids: ${joinValues(record.selectedRowIds)}`,
    `input_main_keywords: ${joinValues(record.inputMainKeywords)}`,
    `input_content_types: ${joinValues(record.inputContentTypes)}`,
    `input_intents: ${joinValues(record.inputIntents)}`,
    `input_keyword_variants: ${joinValues(record.inputKeywordVariants)}`,
    `input_topic_cluster_names: ${joinValues(record.inputTopicClusterNames)}`,
    `input_internal_link_roles: ${joinValues(record.inputInternalLinkRoles)}`,
    "",
    "input_page_briefs:",
    record.inputPageBriefs.length > 0
      ? record.inputPageBriefs
          .map((value, index) => `### Page Brief ${index + 1}\n${value}`)
          .join("\n\n")
      : "—",
  ];

  return sections.join("\n");
}

function buildPrompt(
  opportunity: WorkbenchOpportunity,
  latestBriefRecord: BriefGenerationRecord | null,
  promptTemplate: string,
  specMarkdown: string
): string {
  const pageBriefMarkdown = firstNonEmpty(
    opportunity.briefMarkdown,
    latestBriefRecord?.briefMarkdown,
    opportunity.pageBrief
  );
  const mainKeyword = firstNonEmpty(
    latestBriefRecord?.inputMainKeywords[0],
    opportunity.mainKeyword
  );
  const contentType = firstNonEmpty(
    latestBriefRecord?.inputContentTypes[0],
    opportunity.resolvedContentType
  );
  const intent = firstNonEmpty(
    latestBriefRecord?.inputIntents[0],
    opportunity.intent
  );
  const topicClusterName = firstNonEmpty(
    latestBriefRecord?.inputTopicClusterNames[0],
    opportunity.topicClusterName
  );
  const internalLinkRole = firstNonEmpty(
    latestBriefRecord?.inputInternalLinkRoles[0],
    opportunity.internalLinkRole
  );
  const keywordVariants = firstNonEmpty(
    latestBriefRecord?.inputKeywordVariants.join(", "),
    opportunity.keywordVariants
  );
  const whyNow = opportunity.whyNow ?? buildWhyNowText(opportunity);
  const sourceUrls = opportunity.sourceUrls.length
    ? opportunity.sourceUrls.map((url) => `- ${url}`).join("\n")
    : "- —";

  const hydratedPrompt = interpolatePromptTemplate(promptTemplate, {
    page_brief: pageBriefMarkdown,
    main_keyword: mainKeyword,
    content_type: contentType,
    intent,
    topic_cluster_name: topicClusterName,
    internal_link_role: internalLinkRole,
    keyword_variants: keywordVariants,
  });

  return [
    hydratedPrompt.trim(),
    "",
    "## Canonical brief specification",
    "If any draft-level instruction conflicts with the brief specification below, the specification wins.",
    "",
    specMarkdown.trim(),
    "",
    "## Opportunity Context",
    `same_page_group_id: ${opportunity.groupId}`,
    `group_main_keyword: ${opportunity.mainKeyword || "—"}`,
    `group_all_keywords: ${opportunity.allKeywords || "—"}`,
    `group_keyword_variants: ${opportunity.keywordVariants || "—"}`,
    `group_intent: ${opportunity.intent || "—"}`,
    `group_resolved_content_type: ${opportunity.resolvedContentType || "—"}`,
    `group_topic_cluster_name: ${opportunity.topicClusterName || "—"}`,
    `group_internal_link_role: ${opportunity.internalLinkRole || "—"}`,
    `volume: ${opportunity.volume}`,
    `kd: ${opportunity.kd}`,
    `row_count: ${opportunity.rowCount}`,
    `why_now: ${whyNow}`,
    "",
    "## Reference URLs",
    sourceUrls,
    "",
    "## Brief Generation Input Snapshot",
    buildInputSnapshot(latestBriefRecord),
    "",
    "## Current Saved Brief Markdown",
    pageBriefMarkdown,
    "",
    "## Output Guardrails",
    "- Return Markdown only.",
    "- Do not wrap the answer in code fences.",
    "- Use the current saved Brief Markdown as the primary source of truth for the outline.",
    "- Treat the brief generation input snapshot as supporting context for keyword, intent, and content framing.",
    "- Default to English unless the keyword and page context are clearly Chinese.",
  ].join("\n");
}

export async function generateDraftMarkdownWithOpenAi({
  opportunity,
  latestBriefRecord,
}: GenerateDraftParams): Promise<{
  markdown: string;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法生成 AI 初稿。");
  }

  const savedBrief = firstNonEmpty(
    opportunity.briefMarkdown,
    latestBriefRecord?.briefMarkdown
  );
  if (!savedBrief || savedBrief === "—") {
    throw new Error("当前还没有可用的 Brief Markdown，无法生成初稿。");
  }

  const model =
    process.env.OPENAI_DRAFT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL;

  const [specMarkdown, promptDocument] = await Promise.all([
    readPromptAsset(
      PROMPT_FILE_URLS.briefSpec,
      "Follow the brief rules defined in `brief-spec-by-content-type.md`."
    ),
    readPromptAsset(
      PROMPT_FILE_URLS.draftPrompt,
      [
        "You are a senior SEO content writer.",
        "Write a complete markdown article draft based on the provided page brief.",
        "Return production-ready Markdown only.",
      ].join(" ")
    ),
  ]);

  const promptTemplate =
    extractPromptTemplate(promptDocument) ||
    [
      "You are a senior SEO content writer. Your task is to write a complete article draft based on a provided page brief.",
      "",
      "## Page Brief",
      "{{page_brief}}",
      "",
      "## Runtime Context",
      "- Main keyword: {{main_keyword}}",
      "- Content type: {{content_type}}",
      "- Search intent: {{intent}}",
      "- Topic cluster: {{topic_cluster_name}}",
      "- Internal link role: {{internal_link_role}}",
      "- Keyword variants: {{keyword_variants}}",
      "",
      "Return Markdown only.",
    ].join("\n");

  const prompt = buildPrompt(
    opportunity,
    latestBriefRecord,
    promptTemplate,
    specMarkdown
  );
  const baseUrl = resolveOpenAiBaseUrl();
  const responsesUrl = `${baseUrl}/responses`;
  const requestBody = JSON.stringify({
    model,
    temperature: 0.5,
    max_output_tokens: 4500,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  });

  let response: Awaited<ReturnType<typeof postJson>>;
  try {
    response = await postJson(
      responsesUrl,
      {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      requestBody
    );
  } catch (error) {
    const proxyUrl = resolveOpenAiProxyUrl();
    throw new Error(
      `OpenAI 请求失败（${responsesUrl}）: ${formatRequestFailure(error)}。${
        proxyUrl
          ? `当前已使用代理 ${proxyUrl}。`
          : "当前未配置代理。若本机通过 Clash 等工具访问外网，可设置 OPENAI_HTTP_PROXY=http://127.0.0.1:7890 后重启。"
      } 如果仍无法直连 OpenAI，也可配置 OPENAI_BASE_URL 指向兼容 Responses API 的网关。`
    );
  }

  const payload = (() => {
    try {
      return JSON.parse(response.bodyText || "{}") as OpenAiResponsePayload;
    } catch {
      return {} as OpenAiResponsePayload;
    }
  })();

  if (response.status < 200 || response.status >= 300) {
    const upstreamMessage =
      payload.error?.message?.trim() || "OpenAI 生成初稿失败。";
    throw new Error(
      `OpenAI 生成初稿失败（${response.status} ${response.statusText}）: ${upstreamMessage}`
    );
  }

  const markdown = sanitizeMarkdown(extractOutputText(payload));
  if (!markdown) {
    throw new Error("OpenAI 未返回可用的初稿 Markdown。");
  }

  return {
    markdown,
    model,
  };
}

export async function generateDraftMarkdownStreamWithOpenAi(
  { opportunity, latestBriefRecord }: GenerateDraftParams,
  onDelta?: (delta: string) => void
): Promise<{
  markdown: string;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法生成 AI 初稿。");
  }

  const savedBrief = firstNonEmpty(
    opportunity.briefMarkdown,
    latestBriefRecord?.briefMarkdown
  );
  if (!savedBrief || savedBrief === "—") {
    throw new Error("当前还没有可用的 Brief Markdown，无法生成初稿。");
  }

  const model =
    process.env.OPENAI_DRAFT_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_OPENAI_MODEL;

  const [specMarkdown, promptDocument] = await Promise.all([
    readPromptAsset(
      PROMPT_FILE_URLS.briefSpec,
      "Follow the brief rules defined in `brief-spec-by-content-type.md`."
    ),
    readPromptAsset(
      PROMPT_FILE_URLS.draftPrompt,
      [
        "You are a senior SEO content writer.",
        "Write a complete markdown article draft based on the provided page brief.",
        "Return production-ready Markdown only.",
      ].join(" ")
    ),
  ]);

  const promptTemplate =
    extractPromptTemplate(promptDocument) ||
    [
      "You are a senior SEO content writer. Your task is to write a complete article draft based on a provided page brief.",
      "",
      "## Page Brief",
      "{{page_brief}}",
      "",
      "## Runtime Context",
      "- Main keyword: {{main_keyword}}",
      "- Content type: {{content_type}}",
      "- Search intent: {{intent}}",
      "- Topic cluster: {{topic_cluster_name}}",
      "- Internal link role: {{internal_link_role}}",
      "- Keyword variants: {{keyword_variants}}",
      "",
      "Return Markdown only.",
    ].join("\n");

  const prompt = buildPrompt(
    opportunity,
    latestBriefRecord,
    promptTemplate,
    specMarkdown
  );
  const baseUrl = resolveOpenAiBaseUrl();
  const responsesUrl = `${baseUrl}/responses`;
  const requestBody = JSON.stringify({
    model,
    temperature: 0.5,
    max_output_tokens: 4500,
    stream: true,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  });

  let response: Awaited<ReturnType<typeof postJsonStream>>;
  try {
    response = await postJsonStream(
      responsesUrl,
      {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      requestBody,
      onDelta
    );
  } catch (error) {
    const proxyUrl = resolveOpenAiProxyUrl();
    throw new Error(
      `OpenAI 请求失败（${responsesUrl}）: ${formatRequestFailure(error)}。${
        proxyUrl
          ? `当前已使用代理 ${proxyUrl}。`
          : "当前未配置代理。若本机通过 Clash 等工具访问外网，可设置 OPENAI_HTTP_PROXY=http://127.0.0.1:7890 后重启。"
      } 如果仍无法直连 OpenAI，也可配置 OPENAI_BASE_URL 指向兼容 Responses API 的网关。`
    );
  }

  if (response.status < 200 || response.status >= 300) {
    const payload = (() => {
      try {
        return JSON.parse(response.bodyText || "{}") as OpenAiResponsePayload;
      } catch {
        return {} as OpenAiResponsePayload;
      }
    })();
    const upstreamMessage =
      payload.error?.message?.trim() || "OpenAI 生成初稿失败。";
    throw new Error(
      `OpenAI 生成初稿失败（${response.status} ${response.statusText}）: ${upstreamMessage}`
    );
  }

  const markdown = sanitizeMarkdown(response.outputText);
  if (!markdown) {
    throw new Error("OpenAI 未返回可用的初稿 Markdown。");
  }

  return {
    markdown,
    model: response.model || model,
  };
}
