"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type DeleteCaptionResult = { ok: true } | { ok: false; message: string };

// Lets the author bin a caption that didn't land, either straight after
// generating it or later from the gallery or their dashboard.
//
// This is a hard delete, and it stays allowed once the caption has votes: the
// votes and daily tallies cascade away with it, which also drops it off today's
// leaderboard. The `generations` row survives, so the model, the prompt and the
// raw response for that call are still on record — the audit trail outlives the
// caption it produced.
//
// Deleting the last caption on a photo retires the photo from the gallery too:
// that query inner-joins captions, so an image with none left stops being
// returned and its card goes away. The `images` row and the Storage object stay
// put, because `generations.image_id` cascades from `images` — removing the row
// would take the audit trail with it.
export async function deleteCaption(
  captionId: string,
): Promise<DeleteCaptionResult> {
  const supabase = await createClient();

  // Server Actions accept direct POSTs, so ownership is checked here as well as
  // in the RLS policy.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sign in to delete captions." };
  }

  // The `user_id` filter is redundant with RLS and kept deliberately: it makes
  // the intent legible at the call site, and together with the `.select()` below
  // it tells a real delete from a no-op — so another user's caption reports a
  // failure instead of a silent success. The message stays vague either way,
  // rather than confirming whether that id exists.
  const { data, error } = await supabase
    .from("captions")
    .delete()
    .eq("id", captionId)
    .eq("user_id", user.id)
    .select("id");

  if (error) {
    return { ok: false, message: "Couldn't delete that caption." };
  }

  if (!data || data.length === 0) {
    return { ok: false, message: "That caption is already gone." };
  }

  revalidatePath("/");
  revalidatePath("/dashboard");
  revalidatePath("/leaderboard");

  return { ok: true };
}
