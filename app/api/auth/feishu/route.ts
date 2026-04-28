import { NextResponse } from "next/server";
import { normalizeNextPath } from "@/lib/auth/next-path";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const next = normalizeNextPath(searchParams.get("next") ?? "/workbench");

  const appId = process.env.FEISHU_APP_ID?.trim();
  const headers = request instanceof Request ? request.headers : new Headers();
  const forwardedProto = headers.get("x-forwarded-proto")?.split(",")[0].trim();
  const forwardedHost = headers.get("x-forwarded-host")?.split(",")[0].trim();
  const inferredOrigin =
    forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : origin;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || inferredOrigin;

  if (!appId) {
    return NextResponse.redirect(`${origin}/login?error=feishu_not_configured`);
  }

  const redirectUri = `${appUrl}/api/auth/feishu/callback`;
  const url = new URL("https://open.feishu.cn/open-apis/authen/v1/authorize");
  url.searchParams.set("app_id", appId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", encodeURIComponent(next));

  return NextResponse.redirect(url.toString());
}
