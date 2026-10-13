import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstParam } from "@/lib/auth-notice";
import { nycToday } from "@/lib/nyc";
import Avatar from "@/app/components/Avatar";
import VoteButtons from "@/app/components/VoteButtons";

// Scores move all day, so never serve this from the build.
export const dynamic = "force-dynamic";

// The two boards are the same shape on purpose: `all_time_leaderboard` mirrors
// `daily_leaderboard`'s columns, so the toggle swaps the view name and nothing
// else. `rank` is computed inside each view.
const RANGES = {
  today: { view: "daily_leaderboard", label: "Today" },
  "all-time": { view: "all_time_leaderboard", label: "All time" },
} as const;

type Range = keyof typeof RANGES;

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

export default async function LeaderboardPage({
  searchParams,
}: PageProps<"/leaderboard">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The board is caption text and photos, so it is members-only like the
  // gallery. `proxy.ts` bounces guests early; re-checked here, before the query,
  // so no content is read on a signed-out request.
  if (!user) redirect("/login");

  const params = await searchParams;
  // Anything unrecognised falls back to today's board rather than erroring.
  const requested = firstParam(params.range);
  const range: Range = requested === "all-time" ? "all-time" : "today";

  // Both views already rank by net score and run with security_invoker, so each
  // returns exactly what RLS allows this reader. The daily one also filters to
  // today in Eastern time.
  const { data: rows, error } = await supabase
    .from(RANGES[range].view)
    .select(
      "caption_id, rank, score, upvotes, downvotes, caption_text, voice_label, storage_path, image_width, image_height, author_first_name, author_last_name, author_avatar_url",
    )
    .order("rank", { ascending: true })
    // Both boards list every caption, so this is a ceiling on the page rather
    // than a top-N cut.
    .limit(100)
    .returns<LeaderboardRow[]>();

  const myVotes = new Map<string, -1 | 1>();

  if (rows && rows.length > 0) {
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
          {range === "today" ? "Today's leaderboard" : "All-time leaderboard"}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          {range === "today"
            ? `${today}. Every caption, ranked by the votes it picks up today. The board resets every midnight Eastern, so yesterday's winner has to earn it again.`
            : "Every caption, ranked by every vote it has ever had. Nothing resets, so the ones that landed stay on top."}
        </p>
      </header>

      {/* Plain links, so the board is shareable at a URL and the toggle works
          before any JavaScript loads. */}
      <nav className="toggle-group mt-6" aria-label="Leaderboard range">
        {(Object.keys(RANGES) as Range[]).map((option) => (
          <Link
            key={option}
            href={option === "today" ? "/leaderboard" : `/leaderboard?range=${option}`}
            className="toggle-option"
            data-active={option === range || undefined}
            aria-current={option === range ? "page" : undefined}
          >
            {RANGES[option].label}
          </Link>
        ))}
      </nav>

      {error && (
        <p className="card mt-8 border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load the leaderboard: {error.message}
        </p>
      )}

      {!error && (!rows || rows.length === 0) ? (
        <div className="mt-10 rounded-2xl border border-dashed border-line p-12 text-center">
          <p className="text-sm text-muted">
            No captions yet. Drop a photo and the board starts itself.
          </p>
          <Link href="/create" className="btn btn-primary mt-6">
            Drop a photo
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
                canVote
              />
            </li>
          ))}
        </ol>
      )}
    </main>
  );
}
