import http from "node:http";
import https from "node:https";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { HttpsProxyAgent } from "https-proxy-agent";

export type OpenAiResponsePayload = {
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

export const DEFAULT_OPENAI_MODEL = "gpt-4.1-mini";
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const OPENAI_REQUEST_TIMEOUT_MS = 60_000;

let cachedLocalProxyUrl: string | null | undefined;

export function readEnvValue(name: string): string | null {
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

export async function readPromptAsset(
  fileUrl: URL,
  fallback: string
): Promise<string> {
  try {
    return await readFile(fileUrl, "utf8");
  } catch {
    return fallback;
  }
}

export function firstNonEmpty(
  ...values: Array<string | null | undefined>
): string {
  for (const value of values) {
    const trimmed = value?.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return "—";
}

export function extractPromptTemplate(markdown: string): string | null {
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

export function interpolatePromptTemplate(
  template: string,
  variables: Record<string, string>
): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, rawKey: string) => {
    const key = rawKey.trim();
    return variables[key] ?? "—";
  });
}

export function extractOutputText(payload: OpenAiResponsePayload): string {
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

export function sanitizeMarkdown(markdown: string): string {
  const trimmed = markdown.trim();

  if (trimmed.startsWith("```") && trimmed.endsWith("```")) {
    return trimmed
      .replace(/^```[a-zA-Z]*\n?/, "")
      .replace(/\n?```$/, "")
      .trim();
  }

  return trimmed;
}

export function resolveOpenAiBaseUrl(): string {
  return (readEnvValue("OPENAI_BASE_URL") || DEFAULT_OPENAI_BASE_URL).replace(
    /\/+$/,
    ""
  );
}

export function resolveOpenAiProxyUrl(): string | null {
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

export function formatRequestFailure(error: unknown): string {
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

export async function postJson(
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
      request.destroy(new Error(`请求超时（${OPENAI_REQUEST_TIMEOUT_MS}ms）`));
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
    type?: unknown;
    delta?: unknown;
    item?: { delta?: unknown; text?: unknown };
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

export async function postJsonStream(
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
