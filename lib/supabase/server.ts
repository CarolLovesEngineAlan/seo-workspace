import { createServerClient as createSSRServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSupabaseAnonKey, getSupabaseAuthUrl } from "@/lib/supabase/auth-config";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();
  const url = getSupabaseAuthUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error(
      "缺少 NEXT_PUBLIC_SUPABASE_URL（或 SUPABASE_URL）与 NEXT_PUBLIC_SUPABASE_ANON_KEY，无法初始化服务端 Supabase Auth。"
    );
  }

  return createSSRServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components may not be allowed to write cookies directly.
        }
      },
    },
  });
}
