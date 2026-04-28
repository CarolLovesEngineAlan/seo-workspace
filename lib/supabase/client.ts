"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getSupabaseAnonKey,
  getSupabaseAuthConfigError,
  getSupabaseAuthUrl,
} from "@/lib/supabase/auth-config";

let cachedClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (cachedClient) {
    return cachedClient;
  }

  const configError = getSupabaseAuthConfigError();

  if (configError) {
    throw new Error(configError);
  }

  const url = getSupabaseAuthUrl();
  const anonKey = getSupabaseAnonKey();

  cachedClient = createBrowserClient(url, anonKey);
  return cachedClient;
}
