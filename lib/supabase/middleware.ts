import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseAnonKey, getSupabaseAuthUrl } from "@/lib/supabase/auth-config";
import { getErrorMessage, withTimeout } from "@/lib/utils/promise";

const SESSION_REFRESH_TIMEOUT_MS = 5_000;

export async function updateSupabaseSession(request: NextRequest) {
  let response = NextResponse.next({
    request,
  });

  const url = getSupabaseAuthUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    return {
      user: null,
      response,
    };
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        response = NextResponse.next({
          request,
        });

        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  try {
    const {
      data: { user },
      error,
    } = await withTimeout(
      supabase.auth.getUser(),
      SESSION_REFRESH_TIMEOUT_MS,
      "Supabase 会话刷新"
    );

    if (error) {
      console.warn("[updateSupabaseSession] Supabase auth skipped:", error.message);
      return {
        user: null,
        response,
      };
    }

    return {
      user,
      response,
    };
  } catch (error) {
    console.warn(
      "[updateSupabaseSession] Supabase auth skipped:",
      getErrorMessage(error)
    );

    return {
      user: null,
      response,
    };
  }
}
