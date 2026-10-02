import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstParam, signInNotice } from "@/lib/auth-notice";
import SignInPrompt from "@/app/components/SignInPrompt";

// Signed-in visitors have nothing to do here, so send them to the memes.
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  const params = await searchParams;

  // An OAuth code can be delivered here too, for the same Site URL reason as on
  // the landing page.
  const code = firstParam(params.code);
  if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

  return (
    <SignInPrompt
      notice={signInNotice(params.error, params.error_description)}
    />
  );
}
