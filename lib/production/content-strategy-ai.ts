/**
 * AI-powered content strategy generator.
 * Takes SERP research data + opportunity context, returns a structured Markdown strategy.
 */

import type { WorkbenchOpportunity } from "@/lib/types/opportunity";
import type { SerpFetchResult } from "@/lib/production/serp-research";

const SYSTEM_PROMPT = `你是一位资深 SEO 内容策略师，擅长分析 SERP 竞争格局并为新内容找到差异化机会。

请用中文输出，结构清晰、观点明确、建议可落地。避免泛泛而谈，每个结论都应有 SERP 数据或关键词数据作为依据。`;

function buildStrategyPrompt(
  opportunity: WorkbenchOpportunity,
  serp: SerpFetchResult
): string {
  const serpBlock = serp.organic
    .map(
      (r) =>
        `${r.position}. **${r.title}**\n   ${r.link}\n   ${r.snippet}`
    )
    .join("\n\n");

  const paaBlock =
    serp.peopleAlsoAsk.length > 0
      ? serp.peopleAlsoAsk.map((q) => `- ${q}`).join("\n")
      : "（无数据）";

  const relatedBlock =
    serp.relatedSearches.length > 0
      ? serp.relatedSearches.map((q) => `- ${q}`).join("\n")
      : "（无数据）";

  return `## 任务

分析以下 SERP 数据，为目标页面制定内容策略。

---

## 目标页面信息

- **核心关键词**: ${opportunity.mainKeyword}
- **内容类型**: ${opportunity.resolvedContentType || "—"}
- **搜索意图**: ${opportunity.intent || "—"}
- **月均搜索量**: ${opportunity.volume}
- **竞争难度 KD**: ${opportunity.kd}
- **主题群**: ${opportunity.topicClusterName || "—"}
- **内链角色**: ${opportunity.internalLinkRole || "—"}
- **相关词**: ${opportunity.allKeywords || "—"}
${opportunity.pageBrief ? `- **现有 Page Brief**: ${opportunity.pageBrief}` : ""}

---

## SERP Top 10

${serpBlock}

---

## People Also Ask

${paaBlock}

---

## Related Searches

${relatedBlock}

---

## 输出格式

请输出以下五个部分，每部分用 ## 二级标题标注：

### 1. 当前 SERP 格局
分析前 10 名内容的共性：内容形式、覆盖角度、权威性来源、明显的内容模式。

### 2. 现有内容的价值点
前 10 名做得好的地方——读者为什么会点进去、停留、认可这些内容。

### 3. 现有内容的薄弱点
前 10 名集体忽视或覆盖不足的地方——这是我们的切入口。

### 4. 我们的差异化机会
基于薄弱点和我们的定位，提出 2-3 个具体的差异化角度，说明为什么我们有胜算。

### 5. 关键词布局优先级
结合 PAA 和相关搜索，给出：
- **主词**：页面标题和 H1 的核心关键词
- **次要关键词**：H2/H3 应自然覆盖的词
- **长尾词**：FAQ 或补充段落可以覆盖的词

---

请直接输出上述五个部分的内容，不要加额外的前言或后记。`;
}

type OpenAiPayload = {
  output_text?: string;
  output?: Array<{
    type?: string;
    content?: Array<{ type?: string; text?: string }>;
  }>;
  error?: { message?: string };
};

function extractText(payload: OpenAiPayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts: string[] = [];
  for (const item of payload.output ?? []) {
    for (const c of item.content ?? []) {
      if (typeof c.text === "string" && c.text.trim()) {
        parts.push(c.text.trim());
      }
    }
  }
  return parts.join("\n").trim();
}

export async function generateContentStrategyWithAi(
  opportunity: WorkbenchOpportunity,
  serp: SerpFetchResult
): Promise<{ markdown: string; model: string }> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("缺少 OPENAI_API_KEY，无法生成内容策略。");
  }

  const baseUrl = (
    process.env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");

  const model =
    process.env.OPENAI_STRATEGY_MODEL?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4.1-mini";

  const prompt = buildStrategyPrompt(opportunity, serp);

  const body = JSON.stringify({
    model,
    temperature: 0.4,
    max_output_tokens: 2000,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: SYSTEM_PROMPT }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: prompt }],
      },
    ],
  });

  const response = await fetch(`${baseUrl}/responses`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`,
    },
    body,
    signal: AbortSignal.timeout(90_000),
  });

  const text = await response.text();
  let payload: OpenAiPayload;
  try {
    payload = JSON.parse(text) as OpenAiPayload;
  } catch {
    throw new Error(`OpenAI 返回了非 JSON 响应: ${text.slice(0, 200)}`);
  }

  if (!response.ok) {
    const msg = payload.error?.message?.trim() || response.statusText;
    throw new Error(`OpenAI 内容策略生成失败（${response.status}）: ${msg}`);
  }

  const markdown = extractText(payload).replace(/^```[\w-]*\n?/, "").replace(/\n?```$/, "").trim();
  if (!markdown) {
    throw new Error("OpenAI 未返回可用的内容策略文本。");
  }

  return { markdown, model };
}
