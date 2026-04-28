import { NextResponse } from "next/server";
import { normalizeNextPath } from "@/lib/auth/next-path";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

async function exchangeCode(code: string, redirectUri: string): Promise<string> {
  const res = await fetch("https://open.feishu.cn/open-apis/authen/v2/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      client_id: process.env.FEISHU_APP_ID?.trim(),
      client_secret: process.env.FEISHU_APP_SECRET?.trim(),
      redirect_uri: redirectUri,
    }),
  });
  const json = (await res.json()) as { access_token?: string; error?: string };
  if (!json.access_token) {
    throw new Error(`飞书 token 换取失败: ${json.error ?? "unknown"}`);
  }
  return json.access_token;
}

async function fetchUserInfo(accessToken: string): Promise<{ email: string; name: string }> {
  const res = await fetch("https://open.feishu.cn/open-apis/authen/v1/user_info", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const json = (await res.json()) as { data?: { email?: string; enterprise_email?: string; name?: string } };
  const email = json.data?.email || json.data?.enterprise_email;
  if (!email) throw new Error("无法获取飞书邮箱，请确认应用已开通 contact:user.email:readonly 权限");
  return { email, name: json.data?.name ?? "" };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const next = normalizeNextPath(state ? decodeURIComponent(state) : "/workbench");
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim() || origin;
  const loginUrl = `${origin}/login`;

  if (!code) {
    return NextResponse.redirect(`${loginUrl}?error=missing_code`);
  }

  try {
    const redirectUri = `${appUrl}/api/auth/feishu/callback`;
    const accessToken = await exchangeCode(code, redirectUri);
    const { email, name } = await fetchUserInfo(accessToken);

    const admin = getSupabaseAdmin();
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: {
        data: { full_name: name, provider: "feishu" },
        redirectTo: `${appUrl}${next}`,
      },
    });

    if (error || !data.properties?.action_link) {
      throw new Error(error?.message ?? "生成登录链接失败");
    }

    return NextResponse.redirect(data.properties.action_link);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.redirect(`${loginUrl}?error=${encodeURIComponent(msg)}`);
  }
}
