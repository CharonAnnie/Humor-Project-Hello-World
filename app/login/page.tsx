import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SignInPrompt from "@/app/components/SignInPrompt";

// Signed-in visitors have nothing to do here, so send them to the memes.
export default async function LoginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) redirect("/");

  return <SignInPrompt />;
}
