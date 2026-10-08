import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstParam, signInNotice } from "@/lib/auth-notice";
import CaptionCard, { type CaptionCardData } from "./components/CaptionCard";

// Render on every request instead of prerendering at build time, so new captions
// and vote totals show up without a redeploy. Also forces supabase-js's fetch to
// `no-store`, which would otherwise cache the query response.
export const dynamic = "force-dynamic";

type CaptionRow = {
  id: string;
  text: string;
  prompt: string | null;
  created_at: string;
  score: number | null;
  // captions.image_id is a NOT NULL foreign key, so PostgREST embeds a single
  // object here rather than an array. Same for the voice and author lookups.
  images: {
    storage_path: string;
    width: number | null;
    height: number | null;
  } | null;
  voices: { label: string } | null;
  profiles: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  } | null;
};

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;

  if (!user) {
    // Supabase only redirects to `redirectTo` when that exact URL is in the
    // project's Redirect URLs allow-list; otherwise it falls back to the Site
    // URL, which lands the OAuth code here instead of on /auth/callback. Hand it
    // to the callback rather than rendering the gallery to someone who is
    // holding a valid code.
    const code = firstParam(params.code);
    if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);
  }

  // The gallery is public: signed-out visitors browse and read, they just can't
  // vote or generate. Enforced in RLS, not only here.
  const { data: captions, error } = await supabase
    .from("captions")
    .select(
      "id, text, prompt, created_at, score, images ( storage_path, width, height ), voices ( label ), profiles ( first_name, last_name, avatar_url )",
    )
    .order("created_at", { ascending: false })
    .limit(60)
    .returns<CaptionRow[]>();

  // One extra query rather than one per card: which of these the viewer has
  // already voted on. RLS means this only ever returns their own rows.
  const myVotes = new Map<string, -1 | 1>();

  if (user && captions && captions.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("caption_id, value")
      .in(
        "caption_id",
        captions.map((caption) => caption.id),
      )
      .returns<{ caption_id: string; value: number }[]>();

    for (const vote of votes ?? []) {
      myVotes.set(vote.caption_id, vote.value === 1 ? 1 : -1);
    }
  }

  const notice = signInNotice(params.error, params.error_description);

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="card border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load captions: {error.message}
        </p>
      </main>
    );
  }

  // storage_path is the key inside the public `images` bucket, so it resolves to
  // a public Storage URL. That path is allow-listed in next.config.ts.
  const imageSrc = (storagePath: string) =>
    supabase.storage.from("images").getPublicUrl(storagePath).data.publicUrl;

  const cards: CaptionCardData[] = (captions ?? []).map((caption) => ({
    id: caption.id,
    text: caption.text,
    voiceLabel: caption.voices?.label ?? null,
    prompt: caption.prompt,
    createdAt: caption.created_at,
    score: caption.score ?? 0,
    myVote: myVotes.get(caption.id) ?? 0,
    imageUrl: caption.images ? imageSrc(caption.images.storage_path) : null,
    imageWidth: caption.images?.width ?? null,
    imageHeight: caption.images?.height ?? null,
    authorFirstName: caption.profiles?.first_name ?? null,
    authorLastName: caption.profiles?.last_name ?? null,
    authorAvatarUrl: caption.profiles?.avatar_url ?? null,
  }));

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
      <header className="max-w-2xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Caption Drop
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          Upload any photo. Gemini captions it in three voices. The rest of us
          decide which one actually lands.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Link href="/create" className="btn btn-primary">
            Drop a photo
          </Link>
          <Link href="/leaderboard" className="btn btn-secondary">
            Today&apos;s leaderboard
          </Link>
        </div>
      </header>

      {notice && (
        <p className="card mt-8 border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          {notice}
        </p>
      )}

      {!user && cards.length > 0 && (
        <p className="card mt-8 flex flex-wrap items-center justify-between gap-3 p-4 text-sm text-muted">
          <span>You&apos;re browsing as a guest. Sign in to vote and generate captions.</span>
          <Link href="/login" className="btn btn-secondary">
            Sign in
          </Link>
        </p>
      )}

      {cards.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
          No captions yet. {user ? "Be the first to drop a photo." : "Sign in to drop the first photo."}
        </p>
      ) : (
        <>
          <p className="mt-10 text-xs font-medium uppercase tracking-wider text-muted">
            {cards.length} {cards.length === 1 ? "caption" : "captions"}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {cards.map((caption) => (
              <CaptionCard
                key={caption.id}
                caption={caption}
                canVote={Boolean(user)}
              />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
