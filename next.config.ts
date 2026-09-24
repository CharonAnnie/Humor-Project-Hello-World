import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
}

const nextConfig: NextConfig = {
  images: {
    // Seed images are served from the public `images` bucket. Scoped to that
    // bucket's public path so the optimizer won't proxy anything else.
    remotePatterns: [
      new URL(`${supabaseUrl}/storage/v1/object/public/images/**`),
    ],
  },
};

export default nextConfig;
