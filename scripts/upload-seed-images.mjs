// Uploads public/images/seed/* into the Supabase `images` bucket, at paths that
// match the `storage_path` column in public.images.
//
//   node --env-file=.env.local scripts/upload-seed-images.mjs
//
// The seed files are NOT in the repo: once uploaded, Storage is the only copy
// the app reads, so they were removed rather than committed. To re-run this,
// put image files back in public/images/seed/ first.
//
// Needs a SECRET key (sb_secret_… or the legacy service_role JWT). The anon
// publishable key cannot write to Storage: storage.objects has RLS on with no
// policies, so anon inserts are rejected. The key is read from the environment
// and never logged.
import { createClient } from "@supabase/supabase-js";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret =
  process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !secret) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SECRET_KEY in .env.local.",
  );
  process.exit(1);
}

const BUCKET = "images";
const SEED_DIR = "public/images/seed";
const MIME = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

const supabase = createClient(url, secret, {
  auth: { persistSession: false },
});

const files = (await readdir(SEED_DIR)).filter((f) => path.extname(f) in MIME);
if (files.length === 0) {
  console.error(`No images found in ${SEED_DIR}`);
  process.exit(1);
}

let failed = 0;

for (const file of files) {
  const body = await readFile(path.join(SEED_DIR, file));
  // Mirrors images.storage_path, e.g. "images/seed/foo.png" -> "seed/foo.png"
  // inside the `images` bucket.
  const key = `seed/${file}`;

  const { error } = await supabase.storage.from(BUCKET).upload(key, body, {
    contentType: MIME[path.extname(file)],
    upsert: true,
  });

  if (error) {
    console.error(`FAIL ${key}: ${error.message}`);
    failed++;
  } else {
    console.log(`ok   ${key} (${body.length} bytes)`);
  }
}

console.log(`\n${files.length - failed}/${files.length} uploaded to ${BUCKET}/`);
process.exit(failed > 0 ? 1 : 0);
