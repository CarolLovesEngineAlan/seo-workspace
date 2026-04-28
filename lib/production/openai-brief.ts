import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import type { OpportunityKeywordRow, WorkbenchOpportunity } from "@/lib/types/opportunity";
import { HttpsProxyAgent } from "https-proxy-agent";
import { buildWhyNowText } from "@/lib/production/why-now";

type GenerateBriefParams = {
  opportunity: WorkbenchOpportunity;
  selectedRows: OpportunityKeywordRow[];
  promptDocumentOverride?: string;
};

type OpenAiResponsePayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;
let cachedLocalProxyUrl: string | null | undefined;
const PROMPT_FILE_URLS = {
  briefSpec: new URL("../../doc/brief-spec-by-content-type.md", import.meta.url),
  briefPrompt: new URL("../../doc/brief-generation-prompt.md", import.meta.url),
  legacyBriefSystem: new URL("../../prompts/brief.txt", import.meta.url),
  legacyBriefTemplate: new URL("../../prompts/brief-template.md", import.meta.url),
} as const;

function readEnvValue(name: string): string | null {
  const value = process.env[name];
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1).trim() || null;
  }

  return trimmed;
}

async function readPromptAsset(
  fileUrl: URL,
  fallback: string
): Promise<string> {
  try {
    return await readFile(fileUrl, "utf8");
  } catch {
    return fallback;
  }
}

function firstNonEmpty(...values: Array<string | null | undefined>): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "—";
}

function extractPromptTemplate(markdown: string): string | null {
  const textBlockMatch = markdown.match(/```text\s*([\s\S]*?)```/i);
  if (textBlockMatch?.[1]?.trim()) {
    return textBlockMatch[1].trim();
  }

  const genericCodeBlockMatch = markdown.match(/```[\w-]*\s*([\s\S]*?)```/i);
  if (genericCodeBlockMatch?.[1]?.trim()) {
    return genericCodeBlockMatch[1].trim();
  }

  return null;
}

function interpolatePromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return variables[key] ?? "—";
  });
}

function extractOutputText(payload: OpenAiResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of payload.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) {
        parts.push(content.text.trim());
      }
    }
  }

  return parts.join("\n").trim();
}

function sanitizeMarkdown(markdown: string): string {
  const trimmed = markdown.trim();

  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  return trimmed;
}

