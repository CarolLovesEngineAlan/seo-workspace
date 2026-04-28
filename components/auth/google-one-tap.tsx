"use client";

import Script from "next/script";
import { useEffect, useRef, useState } from "react";
import { normalizeNextPath } from "@/lib/auth/next-path";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

type NoncePair = {
  raw: string;
  hashed: string;
};

type GoogleCredentialResponse = {
  credential?: string;
};

type GoogleIdInitializeConfig = {
  client_id: string;
  callback: (response: GoogleCredentialResponse) => void | Promise<void>;
  auto_select?: boolean;
  cancel_on_tap_outside?: boolean;
  context?: "signin" | "signup" | "use";
  itp_support?: boolean;
  nonce?: string;
  use_fedcm_for_prompt?: boolean;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: GoogleIdInitializeConfig) => void;
          prompt: () => void;
          cancel?: () => void;
        };
      };
    };
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let value = "";

  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });

  return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function encodeBase64(bytes: Uint8Array): string {
  let value = "";

  bytes.forEach((byte) => {
    value += String.fromCharCode(byte);
  });

  return btoa(value);
}

function encodeHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function createNoncePair(): Promise<NoncePair | null> {
  if (
    typeof window === "undefined" ||
    !window.crypto?.getRandomValues ||
    !window.crypto?.subtle
  ) {
    return null;
  }

  const random = new Uint8Array(24);
  window.crypto.getRandomValues(random);
  const raw = encodeBase64(random);
  const digest = await window.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(raw)
  );

  return {
    raw,
    hashed: encodeHex(new Uint8Array(digest)),
  };
}

function formatOneTapError(message: string): string {
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

export function GoogleOneTap({
  next = "/workbench",
}: {
  next?: string;
}) {
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() || "";
  const destination = normalizeNextPath(next);
  const [scriptReady, setScriptReady] = useState(false);
  const [noncePair, setNoncePair] = useState<NoncePair | null>(null);
  const [status, setStatus] = useState<"idle" | "authorizing" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    if (!clientId) {
      return;
    }

    let active = true;

    createNoncePair()
      .then((pair) => {
        if (active) {
          setNoncePair(pair);
        }
      })
      .catch(() => {
        if (active) {
          setNoncePair(null);
        }
      });

    return () => {
      active = false;
    };
  }, [clientId]);

  useEffect(() => {
    if (!clientId || !scriptReady || initializedRef.current) {
      return;
    }

    const google = window.google?.accounts?.id;

    if (!google) {
      return;
    }

    initializedRef.current = true;

    google.initialize({
      client_id: clientId,
      auto_select: true,
      cancel_on_tap_outside: false,
      context: "signin",
      itp_support: true,
      nonce: noncePair?.hashed,
      use_fedcm_for_prompt: true,
      callback: async (response) => {
        if (!response.credential) {
          return;
        }

        setStatus("authorizing");
        setError(null);

        try {
          const supabase = getSupabaseBrowserClient();
          const { error: authError } = await supabase.auth.signInWithIdToken({
            provider: "google",
            token: response.credential,
            nonce: noncePair?.raw,
          });

          if (authError) {
            throw authError;
          }

          window.location.assign(destination);
        } catch (authError) {
          const message =
            authError instanceof Error ? authError.message : String(authError);
          setStatus("error");
          setError(formatOneTapError(message));
          initializedRef.current = false;
          setNoncePair(await createNoncePair());
        }
      },
    });

    google.prompt();

    return () => {
      window.google?.accounts?.id.cancel?.();
      initializedRef.current = false;
    };
  }, [clientId, destination, noncePair, scriptReady]);

  if (!clientId) {
    return null;
  }

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() => setScriptReady(true)}
      />

      {status === "authorizing" ? (
        <p className="mt-4 text-center text-[12px] text-[#5e6860]">
          Confirming your access...
        </p>
      ) : null}

      {error ? (
        <p className="mt-4 text-center text-[12px] text-[#b2483f]">{error}</p>
      ) : null}
    </>
  );
}
