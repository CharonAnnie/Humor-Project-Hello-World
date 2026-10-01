"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();

  return (
    <button
      onClick={async () => {
        await createClient().auth.signOut();
        // refresh() drops the cached Server Component output for the signed-in
        // user, so the gated page can't flash after the redirect.
        router.push("/login");
        router.refresh();
      }}
      className="btn btn-secondary"
    >
      Sign out
    </button>
  );
}
