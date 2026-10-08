import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import StreakBadge from "@/app/components/StreakBadge";

// Vote totals and streaks change constantly, so this is never prerendered.
export const dynamic = "force-dynamic";

type MyCaption = {
  id: string;
  text: string;
  score: number | null;
  upvotes: number;
  downvotes: number;
  created_at: string;
  images: { storage_path: string } | null;
  voices: { label: string } | null;
};

// The gated route: signed-out visitors are bounced by `proxy.ts`, and checked
// again here so the page never renders without a verified session.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: captions }, votesCast, captionCount] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("first_name, current_streak, longest_streak, last_vote_date")
        .eq("id", user.id)
        .single(),
      supabase
        .from("captions")
        .select(
          "id, text, score, upvotes, downvotes, created_at, images ( storage_path ), voices ( label )",
        )
        .eq("user_id", user.id)
        .order("score", { ascending: false })
        .limit(10)
        .returns<MyCaption[]>(),
      // head:true asks PostgREST for the count without the rows.
      supabase
        .from("votes")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
      supabase
        .from("captions")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id),
    ]);

  const totalScore = (captions ?? []).reduce(
    (sum, caption) => sum + (caption.score ?? 0),
    0,
  );

  const imageSrc = (storagePath: string) =>
    supabase.storage.from("images").getPublicUrl(storagePath).data.publicUrl;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12 sm:py-16">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            {profile?.first_name ? `Hey, ${profile.first_name}` : "Your drops"}
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            Your captions, your votes, and the streak you&apos;re protecting.
          </p>
        </div>

        <StreakBadge
          currentStreak={profile?.current_streak ?? 0}
          lastVoteDate={profile?.last_vote_date ?? null}
        />
      </header>

      <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Captions" value={captionCount.count ?? 0} />
        <Stat label="Votes cast" value={votesCast.count ?? 0} />
        <Stat label="Top 10 score" value={totalScore} />
        <Stat label="Best streak" value={profile?.longest_streak ?? 0} />
      </dl>

      <section className="mt-10">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted">
          Your best captions
        </h2>

        {!captions || captions.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-line p-12 text-center">
            <p className="text-sm text-muted">
              You haven&apos;t dropped a photo yet.
            </p>
            <Link href="/create" className="btn btn-primary mt-6">
              Drop a photo
            </Link>
          </div>
        ) : (
          <ul className="mt-4 flex flex-col gap-3">
            {captions.map((caption) => (
              <li key={caption.id} className="card flex items-center gap-4 p-4">
                {caption.images && (
                  <div className="relative h-14 w-14 flex-shrink-0 overflow-hidden rounded-lg border border-line bg-foreground/[0.03]">
                    <Image
                      src={imageSrc(caption.images.storage_path)}
                      alt={caption.text}
                      width={56}
                      height={56}
                      sizes="56px"
                      className="h-full w-full object-cover"
                    />
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  {caption.voices?.label && (
                    <span className="voice-chip">{caption.voices.label}</span>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed">{caption.text}</p>
                </div>

                <span className="text-right text-sm font-semibold tabular-nums">
                  {(caption.score ?? 0) > 0 ? "+" : ""}
                  {caption.score ?? 0}
                  <span className="block text-xs font-normal text-muted">
                    {caption.upvotes}/{caption.downvotes}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-10 flex flex-wrap items-center gap-3">
        <Link href="/" className="btn btn-secondary">
          Browse the gallery
        </Link>
        <Link href="/leaderboard" className="btn btn-secondary">
          Leaderboard
        </Link>
        <Link href="/profile" className="btn btn-secondary">
          Edit profile
        </Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-4">
      <dt className="text-xs text-muted">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}
