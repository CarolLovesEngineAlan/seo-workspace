import { NextResponse } from "next/server";
import { buildLoginRedirectUrl, normalizeNextPath } from "@/lib/auth/next-path";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getErrorMessage, withTimeout } from "@/lib/utils/promise";

const CALLBACK_TIMEOUT_MS = 8_000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = normalizeNextPath(searchParams.get("next"));

  if (!code) {
    return NextResponse.redirect(
      buildLoginRedirectUrl(origin, next, "missing_code")
    );
  }

  const supabase = await createSupabaseServerClient();
  let errorMessage: string | null = null;

  try {
    const { error } = await withTimeout(
      supabase.auth.exchangeCodeForSession(code),
      CALLBACK_TIMEOUT_MS,
      "Supabase 登录回调"
    );

    errorMessage = error?.message ?? null;
  } catch (error) {
    errorMessage = getErrorMessage(error);
  }

  if (errorMessage) {
    return NextResponse.redirect(buildLoginRedirectUrl(origin, next, errorMessage));
  }

  return NextResponse.redirect(`${origin}${next}`);
}
