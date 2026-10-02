"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// The sign-in card. Rendered both at `/login` and as the whole landing page for
// signed-out visitors, so there is exactly one copy of the OAuth call.
export default function SignInPrompt({
  title = "Welcome back",
  subtitle = "Sign in to edit your profile and see the members-only page.",
  notice = null,
}: {
  title?: string;
  subtitle?: string;
  // A failure carried in the URL by `/auth/callback` or the provider. Shown
  // until the next attempt replaces it with that attempt's own error.
  notice?: string | null;
}) {
  const [error, setError] = useState<string | null>(notice);
  const [busy, setBusy] = useState(false);

  const signInWithGoogle = async () => {
    setBusy(true);
    const supabase = createClient();

    // Must be exactly /auth/callback with no extra query parameters, and the
    // same origin has to be listed under Supabase's Redirect URLs — including
    // the commit-specific Vercel URL.
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">{subtitle}</p>

        <button
          onClick={signInWithGoogle}
          disabled={busy}
          className="btn btn-primary btn-lg mt-8 w-full"
        >
          <GoogleMark />
          {busy ? "Redirecting…" : "Continue with Google"}
        </button>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        )}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        We only use your Google account to sign you in.
      </p>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden>
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.71-1.58 2.68-3.9 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.34A8.99 8.99 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.94H.96a8.99 8.99 0 0 0 0 8.12l3.01-2.34Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59A8.99 8.99 0 0 0 .96 4.94l3.01 2.34C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}
