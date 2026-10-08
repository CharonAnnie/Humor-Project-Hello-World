import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { nycToday } from "@/lib/nyc";
import Avatar from "@/app/components/Avatar";
import VoteButtons from "@/app/components/VoteButtons";

// Scores move all day, so never serve this from the build.
export const dynamic = "force-dynamic";

type LeaderboardRow = {
  caption_id: string;
  rank: number;
  score: number;
  upvotes: number;
  downvotes: number;
  caption_text: string;
  voice_label: string | null;
  storage_path: string | null;
  image_width: number | null;
  image_height: number | null;
  author_first_name: string | null;
  author_last_name: string | null;
  author_avatar_url: string | null;
};

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The view already filters to today in Eastern time and ranks by net score. It runs
  // with security_invoker, so a signed-out visitor sees exactly what RLS allows.
  const { data: rows, error } = await supabase
    .from("daily_leaderboard")
    .select(
      "caption_id, rank, score, upvotes, downvotes, caption_text, voice_label, storage_path, image_width, image_height, author_first_name, author_last_name, author_avatar_url",
    )
    .order("rank", { ascending: true })
    .limit(25)
    .returns<LeaderboardRow[]>();

  const myVotes = new Map<string, -1 | 1>();

  if (user && rows && rows.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("caption_id, value")
      .in(
        "caption_id",
        rows.map((row) => row.caption_id),
      )
      .returns<{ caption_id: string; value: number }[]>();

    for (const vote of votes ?? []) {
      myVotes.set(vote.caption_id, vote.value === 1 ? 1 : -1);
    }
  }

  const imageSrc = (storagePath: string) =>
    supabase.storage.from("images").getPublicUrl(storagePath).data.publicUrl;

  const today = new Date(`${nycToday()}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <header className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight">
          Today&apos;s leaderboard
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {today}. Ranked by votes cast today and reset every midnight Eastern,
          so yesterday&apos;s winner has to earn it again.
        </p>
      </header>

      {error && (
        <p className="card mt-8 border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load the leaderboard: {error.message}
        </p>
      )}

      {!error && (!rows || rows.length === 0) ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-sm text-muted">
            No votes yet today. The first vote starts the board.
          </p>
          <Link href="/" className="btn btn-primary mt-6">
            Go vote
          </Link>
        </div>
      ) : (
        <ol className="mt-10 flex flex-col gap-3">
          {(rows ?? []).map((row) => (
            <li
              key={row.caption_id}
              className="card flex items-center gap-4 p-4"
            >
              <span className="rank-pill" data-top={row.rank === 1 ? "true" : undefined}>
                {row.rank}
              </span>

              {row.storage_path && (
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-foreground/[0.03]">
                  <Image
                    src={imageSrc(row.storage_path)}
                    alt={row.caption_text}
                    width={row.image_width ?? 64}
                    height={row.image_height ?? 64}
                    sizes="64px"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="min-w-0 flex-1">
                {row.voice_label && (
                  <span className="voice-chip">{row.voice_label}</span>
                )}
                <p className="mt-1.5 text-sm leading-relaxed">
                  {row.caption_text}
                </p>
                <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
                  {row.author_first_name || row.author_last_name ? (
                    <>
                      <Avatar
                        url={row.author_avatar_url}
                        firstName={row.author_first_name}
                        lastName={row.author_last_name}
                        size={16}
                      />
                      {row.author_first_name ?? "Someone"}
                    </>
                  ) : (
                    "House caption"
                  )}
                  <span aria-hidden>·</span>
                  {row.upvotes} up, {row.downvotes} down
                </span>
              </div>

              <VoteButtons
                captionId={row.caption_id}
                score={row.score}
                myVote={myVotes.get(row.caption_id) ?? 0}
                canVote={Boolean(user)}
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
