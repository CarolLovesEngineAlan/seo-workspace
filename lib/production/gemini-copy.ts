/**
 * Copy generation via Google Gemini API (streaming).
 *
 * Required env vars:
 *   GEMINI_API_KEY
 * Optional:
 *   GEMINI_COPY_MODEL  (default: gemini-2.5-flash)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_MODEL = "gemini-2.5-flash";

function readEnv(name: string): string | null {
  const v = process.env[name]?.trim();
  if (!v) return null;
  return v;
}

export async function generateCopyStream(
  promptText: string,
  onDelta?: (delta: string) => void
): Promise<{ markdown: string; model: string }> {
  const apiKey = readEnv("GEMINI_API_KEY");
  if (!apiKey) throw new Error("缺少 GEMINI_API_KEY，无法调用 Gemini。");

  const modelName = readEnv("GEMINI_COPY_MODEL") ?? DEFAULT_MODEL;
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 8000,
    },
  });

  const result = await model.generateContentStream(promptText);

  let outputText = "";
  for await (const chunk of result.stream) {
    const delta = chunk.text();
    if (delta) {
      outputText += delta;
      onDelta?.(delta);
    }
  }

  if (!outputText.trim()) throw new Error("Gemini 未返回内容。");

  return { markdown: outputText.trim(), model: modelName };
}
