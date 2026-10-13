import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { firstParam, signInNotice } from "@/lib/auth-notice";
import DropCard, { type DropCardData } from "./components/DropCard";
import Landing from "./components/Landing";

// Render on every request instead of prerendering at build time, so new captions
// and vote totals show up without a redeploy. Also forces supabase-js's fetch to
// `no-store`, which would otherwise cache the query response.
export const dynamic = "force-dynamic";

// The gallery is a list of photos, each carrying its own captions, so the query
// starts at `images` and embeds the captions rather than the other way round.
type ImageRow = {
  id: string;
  storage_path: string;
  width: number | null;
  height: number | null;
  created_at: string;
  captions: {
    id: string;
    text: string;
    prompt: string | null;
    created_at: string;
    score: number | null;
    // Nullable: the author's profile can be gone (ON DELETE SET NULL), which
    // also means nobody owns the caption any more. The Week 3 seed captions
    // have no author either.
    user_id: string | null;
    // captions.voice and captions.user_id are single foreign keys, so PostgREST
    // embeds one object each rather than an array.
    voices: { label: string; sort_order: number } | null;
    profiles: {
      first_name: string | null;
      last_name: string | null;
      avatar_url: string | null;
    } | null;
  }[];
};

// How many photos a card's captions are listed in: the order the voices are
// configured in, which is the order they were generated in. Captions predating
// the voices table sort last, by age.
function byVoiceOrder(
  a: ImageRow["captions"][number],
  b: ImageRow["captions"][number],
) {
  const left = a.voices?.sort_order ?? Number.MAX_SAFE_INTEGER;
  const right = b.voices?.sort_order ?? Number.MAX_SAFE_INTEGER;
  if (left !== right) return left - right;
  return a.created_at.localeCompare(b.created_at);
}

export default async function Home({ searchParams }: PageProps<"/">) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const params = await searchParams;
  const notice = signInNotice(params.error, params.error_description);

  // Signed out: this route is the landing page, and it stops here. No caption
  // query runs on this path, so none of the content reaches the browser —
  // the gating is in what we fetch, not in what we hide with CSS.
  if (!user) {
    // Supabase only redirects to `redirectTo` when that exact URL is in the
    // project's Redirect URLs allow-list; otherwise it falls back to the Site
    // URL, which lands the OAuth code here instead of on /auth/callback. Hand it
    // to the callback rather than showing the landing page to someone who is
    // holding a valid code.
    const code = firstParam(params.code);
    if (code) redirect(`/auth/callback?code=${encodeURIComponent(code)}`);

    // Voices are app configuration rather than anyone's content, so they stay
    // readable while signed out and keep the landing copy accurate.
    const { data: voices } = await supabase
      .from("voices")
      .select("label")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .returns<{ label: string }[]>();

    return (
      <Landing
        voiceLabels={(voices ?? []).map((voice) => voice.label)}
        notice={notice}
      />
    );
  }

  // Signed in from here down: the gallery proper.
  //
  // `captions!inner` is what keeps a photo out of the gallery once its last
  // caption is deleted: an inner join drops any image with no captions left, so
  // the card disappears with them.
  const { data: images, error } = await supabase
    .from("images")
    .select(
      "id, storage_path, width, height, created_at, captions!inner ( id, text, prompt, created_at, score, user_id, voices ( label, sort_order ), profiles ( first_name, last_name, avatar_url ) )",
    )
    .order("created_at", { ascending: false })
    .limit(24)
    .returns<ImageRow[]>();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="card border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load the gallery: {error.message}
        </p>
      </main>
    );
  }

  const captionIds = (images ?? []).flatMap((image) =>
    image.captions.map((caption) => caption.id),
  );

  // One extra query rather than one per caption: which of these the viewer has
  // already voted on. RLS means this only ever returns their own rows.
  const myVotes = new Map<string, -1 | 1>();

  if (captionIds.length > 0) {
    const { data: votes } = await supabase
      .from("votes")
      .select("caption_id, value")
      .in("caption_id", captionIds)
      .returns<{ caption_id: string; value: number }[]>();

    for (const vote of votes ?? []) {
      myVotes.set(vote.caption_id, vote.value === 1 ? 1 : -1);
    }
  }

  // storage_path is the key inside the public `images` bucket, so it resolves to
  // a public Storage URL. That path is allow-listed in next.config.ts.
  const imageSrc = (storagePath: string) =>
    supabase.storage.from("images").getPublicUrl(storagePath).data.publicUrl;

  const drops: DropCardData[] = (images ?? []).map((image) => {
    const captions = [...image.captions].sort(byVoiceOrder);
    // Every caption under a photo comes from the one upload that generated
    // them, so the card's byline is whoever wrote the first of them.
    const author = captions[0]?.profiles ?? null;

    return {
      imageId: image.id,
      imageUrl: imageSrc(image.storage_path),
      imageWidth: image.width,
      imageHeight: image.height,
      authorFirstName: author?.first_name ?? null,
      authorLastName: author?.last_name ?? null,
      authorAvatarUrl: author?.avatar_url ?? null,
      captions: captions.map((caption) => ({
        id: caption.id,
        text: caption.text,
        prompt: caption.prompt,
        voiceLabel: caption.voices?.label ?? null,
        score: caption.score ?? 0,
        myVote: myVotes.get(caption.id) ?? 0,
        isMine: caption.user_id === user.id,
      })),
    };
  });

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

      {drops.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
          No captions yet. Be the first to drop a photo.
        </p>
      ) : (
        <>
          <p className="mt-10 text-xs font-medium uppercase tracking-wider text-muted">
            {drops.length} {drops.length === 1 ? "photo" : "photos"} ·{" "}
            {captionIds.length}{" "}
            {captionIds.length === 1 ? "caption" : "captions"}
          </p>

          {/* Two across at most: a card is a photo plus every caption under it,
              so three columns left no room to read them. */}
          <ul className="mt-4 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
            {drops.map((drop) => (
              <DropCard key={drop.imageId} drop={drop} />
            ))}
          </ul>
        </>
      )}
    </main>
  );
}
