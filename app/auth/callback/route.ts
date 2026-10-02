import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Google sends the user back here with a one-time `code`. Exchanging it sets
// the session cookies, after which the `on_auth_user_created` trigger has
// already inserted this user's (empty) row in public.profiles.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");

  // Google/Supabase report a declined or failed consent as `?error=` instead of
  // sending a code, so pass that through rather than blaming a missing code.
  const providerError = searchParams.get("error");

  if (providerError) {
    const query = new URLSearchParams({ error: providerError });
    const description = searchParams.get("error_description");
    if (description) query.set("error_description", description);
    return NextResponse.redirect(`${origin}/login?${query}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  // First-time users have no names yet, so send them to fill those in before
  // they reach the gallery.
  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  const needsNames = !profile?.first_name || !profile?.last_name;

  return NextResponse.redirect(`${origin}${needsNames ? "/onboarding" : "/"}`);
}
