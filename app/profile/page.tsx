import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import ProfileForm from "./ProfileForm";

// Server-side guard plus the initial read, so the form renders already filled
// in rather than empty-then-populated.
export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url")
    .eq("id", user.id)
    .single();

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 sm:py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Profile</h1>
        <p className="mt-2 text-sm text-muted">
          Update your name and photo. Changes save straight to Supabase.
        </p>
      </header>

      <ProfileForm
        userId={user.id}
        email={user.email ?? null}
        initialFirstName={profile?.first_name ?? ""}
        initialLastName={profile?.last_name ?? ""}
        initialAvatarUrl={profile?.avatar_url ?? null}
      />
    </main>
  );
}
