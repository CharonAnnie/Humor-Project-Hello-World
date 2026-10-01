import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// The gated route: signed-out visitors are bounced by `proxy.ts`, and checked
// again here so the page never renders without a verified session. A placeholder
// for now — the only thing it demonstrates is that the gate works.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-6 py-12 sm:py-16">
      <div className="card p-8 text-center">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs font-medium text-muted">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          Signed in
        </span>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">
          Members only
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-relaxed text-muted">
          This page is only visible to signed-in members. Sign out and open it
          again and you&apos;ll be sent back to the login screen.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/" className="btn btn-primary">
            Browse memes
          </Link>
          <Link href="/profile" className="btn btn-secondary">
            Edit profile
          </Link>
        </div>
      </div>
    </main>
  );
}
