import { NextResponse } from "next/server";
import { normalizeNextPath } from "@/lib/auth/next-path";
import { getSupabaseAdmin } from "@/lib/supabase/admin-client";

export const dynamic = "force-dynamic";

async function getAppAccessToken(): Promise<string> {
  const res = await fetch(
    "https://open.feishu.cn/open-apis/auth/v3/app_access_token/internal",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app_id: process.env.FEISHU_APP_ID?.trim(),
        app_secret: process.env.FEISHU_APP_SECRET?.trim(),
      }),
    }
  );
  const json = (await res.json()) as { app_access_token?: string; msg?: string };
  if (!json.app_access_token) {
    throw new Error(`获取飞书 app_access_token 失败: ${json.msg ?? "unknown"}`);
  }
  return json.app_access_token;
}

async function getUserAccessToken(code: string, appAccessToken: string): Promise<string> {
  const res = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/oidc_access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${appAccessToken}`,
      },
      body: JSON.stringify({ grant_type: "authorization_code", code }),
    }
  );
  const json = (await res.json()) as {
    data?: { access_token?: string };
    msg?: string;
    code?: number;
  };
  const token = json.data?.access_token;
  if (!token) {
    throw new Error(`飞书 code 换取 token 失败: ${json.msg ?? JSON.stringify(json)}`);
  }
  return token;
}

async function fetchUserInfo(
  userAccessToken: string
): Promise<{ email: string; name: string }> {
  const res = await fetch(
    "https://open.feishu.cn/open-apis/authen/v1/user_info",
    { headers: { Authorization: `Bearer ${userAccessToken}` } }
  );
  const json = (await res.json()) as {
    data?: { email?: string; enterprise_email?: string; name?: string };
  };
  const email = json.data?.email || json.data?.enterprise_email;
  if (!email) {
    throw new Error(
      "无法获取飞书邮箱，请在飞书开放平台开通 contact:user.email:readonly 权限"
    );
  }
  return { email, name: json.data?.name ?? "" };
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const next = normalizeNextPath(state ? decodeURIComponent(state) : "/workbench");
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin).replace(/\/$/, "");
  const loginUrl = `${origin}/login`;

  if (!code) {
    return NextResponse.redirect(`${loginUrl}?error=missing_code`);
  }

  try {
    const appAccessToken = await getAppAccessToken();
    const userAccessToken = await getUserAccessToken(code, appAccessToken);
    const { email, name } = await fetchUserInfo(userAccessToken);

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
