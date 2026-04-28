const DEFAULT_NEXT_PATH = "/workbench";

export function normalizeNextPath(
  value: string | null | undefined,
  fallback = DEFAULT_NEXT_PATH
): string {
  const next = value?.trim();

  if (!next || !next.startsWith("/") || next.startsWith("//")) {
    return fallback;
  }

  try {
    const url = new URL(next, "http://localhost");
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function buildLoginRedirectUrl(
  origin: string,
  next: string,
  error?: string | null
): string {
  const url = new URL("/login", origin);
  const normalizedNext = normalizeNextPath(next);

  if (normalizedNext) {
    url.searchParams.set("next", normalizedNext);
  }

  if (error) {
    url.searchParams.set("error", error);
  }

  return url.toString();
}
