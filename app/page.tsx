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
      <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
        <p className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-600 dark:text-red-400">
          Could not load captions: {error.message}
        </p>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Meme List</h1>

      {captions.length === 0 ? (
        <p className="mt-8 rounded-xl border border-dashed border-black/15 p-8 text-center text-sm opacity-60 dark:border-white/20">
          No captions yet.
        </p>
      ) : (
        <ul className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {captions.map((caption) => {
            const image = caption.images;
            return (
              <li
                key={caption.id}
                className="flex flex-col overflow-hidden rounded-xl border border-black/10 dark:border-white/15"
              >
                {image && image.width && image.height && (
                  // Fixed-ratio box so the three cards in a row line up. Memes
                  // vary from 465×372 to 1237×1454, so `contain` keeps the whole
                  // image visible rather than cropping the joke out of frame.
                  <div className="relative aspect-square w-full bg-black/[0.03] dark:bg-white/[0.04]">
                    <Image
                      src={imageSrc(image.storage_path)}
                      alt={caption.text}
                      width={image.width}
                      height={image.height}
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 360px"
                      className="h-full w-full object-contain"
                    />
                  </div>
                )}

                <div className="p-4">
                  <p className="text-[15px] leading-relaxed">{caption.text}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
