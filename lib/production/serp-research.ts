/**
 * Serper API (serper.dev) wrapper — fetches Google organic top-10 for a keyword.
 * Set SERPER_API_KEY in .env to enable.
 */

export type SerpOrganicResult = {
  position: number;
  title: string;
  link: string;
  snippet: string;
  sitelinks?: Array<{ title: string; link: string }>;
};

export type SerpFetchResult = {
  keyword: string;
  organic: SerpOrganicResult[];
  peopleAlsoAsk: string[];
  relatedSearches: string[];
};

const SERPER_API_URL = "https://google.serper.dev/search";
const SERPER_REQUEST_TIMEOUT_MS = 15_000;

export class SerpApiNotConfiguredError extends Error {
  constructor() {
    super("缺少 SERPER_API_KEY，无法执行 SERP 调研。请在 .env 中配置后重试。");
    this.name = "SerpApiNotConfiguredError";
  }
}

export async function fetchSerpTop10(
  keyword: string,
  gl = "us",
  hl = "en"
): Promise<SerpFetchResult> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) {
    throw new SerpApiNotConfiguredError();
  }

  const body = JSON.stringify({
    q: keyword,
    gl,
    hl,
    num: 10,
    autocorrect: false,
  });

  const response = await fetch(SERPER_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "X-API-KEY": apiKey,
    },
    body,
    signal: AbortSignal.timeout(SERPER_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Serper API 请求失败（${response.status} ${response.statusText}）: ${text.slice(0, 200)}`
    );
  }

  type SerperResponse = {
    organic?: Array<{
      position?: number;
      title?: string;
      link?: string;
      snippet?: string;
      sitelinks?: Array<{ title?: string; link?: string }>;
    }>;
    peopleAlsoAsk?: Array<{ question?: string }>;
    relatedSearches?: Array<{ query?: string }>;
  };

  const data = (await response.json()) as SerperResponse;

  const organic: SerpOrganicResult[] = (data.organic ?? [])
    .slice(0, 10)
    .map((item, index) => ({
      position: item.position ?? index + 1,
      title: item.title ?? "",
      link: item.link ?? "",
      snippet: item.snippet ?? "",
      sitelinks: (item.sitelinks ?? []).map((s) => ({
        title: s.title ?? "",
        link: s.link ?? "",
      })),
    }));

  const peopleAlsoAsk = (data.peopleAlsoAsk ?? [])
    .map((item) => item.question ?? "")
    .filter(Boolean)
    .slice(0, 6);

  const relatedSearches = (data.relatedSearches ?? [])
    .map((item) => item.query ?? "")
    .filter(Boolean)
    .slice(0, 6);

  return { keyword, organic, peopleAlsoAsk, relatedSearches };
}
