import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Shown right after a first sign-in, because the trigger creates the profile
// row with both names null.
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name")
    .eq("id", user.id)
    .single();

  // Nothing to collect, so don't make returning users fill the form again.
  if (profile?.first_name && profile?.last_name) redirect("/dashboard");

  async function saveNames(formData: FormData) {
    "use server";

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) redirect("/login");

    const firstName = String(formData.get("first_name") ?? "").trim();
    const lastName = String(formData.get("last_name") ?? "").trim();

    if (!firstName || !lastName) redirect("/onboarding?error=required");

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    if (error) redirect("/onboarding?error=save_failed");

    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
      <div className="card p-8">
        <span className="text-xs font-medium uppercase tracking-wider text-muted">
          Step 1 of 1
        </span>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">
          What should we call you?
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Signed in as {user.email}. Just your name, and you&apos;re in.
        </p>

        <form action={saveNames} className="mt-8 flex flex-col gap-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="first_name">
                First name
              </label>
              <input
                id="first_name"
                name="first_name"
                placeholder="Ada"
                required
                autoComplete="given-name"
                className="input"
              />
            </div>
            <div>
              <label className="label" htmlFor="last_name">
                Last name
              </label>
              <input
                id="last_name"
                name="last_name"
                placeholder="Lovelace"
                required
                autoComplete="family-name"
                className="input"
              />
            </div>
          </div>

          <button type="submit" className="btn btn-primary btn-lg w-full">
            Continue
          </button>
        </form>
      </div>
    </main>
  );
}