function resolveOpenAiBaseUrl(): string {
  return (readEnvValue("OPENAI_BASE_URL") || DEFAULT_OPENAI_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

function resolveOpenAiProxyUrl(): string | null {
  return (
    readEnvValue("OPENAI_HTTP_PROXY") ||
    readEnvValue("OPENAI_HTTPS_PROXY") ||
    readEnvValue("HTTPS_PROXY") ||
    readEnvValue("HTTP_PROXY") ||
    readEnvValue("ALL_PROXY") ||
    readEnvValue("https_proxy") ||
    readEnvValue("http_proxy") ||
    readEnvValue("all_proxy") ||
    detectLocalClashProxyUrl() ||
    null
  );
}

function detectLocalClashProxyUrl(): string | null {
  if (cachedLocalProxyUrl !== undefined) {
    return cachedLocalProxyUrl;
  }

  try {
    const home = process.env.HOME?.trim();
    if (!home) {
      cachedLocalProxyUrl = null;
      return cachedLocalProxyUrl;
    }

    const configPath = path.join(home, ".config", "clash", "config.yaml");
    const configText = readFileSync(configPath, "utf8");
    const mixedPortMatch = configText.match(/^\s*mixed-port:\s*(\d+)\s*$/m);

    cachedLocalProxyUrl = mixedPortMatch
      ? `http://127.0.0.1:${mixedPortMatch[1]}`
      : null;
    return cachedLocalProxyUrl;
  } catch {
    cachedLocalProxyUrl = null;
    return cachedLocalProxyUrl;
  }
}

function formatRequestFailure(error: unknown): string {
  if (!(error instanceof Error)) {
    return String(error);
  }

  const parts = [error.message];
  const cause = error.cause;

  if (cause && typeof cause === "object") {
    const code =
      "code" in cause && cause.code != null ? String(cause.code) : null;
    const message =
      "message" in cause && cause.message != null ? String(cause.message) : null;

    if (code || message) {
      parts.push([code, message].filter(Boolean).join(" "));
    }
  } else if (cause != null) {
    parts.push(String(cause));
  }

  return parts.filter(Boolean).join(" | ");
}

async function postJson(
  urlString: string,
  headers: Record<string, string>,
  body: string
): Promise<{
  status: number;
  statusText: string;
  bodyText: string;
}> {
  const url = new URL(urlString);
  const requestModule = url.protocol === "https:" ? https : http;
  const proxyUrl = resolveOpenAiProxyUrl();
  const agent =
    proxyUrl && url.protocol === "https:"
      ? new HttpsProxyAgent(proxyUrl)
      : undefined;

  return await new Promise((resolve, reject) => {
    const request = requestModule.request(
      url,
      {
        method: "POST",
        headers: {
          ...headers,
          "content-length": String(Buffer.byteLength(body)),
        },
        agent,
      },
      (response) => {
        const chunks: Buffer[] = [];

        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        response.on("end", () => {
          resolve({
            status: response.statusCode ?? 0,
            statusText: response.statusMessage ?? "",
            bodyText: Buffer.concat(chunks).toString("utf8"),
          });
        });
        response.on("error", reject);
      }
    );

    request.setTimeout(OPENAI_REQUEST_TIMEOUT_MS, () => {
      request.destroy(
        new Error(`请求超时（${OPENAI_REQUEST_TIMEOUT_MS}ms）`)
      );
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function extractStreamDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const typed = payload as {
    delta?: unknown;
    item?: { delta?: unknown; text?: unknown };
    type?: unknown;
  };

  if (typeof typed.delta === "string") {
    return typed.delta;
  }

  if (typeof typed.item?.delta === "string") {
    return typed.item.delta;
  }

  if (typeof typed.item?.text === "string" && typed.type === "response.output_text.delta") {
    return typed.item.text;
  }

  return "";
}

function extractStreamModel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typed = payload as {
    model?: unknown;
    response?: { model?: unknown };
  };

  if (typeof typed.model === "string" && typed.model.trim()) {
    return typed.model;
  }

  if (typeof typed.response?.model === "string" && typed.response.model.trim()) {
    return typed.response.model;
  }

  return null;
}

function extractStreamError(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const typed = payload as {
    type?: unknown;
    error?: { message?: unknown };
    message?: unknown;
  };

  if (
    typeof typed.type === "string" &&
    (typed.type.includes("error") || typed.type.includes("failed"))
  ) {
    if (typeof typed.error?.message === "string" && typed.error.message.trim()) {
      return typed.error.message;
    }

    if (typeof typed.message === "string" && typed.message.trim()) {
      return typed.message;
    }
  }

  return null;
}

async function postJsonStream(
  urlString: string,
  headers: Record<string, string>,
  body: string,
  onDelta?: (delta: string) => void
): Promise<{
  status: number;
  statusText: string;
  outputText: string;
  model: string | null;
  bodyText?: string;
}> {
  const url = new URL(urlString);
  const requestModule = url.protocol === "https:" ? https : http;
  const proxyUrl = resolveOpenAiProxyUrl();
  const agent =
    proxyUrl && url.protocol === "https:"
      ? new HttpsProxyAgent(proxyUrl)
      : undefined;

  return await new Promise((resolve, reject) => {
    const request = requestModule.request(
      url,
      {
        method: "POST",
        headers: {
          ...headers,
          "content-length": String(Buffer.byteLength(body)),
        },
        agent,
      },
      (response) => {
        const status = response.statusCode ?? 0;
        const statusText = response.statusMessage ?? "";

        if (status < 200 || status >= 300) {
          const chunks: Buffer[] = [];
          response.on("data", (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });
          response.on("end", () => {
            resolve({
              status,
              statusText,
              outputText: "",
              model: null,
              bodyText: Buffer.concat(chunks).toString("utf8"),
            });
          });
          response.on("error", reject);
          return;
        }

        let buffer = "";
        let outputText = "";
        let model: string | null = null;

        const processEvent = (rawEvent: string) => {
          const lines = rawEvent
            .split(/\r?\n/)
            .map((line) => line.trim())
            .filter(Boolean);
          const dataLines = lines
            .filter((line) => line.startsWith("data:"))
            .map((line) => line.slice(5).trim());

          if (dataLines.length === 0) {
            return;
          }

          const data = dataLines.join("\n");
          if (data === "[DONE]") {
            return;
          }

          let payload: unknown;
          try {
            payload = JSON.parse(data);
          } catch {
            return;
          }

          model = extractStreamModel(payload) ?? model;

          const streamError = extractStreamError(payload);
          if (streamError) {
            reject(new Error(streamError));
            request.destroy();
            return;
          }

          const delta = extractStreamDelta(payload);
          if (delta) {
            outputText += delta;
            onDelta?.(delta);
            return;
          }

          if (!outputText && payload && typeof payload === "object") {
            const completedPayload = payload as { response?: OpenAiResponsePayload };
            const fallbackText = completedPayload.response
              ? extractOutputText(completedPayload.response)
              : "";
            if (fallbackText) {
              outputText = fallbackText;
            }
          }
        };

        response.on("data", (chunk) => {
          buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex !== -1) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            processEvent(rawEvent);
            boundaryIndex = buffer.indexOf("\n\n");
          }
        });

        response.on("end", () => {
          if (buffer.trim()) {
            processEvent(buffer);
          }

          resolve({
            status,
            statusText,
            outputText,
            model,
          });
        });
        response.on("error", reject);
      }
    );

    request.setTimeout(OPENAI_REQUEST_TIMEOUT_MS, () => {
      request.destroy(new Error(`请求超时（${OPENAI_REQUEST_TIMEOUT_MS}ms）`));
    });
    request.on("error", reject);
    request.write(body);
    request.end();
  });
}

function buildPrompt(
  opportunity: WorkbenchOpportunity,
  selectedRows: OpportunityKeywordRow[],
  promptTemplate: string,
  specMarkdown: string
): string {
  const targetRow = selectedRows[0];
  const targetMainKeyword = firstNonEmpty(
    targetRow?.mainKeyword,
    opportunity.mainKeyword
  );
  const targetContentType = firstNonEmpty(
    targetRow?.contentType,
    targetRow?.contentTypeLlm,
    opportunity.resolvedContentType
  );
  const targetIntent = firstNonEmpty(targetRow?.intent, opportunity.intent);
  const targetKeywordVariants = firstNonEmpty(
    targetRow?.keywordVariants,
    opportunity.keywordVariants
  );
  const targetTopicClusterName = firstNonEmpty(opportunity.topicClusterName);
  const targetInternalLinkRole = firstNonEmpty(opportunity.internalLinkRole);
  const targetPageBrief = firstNonEmpty(opportunity.pageBrief);
  const whyNow = opportunity.whyNow ?? buildWhyNowText(opportunity);
  const sourceUrls = opportunity.sourceUrls.length
    ? opportunity.sourceUrls.map((url) => `- ${url}`).join("\n")
    : "- —";
  const selectedRowsBlock = selectedRows
    .map(
      (row, index) =>
        `${index + 1}. main_keyword=${row.mainKeyword || "—"} | content_type=${
          row.contentType || row.contentTypeLlm || "—"
        } | intent=${row.intent || "—"} | keyword_variants=${
          row.keywordVariants || "—"
        } | volume=${row.volume} | kd=${row.kd}`
    )
    .join("\n");

  const hydratedPrompt = interpolatePromptTemplate(promptTemplate, {
    topic_cluster_name: targetTopicClusterName,
    content_type: targetContentType,
    intent: targetIntent,
    internal_link_role: targetInternalLinkRole,
    main_keyword: targetMainKeyword,
    keyword_variants: targetKeywordVariants,
    page_brief: targetPageBrief,
  });

  return [
    hydratedPrompt.trim(),
    "",
    "## Canonical brief specification",
    "The following markdown document is the source of truth for brief generation. If any instruction conflicts with anything else, this specification wins.",
    "",
    specMarkdown.trim(),
    "",
    "## Runtime Context",
    "This generation request is for a single page brief. Use the selected row as the primary target.",
    `same_page_group_id: ${opportunity.groupId}`,
    `group main_keyword: ${opportunity.mainKeyword}`,
    `group all_keywords: ${opportunity.allKeywords || "—"}`,
    `group keyword_variants: ${opportunity.keywordVariants || "—"}`,
    `intent: ${opportunity.intent || "—"}`,
    `resolved content_type: ${opportunity.resolvedContentType || "—"}`,
    `topic cluster: ${opportunity.topicClusterName || "—"}`,
    `internal link role: ${opportunity.internalLinkRole || "—"}`,
    `volume: ${opportunity.volume}`,
    `kd: ${opportunity.kd}`,
    `variant_count: ${opportunity.variantCount}`,
    `why_now: ${whyNow}`,
    "",
    "## Target Page Inputs",
    `topic_cluster_name: ${targetTopicClusterName}`,
    `content_type: ${targetContentType}`,
    `intent: ${targetIntent}`,
    `internal_link_role: ${targetInternalLinkRole}`,
    `main_keyword: ${targetMainKeyword}`,
    `keyword_variants: ${targetKeywordVariants}`,
    `page_brief: ${targetPageBrief}`,
    "",
    "## Selected Source Rows",
    selectedRowsBlock || "—",
    "",
    "## Existing Page Brief",
    opportunity.pageBrief?.trim() || "—",
    "",
    "## Reference URLs",
    sourceUrls,
    "",
    "## Output Guardrails",
    "- Return Markdown only.",
    "- Do not wrap the answer in code fences.",
    "- Do not invent extra input fields beyond the confirmed field concepts in the specification.",
    "- Default to English unless the keyword and page context are clearly Chinese.",
  ].join("\n");
}

export async function generateBriefMarkdownWithOpenAi({
  opportunity,
  selectedRows,
  promptDocumentOverride,
}: GenerateBriefParams): Promise<{
  markdown: string;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法生成 AI brief。");
  }

  if (selectedRows.length === 0) {
    throw new Error("至少需要选择一条 MAIN_KEYWORD 才能生成 brief。");
  }

  const model =
    process.env.OPENAI_BRIEF_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL;

  const promptDocumentPromise = promptDocumentOverride
    ? Promise.resolve(promptDocumentOverride)
    : readPromptAsset(PROMPT_FILE_URLS.briefPrompt, "");

  const [specMarkdown, promptDocument, legacySystemPrompt, legacyTemplate] =
    await Promise.all([
      readPromptAsset(PROMPT_FILE_URLS.briefSpec, ""),
      promptDocumentPromise,
      readPromptAsset(
        PROMPT_FILE_URLS.legacyBriefSystem,
        [
          "You are a senior SEO strategist generating production-ready content briefs.",
          "Return concise, actionable Markdown only.",
          "Follow the provided brief template exactly.",
        ].join(" ")
      ),
      readPromptAsset(
        PROMPT_FILE_URLS.legacyBriefTemplate,
        "Goal:\n[fill]\n\nTarget reader:\n[fill]\n\nIntent:\n[fill]\n\nContent type:\n[fill]\n\nStructure:\n[fill]\n\nMust include:\n[fill]\n\nInternal links:\n[fill]\n\nAvoid:\n[fill]\n\nEstimated word count:\n[fill]"
      ),
    ]);
  const promptTemplate =
    extractPromptTemplate(promptDocument) ||
    [legacySystemPrompt.trim(), "", legacyTemplate.trim()].join("\n");
  const resolvedSpecMarkdown =
    specMarkdown.trim() ||
    "Follow the brief rules defined in `brief-spec-by-content-type.md`.";

  const prompt = buildPrompt(
    opportunity,
    selectedRows,
    promptTemplate,
    resolvedSpecMarkdown
  );
  const baseUrl = resolveOpenAiBaseUrl();
  const responsesUrl = `${baseUrl}/responses`;
  const requestBody = JSON.stringify({
    model,
    temperature: 0.3,
    max_output_tokens: 2200,
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
      payload.error?.message?.trim() || "OpenAI 生成 brief 失败。";
    throw new Error(
      `OpenAI 生成 brief 失败（${response.status} ${response.statusText}）: ${upstreamMessage}`
    );
  }

  const markdown = sanitizeMarkdown(extractOutputText(payload));
  if (!markdown) {
    throw new Error("OpenAI 未返回可用的 brief Markdown。");
  }

  return {
    markdown,
    model,
  };
}

export async function generateBriefMarkdownStreamWithOpenAi(
  { opportunity, selectedRows, promptDocumentOverride }: GenerateBriefParams,
  onDelta?: (delta: string) => void
): Promise<{
  markdown: string;
  model: string;
}> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法生成 AI brief。");
  }

  if (selectedRows.length === 0) {
    throw new Error("至少需要选择一条 MAIN_KEYWORD 才能生成 brief。");
  }

  const model =
    process.env.OPENAI_BRIEF_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    DEFAULT_MODEL;

  const promptDocumentPromise = promptDocumentOverride
    ? Promise.resolve(promptDocumentOverride)
    : readPromptAsset(PROMPT_FILE_URLS.briefPrompt, "");

  const [specMarkdown, promptDocument, legacySystemPrompt, legacyTemplate] =
    await Promise.all([
      readPromptAsset(PROMPT_FILE_URLS.briefSpec, ""),
      promptDocumentPromise,
      readPromptAsset(
        PROMPT_FILE_URLS.legacyBriefSystem,
        [
          "You are a senior SEO strategist generating production-ready content briefs.",
          "Return concise, actionable Markdown only.",
          "Follow the provided brief template exactly.",
        ].join(" ")
      ),
      readPromptAsset(
        PROMPT_FILE_URLS.legacyBriefTemplate,
        "Goal:\n[fill]\n\nTarget reader:\n[fill]\n\nIntent:\n[fill]\n\nContent type:\n[fill]\n\nStructure:\n[fill]\n\nMust include:\n[fill]\n\nInternal links:\n[fill]\n\nAvoid:\n[fill]\n\nEstimated word count:\n[fill]"
      ),
    ]);
  const promptTemplate =
    extractPromptTemplate(promptDocument) ||
    [legacySystemPrompt.trim(), "", legacyTemplate.trim()].join("\n");
  const resolvedSpecMarkdown =
    specMarkdown.trim() ||
    "Follow the brief rules defined in `brief-spec-by-content-type.md`.";

  const prompt = buildPrompt(
    opportunity,
    selectedRows,
    promptTemplate,
    resolvedSpecMarkdown
  );
  const baseUrl = resolveOpenAiBaseUrl();
  const responsesUrl = `${baseUrl}/responses`;
  const requestBody = JSON.stringify({
    model,
    temperature: 0.3,
    max_output_tokens: 2200,
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
      payload.error?.message?.trim() || "OpenAI 生成 brief 失败。";
    throw new Error(
      `OpenAI 生成 brief 失败（${response.status} ${response.statusText}）: ${upstreamMessage}`
    );
  }

  const markdown = sanitizeMarkdown(response.outputText);
  if (!markdown) {
    throw new Error("OpenAI 未返回可用的 brief Markdown。");
  }

  return {
    markdown,
    model: response.model || model,
  };
}
