import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Avatar from "@/app/components/Avatar";

// The gated route: signed-out visitors are bounced by `proxy.ts`, and checked
// again here so the page never renders without a verified session.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("first_name, last_name, avatar_url, created_at")
    .eq("id", user.id)
    .single();

  if (!profile?.first_name || !profile?.last_name) redirect("/onboarding");

  const memberSince = new Date(profile.created_at).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <div className="card p-8">
        <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
          <Avatar
            url={profile.avatar_url}
            firstName={profile.first_name}
            lastName={profile.last_name}
            email={user.email}
            size={72}
          />
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Signed in
            </span>
            <h1 className="mt-3 truncate text-3xl font-semibold tracking-tight">
              Hi, {profile.first_name}
            </h1>
            <p className="mt-1 truncate text-sm text-muted">{user.email}</p>
          </div>
        </div>

        <dl className="mt-8 grid grid-cols-1 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
          <div className="bg-surface p-4">
            <dt className="text-xs uppercase tracking-wider text-muted">
              Name
            </dt>
            <dd className="mt-1 text-sm">
              {profile.first_name} {profile.last_name}
            </dd>
          </div>
          <div className="bg-surface p-4">
            <dt className="text-xs uppercase tracking-wider text-muted">
              Member since
            </dt>
            <dd className="mt-1 text-sm">{memberSince}</dd>
          </div>
        </dl>

        <p className="mt-6 text-sm leading-relaxed text-muted">
          This page is only visible to signed-in users. Sign out and open it
          again and you&apos;ll be sent back to the login screen.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link href="/profile" className="btn btn-primary">
            Edit profile
          </Link>
          <Link href="/" className="btn btn-secondary">
            Browse memes
          </Link>
        </div>
      </div>
    </main>
  );
}
