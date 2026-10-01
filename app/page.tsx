import Image from "next/image";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
  );
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Render on every request instead of prerendering at build time, so new rows in
// Supabase show up without a redeploy. Also forces supabase-js's fetch to
// `no-store`, which would otherwise cache the query response.
export const dynamic = "force-dynamic";

type CaptionWithImage = {
  id: string;
  text: string;
  created_at: string;
  // captions.image_id is a NOT NULL foreign key, so PostgREST embeds a single
  // image object here rather than an array.
  images: {
    id: string;
    storage_path: string;
    file_name: string | null;
    mime_type: string | null;
    width: number | null;
    height: number | null;
  } | null;
};

// storage_path is the key inside the public `images` bucket (e.g.
// "seed/foo.png"), so it resolves to a public Storage URL. The bucket's public
// path is allow-listed in `images.remotePatterns` in next.config.ts.
function imageSrc(storagePath: string) {
  return supabase.storage.from("images").getPublicUrl(storagePath).data
    .publicUrl;
}

export default async function Home() {
  const { data: captions, error } = await supabase
    .from("captions")
    .select(
      "id, text, created_at, images ( id, storage_path, file_name, mime_type, width, height )",
    )
    .order("created_at", { ascending: false })
    .returns<CaptionWithImage[]>();

  if (error) {
    return (
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-16">
        <p className="card border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load captions: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12 sm:py-16">
      <header className="max-w-xl">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Meme List
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted">
          A small gallery of memes and their captions, served from Supabase
          Storage.
        </p>
      </header>

      {captions.length === 0 ? (
        <p className="mt-12 rounded-2xl border border-dashed border-line p-12 text-center text-sm text-muted">
          No captions yet.
        </p>
      ) : (
        <>
          <p className="mt-10 text-xs font-medium uppercase tracking-wider text-muted">
            {captions.length} {captions.length === 1 ? "meme" : "memes"}
          </p>

          <ul className="mt-4 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {captions.map((caption) => {
              const image = caption.images;
              return (
                <li
                  key={caption.id}
                  className="card group flex flex-col overflow-hidden transition-shadow hover:shadow-md"
                >
                  {image && image.width && image.height && (
                    // Fixed-ratio box so the three cards in a row line up. Memes
                    // vary from 465×372 to 1237×1454, so `contain` keeps the whole
                    // image visible rather than cropping the joke out of frame.
                    <div className="relative aspect-square w-full overflow-hidden border-b border-line bg-foreground/[0.03]">
                      <Image
                        src={imageSrc(image.storage_path)}
                        alt={caption.text}
                        width={image.width}
                        height={image.height}
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                    </div>
                  )}

                  <div className="flex flex-1 flex-col justify-between gap-3 p-5">
                    <p className="text-[15px] leading-relaxed">
                      {caption.text}
                    </p>
                    <time
                      dateTime={caption.created_at}
                      className="text-xs text-muted"
                    >
                      {new Date(caption.created_at).toLocaleDateString(
                        "en-US",
                        { month: "short", day: "numeric", year: "numeric" },
                      )}
                    </time>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </main>
  );
}
