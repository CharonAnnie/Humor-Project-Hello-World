"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type VoteResult =
  | { ok: true; value: -1 | 0 | 1 }
  | { ok: false; message: string };

// Casting the same value twice retracts the vote, which is what the arrow
// buttons imply. One row per (caption, user) is enforced by a unique constraint,
// so this can never become ballot stuffing.
export async function castVote(
  captionId: string,
  value: 1 | -1,
): Promise<VoteResult> {
  if (value !== 1 && value !== -1) {
    return { ok: false, message: "That isn't a vote." };
  }

  const supabase = await createClient();

  // Reachable by direct POST, so the signed-out check lives here as well as in
  // the UI. The votes table has no policy for `anon` either.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sign in to vote." };
  }

  const { data: existing } = await supabase
    .from("votes")
    .select("id, value")
    .eq("caption_id", captionId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && existing.value === value) {
    const { error } = await supabase.from("votes").delete().eq("id", existing.id);

    if (error) {
      return { ok: false, message: "Couldn't retract that vote." };
    }

    revalidatePath("/");
    revalidatePath("/leaderboard");
    return { ok: true, value: 0 };
  }

  // `vote_date` is deliberately absent: on insert it defaults to today in New
  // York, and on conflict PostgREST only updates the columns sent, so changing
  // your mind amends the day the vote was first cast instead of moving it.
  const { error } = await supabase
    .from("votes")
    .upsert(
      { caption_id: captionId, user_id: user.id, value },
      { onConflict: "caption_id,user_id" },
    );

  if (error) {
    return { ok: false, message: "Couldn't record that vote." };
  }

  revalidatePath("/");
  revalidatePath("/leaderboard");
  return { ok: true, value };
}
