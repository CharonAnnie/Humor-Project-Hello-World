import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import Avatar from "./Avatar";
import SignOutButton from "./SignOutButton";

// One header for every route, so the app reads as a single product instead of
// five separate pages. Rendered on the server, which avoids a signed-out flash.
export default async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <header className="sticky top-0 z-10 border-b border-line bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between gap-4 px-6">
        <Link
          href="/"
          className="text-[15px] font-semibold tracking-tight hover:opacity-70"
        >
          Meme List
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="hidden rounded-lg px-3 py-2 text-sm text-muted transition-colors hover:text-foreground sm:block"
              >
                Members
              </Link>
              <Link
                href="/profile"
                className="flex items-center gap-2 rounded-full p-1 pr-3 text-sm transition-colors hover:bg-foreground/5"
              >
                <Avatar
                  url={profile?.avatar_url ?? null}
                  firstName={profile?.first_name}
                  lastName={profile?.last_name}
                  email={user.email}
                  size={28}
                />
                <span className="hidden sm:inline">
                  {profile?.first_name ?? "Profile"}
                </span>
              </Link>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login" className="btn btn-primary">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
