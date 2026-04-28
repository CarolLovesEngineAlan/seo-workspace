/**
 * Outline generation via AWS Bedrock (Claude Sonnet).
 * Drop-in replacement for openai-outline.ts — same return signature.
 *
 * Required env vars:
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_REGION            (default: us-east-1)
 * Optional:
 *   AWS_SESSION_TOKEN     (if using temporary credentials / IAM role)
 *   BEDROCK_OUTLINE_MODEL (default: us.anthropic.claude-sonnet-4-6-20250514-v1:0)
 */

import AnthropicBedrock from "@anthropic-ai/bedrock-sdk";

const DEFAULT_MODEL = "us.anthropic.claude-sonnet-4-6";
const TIMEOUT_MS = 120_000;

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  if (!v) return null;
  return v;
}

function buildClient(): AnthropicBedrock {
  const region = readEnv("AWS_REGION") ?? "us-east-1";
  const hasBearerToken = !!readEnv("AWS_BEARER_TOKEN_BEDROCK");
  const accessKey = readEnv("AWS_ACCESS_KEY_ID");
  const secretKey = readEnv("AWS_SECRET_ACCESS_KEY");

  if (!hasBearerToken && (!accessKey || !secretKey)) {
    throw new Error(
      "缺少 AWS_BEARER_TOKEN_BEDROCK 或 AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY，无法调用 Bedrock。"
    );
  }

  if (hasBearerToken || !accessKey || !secretKey) {
    // SDK reads AWS_BEARER_TOKEN_BEDROCK from env automatically
    return new AnthropicBedrock({ awsRegion: region, timeout: TIMEOUT_MS });
  }

  return new AnthropicBedrock({
    awsAccessKey: accessKey,
    awsSecretKey: secretKey,
    awsSessionToken: readEnv("AWS_SESSION_TOKEN") ?? undefined,
    awsRegion: region,
    timeout: TIMEOUT_MS,
  });
}

export async function generateOutlineStream(
  promptText: string,
  onDelta?: (delta: string) => void
): Promise<{ markdown: string; model: string }> {
  const client = buildClient();
  const model = readEnv("BEDROCK_OUTLINE_MODEL") ?? DEFAULT_MODEL;

  let outputText = "";

  const stream = client.messages.stream({
    model,
    max_tokens: 4000,
    temperature: 0.4,
    messages: [{ role: "user", content: promptText }],
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      const delta = event.delta.text;
      outputText += delta;
      onDelta?.(delta);
    }
  }

  if (!outputText.trim()) throw new Error("Bedrock 未返回内容，请检查模型 ID 和权限。");

  return { markdown: outputText.trim(), model };
}

export { injectVariables } from "./openai-outline";
