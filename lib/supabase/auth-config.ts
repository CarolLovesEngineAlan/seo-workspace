import { normalizeNextPath } from "@/lib/auth/next-path";

function normalizePublicUrl(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    return "";
  }

  const withProtocol = /^https?:\/\//i.test(trimmed)
    ? trimmed
    : `https://${trimmed}`;

  return withProtocol.replace(/\/$/, "");
}

export function getSupabaseAuthUrl(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    ""
  );
}

export function getSupabaseAnonKey(): string {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
}

export function getPublicAppUrl(): string {
  return normalizePublicUrl(
    process.env.NEXT_PUBLIC_APP_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_VERCEL_URL?.trim() ||
    ""
  );
}

function tryParseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

function isLocalHostname(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "0.0.0.0" ||
    hostname === "::1"
  );
}

function shouldPreferFallbackOrigin(
  configuredUrl: string,
  fallbackOrigin: string
): boolean {
  if (!fallbackOrigin) {
    return false;
  }

  const configured = tryParseUrl(configuredUrl);
  const fallback = tryParseUrl(fallbackOrigin);

  if (!configured || !fallback) {
    return false;
  }

  return (
    isLocalHostname(configured.hostname) && !isLocalHostname(fallback.hostname)
  );
}

export function getAuthRedirectUrl(nextPath = "/workbench", fallbackOrigin = ""): string {
  const normalizedNextPath = normalizeNextPath(nextPath);
  const explicitRedirect = process.env.NEXT_PUBLIC_AUTH_REDIRECT_URL?.trim();

  if (explicitRedirect) {
    if (!shouldPreferFallbackOrigin(explicitRedirect, fallbackOrigin)) {
      const url = new URL(explicitRedirect);
      url.searchParams.set("next", normalizedNextPath);
      return url.toString();
    }
  }

  const configuredBaseUrl = getPublicAppUrl();
  const baseUrl =
    configuredBaseUrl &&
    !shouldPreferFallbackOrigin(configuredBaseUrl, fallbackOrigin)
      ? configuredBaseUrl
      : fallbackOrigin || configuredBaseUrl;

  if (!baseUrl) {
    return "";
  }

  const normalizedBaseUrl = normalizePublicUrl(baseUrl);
  return `${normalizedBaseUrl}/auth/callback?next=${encodeURIComponent(normalizedNextPath)}`;
}

function decodeBase64Url(value: string): string | null {
  try {
    const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");

    if (typeof atob === "function") {
      return atob(padded);
    }

    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return null;
  }
}

function readJwtRole(token: string): string | null {
  const [, payload] = token.split(".");

  if (!payload) {
    return null;
  }

  const decoded = decodeBase64Url(payload);

  if (!decoded) {
    return null;
  }

  try {
    const parsed = JSON.parse(decoded) as { role?: unknown };
    return typeof parsed.role === "string" ? parsed.role : null;
  } catch {
    return null;
  }
}

export function getSupabaseAuthConfigError(): string | null {
  const url = getSupabaseAuthUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return "缺少 NEXT_PUBLIC_SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_ANON_KEY，无法初始化浏览器 Supabase Auth。";
  }

  const keyRole = readJwtRole(anonKey);

  if (keyRole && keyRole !== "anon") {
    return "NEXT_PUBLIC_SUPABASE_ANON_KEY 必须使用 Supabase 的 anon/public key。当前看起来配置成了高权限 key，请改回 anon key。";
  }

  return null;
}

export function isSupabaseAuthConfigured(): boolean {
  return getSupabaseAuthConfigError() === null;
}
