/**
 * Outline generation via OpenAI — streaming.
 * Uses the same Responses API + proxy detection as openai-brief.ts.
 */

import http from "node:http";
import https from "node:https";
import { readFileSync } from "node:fs";
import path from "node:path";
import { HttpsProxyAgent } from "https-proxy-agent";

const DEFAULT_MODEL = "gpt-4.1-mini";
const DEFAULT_BASE_URL = "https://api.openai.com/v1";
const TIMEOUT_MS = 120_000;

let cachedProxy: string | null | undefined;

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  if (!v) return null;
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1).trim() || null;
  }
  return v;
}

function resolveBaseUrl(): string {
  return (readEnv("OPENAI_BASE_URL") || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function detectClashProxy(): string | null {
  if (cachedProxy !== undefined) return cachedProxy;
  try {
    const home = process.env.HOME?.trim();
    if (!home) {
      cachedProxy = null;
      return null;
    }
    const configPath = path.join(home, ".config", "clash", "config.yaml");
    const text = readFileSync(configPath, "utf8");
    const m = text.match(/^\s*mixed-port:\s*(\d+)\s*$/m);
    cachedProxy = m ? `http://127.0.0.1:${m[1]}` : null;
  } catch {
    cachedProxy = null;
  }
  return cachedProxy;
}

function resolveProxy(): string | null {
  return (
    readEnv("OPENAI_HTTP_PROXY") ||
    readEnv("OPENAI_HTTPS_PROXY") ||
    readEnv("HTTPS_PROXY") ||
    readEnv("HTTP_PROXY") ||
    readEnv("ALL_PROXY") ||
    readEnv("https_proxy") ||
    readEnv("http_proxy") ||
    readEnv("all_proxy") ||
    detectClashProxy() ||
    null
  );
}

function extractDelta(payload: unknown): string {
  if (!payload || typeof payload !== "object") return "";
  const p = payload as Record<string, unknown>;
  if (typeof p.delta === "string") return p.delta;
  if (p.item && typeof p.item === "object") {
    const item = p.item as Record<string, unknown>;
    if (typeof item.delta === "string") return item.delta;
    if (typeof item.text === "string" && p.type === "response.output_text.delta")
      return item.text;
  }
  return "";
}

function extractModel(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const p = payload as Record<string, unknown>;
  if (typeof p.model === "string" && p.model.trim()) return p.model;
  if (p.response && typeof p.response === "object") {
    const r = p.response as Record<string, unknown>;
    if (typeof r.model === "string" && r.model.trim()) return r.model;
  }
  return null;
}

async function postStream(
  urlString: string,
  headers: Record<string, string>,
  body: string,
  onDelta?: (d: string) => void
): Promise<{ outputText: string; model: string | null; status: number; statusText: string; bodyText?: string }> {
  const url = new URL(urlString);
  const reqModule = url.protocol === "https:" ? https : http;
  const proxyUrl = resolveProxy();
  const agent =
    proxyUrl && url.protocol === "https:"
      ? new HttpsProxyAgent(proxyUrl)
      : undefined;

  return new Promise((resolve, reject) => {
    const req = reqModule.request(
      url,
      {
        method: "POST",
        headers: { ...headers, "content-length": String(Buffer.byteLength(body)) },
        agent,
      },
      (res) => {
        const status = res.statusCode ?? 0;
        const statusText = res.statusMessage ?? "";

        if (status < 200 || status >= 300) {
          const chunks: Buffer[] = [];
          res.on("data", (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
          res.on("end", () =>
            resolve({
              status,
              statusText,
              outputText: "",
              model: null,
              bodyText: Buffer.concat(chunks).toString("utf8"),
            })
          );
          res.on("error", reject);
          return;
        }

        let buf = "";
        let outputText = "";
        let model: string | null = null;

        const processEvent = (raw: string) => {
          const dataLines = raw
            .split(/\r?\n/)
            .filter((l) => l.startsWith("data:"))
            .map((l) => l.slice(5).trim());
          if (!dataLines.length) return;
          const data = dataLines.join("\n");
          if (data === "[DONE]") return;
          let payload: unknown;
          try {
            payload = JSON.parse(data);
          } catch {
            return;
          }
          model = extractModel(payload) ?? model;
          const delta = extractDelta(payload);
          if (delta) {
            outputText += delta;
            onDelta?.(delta);
          }
        };

        res.on("data", (chunk) => {
          buf += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : String(chunk);
          let i = buf.indexOf("\n\n");
          while (i !== -1) {
            processEvent(buf.slice(0, i));
            buf = buf.slice(i + 2);
            i = buf.indexOf("\n\n");
          }
        });
        res.on("end", () => {
          if (buf.trim()) processEvent(buf);
          resolve({ status, statusText, outputText, model });
        });
        res.on("error", reject);
      }
    );

    req.setTimeout(TIMEOUT_MS, () =>
      req.destroy(new Error(`请求超时（${TIMEOUT_MS}ms）`))
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Public API ────────────────────────────────────────────────

export async function generateOutlineStream(
  promptText: string,
  onDelta?: (delta: string) => void
): Promise<{ markdown: string; model: string }> {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY，无法生成大纲。");

  const model =
    readEnv("OPENAI_BRIEF_MODEL") || readEnv("OPENAI_MODEL") || DEFAULT_MODEL;

  const baseUrl = resolveBaseUrl();
  const url = `${baseUrl}/responses`;

  const body = JSON.stringify({
    model,
    temperature: 0.4,
    max_output_tokens: 4000,
    stream: true,
    input: [
      {
        role: "user",
        content: [{ type: "input_text", text: promptText }],
      },
    ],
  });

  let res: Awaited<ReturnType<typeof postStream>>;
  try {
    res = await postStream(
      url,
      { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body,
      onDelta
    );
  } catch (err) {
    const proxyUrl = resolveProxy();
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      `OpenAI 请求失败（${url}）: ${msg}。${
        proxyUrl
          ? `当前代理: ${proxyUrl}。`
          : "未配置代理。可设置 OPENAI_HTTP_PROXY=http://127.0.0.1:7890 后重启。"
      }`
    );
  }

  if (res.status < 200 || res.status >= 300) {
    let upstreamMsg = "OpenAI 返回错误。";
    try {
      const p = JSON.parse(res.bodyText ?? "{}") as { error?: { message?: string } };
      if (p.error?.message) upstreamMsg = p.error.message;
    } catch {
      /* ignore */
    }
    throw new Error(`OpenAI 错误（${res.status} ${res.statusText}）: ${upstreamMsg}`);
  }

  const markdown = res.outputText.trim();
  if (!markdown) throw new Error("OpenAI 未返回内容。");

  return { markdown, model: res.model ?? model };
}

/**
 * Replace {variable} placeholders in the prompt text.
 * Already-replaced placeholders (brand_context, internal_link_library) are ignored.
 */
export function injectVariables(
  text: string,
  vars: Record<string, string>
): string {
  return text.replace(/\{([a-zA-Z0-9_]+)\}/g, (match, key: string) => {
    return vars[key] !== undefined && vars[key].trim() ? vars[key] : match;
  });
}
