import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Voice } from "@/lib/prompts";
import CaptionCreator from "./CaptionCreator";

// A generation measured at 5-20s against this project's key, and the request also
// covers a Storage download and three inserts. Set at page level, which is what
// governs the Server Actions called from this page.
export const maxDuration = 60;

export default async function CreatePage() {
  const supabase = await createClient();

  // `proxy.ts` bounces signed-out visitors early; checked again here so the page
  // never renders without a verified session.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: voices } = await supabase
    .from("voices")
    .select("id, label, instruction")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<Voice[]>();

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12 sm:py-16">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Drop a photo</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Anything you want captioned. Gemini writes one in each voice, then the
          gallery votes.
        </p>
      </header>

      <CaptionCreator userId={user.id} voices={voices ?? []} />
    </main>
  );
}
