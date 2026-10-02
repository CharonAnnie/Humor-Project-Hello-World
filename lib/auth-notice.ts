// Human-readable text for the `?error=` codes that `/auth/callback` and the
// OAuth provider can send back, so a failed sign-in says something instead of
// silently re-rendering the sign-in card.
const MESSAGES: Record<string, string> = {
  missing_code: "That sign-in link had no code in it. Please try again.",
  exchange_failed:
    "We couldn't finish signing you in. Please try signing in again.",
  no_user: "Google didn't return an account. Please try again.",
  access_denied: "Sign-in was cancelled.",
};

// Search params arrive as string | string[] | undefined.
export function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function signInNotice(
  error: string | string[] | undefined,
  description?: string | string[] | undefined,
) {
  const code = firstParam(error);
  if (!code) return null;

  return (
    MESSAGES[code] ??
    firstParam(description) ??
    "Sign-in failed. Please try again."
  );
}
