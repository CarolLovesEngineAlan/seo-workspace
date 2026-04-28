"use client";

import { LoaderCircle } from "lucide-react";
import { useState } from "react";
import { normalizeNextPath } from "@/lib/auth/next-path";
import { getAuthRedirectUrl } from "@/lib/supabase/auth-config";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

function formatGoogleAuthError(message: string): string {
  if (/unsupported provider|provider is not enabled/i.test(message)) {
    return "Google sign-in is temporarily unavailable.";
  }

  if (/invalid api key/i.test(message)) {
    return "Google sign-in is temporarily unavailable.";
  }

  if (/timeout|timed out|network request failed|fetch failed/i.test(message)) {
    return "Supabase auth request timed out. Check NEXT_PUBLIC_SUPABASE_URL, confirm the Supabase project is reachable, then try again.";
  }

  return "Unable to continue right now. Please try again.";
}

export function GoogleSignInButton({
  next = "/workbench",
  className,
}: {
  next?: string;
  className?: string;
}) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setIsPending(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const destination = normalizeNextPath(next);
      const redirectTo =
        getAuthRedirectUrl(destination, window.location.origin) ||
        `${window.location.origin}/auth/callback?next=${encodeURIComponent(destination)}`;
      const { error: signInError } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
          queryParams: {
            access_type: "offline",
            prompt: "select_account",
          },
        },
      });

      if (signInError) {
        throw signInError;
      }
    } catch (authError) {
      const message =
        authError instanceof Error ? authError.message : String(authError);
      setError(formatGoogleAuthError(message));
      setIsPending(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={className}
      >
        {isPending ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <span className="text-[15px]">G</span>
        )}
        <span>{isPending ? "Opening Google..." : "Continue with Google"}</span>
      </button>
      {error ? <p className="text-[12px] text-[#b2483f]">{error}</p> : null}
    </div>
  );
}
