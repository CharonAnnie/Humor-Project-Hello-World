import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!supabaseUrl) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL in .env.local");
}

const nextConfig: NextConfig = {
  images: {
    // Seed images and profile photos are served from the public `images` and
    // `avatars` buckets. Scoped to those buckets' public paths so the optimizer
    // won't proxy anything else.
    remotePatterns: [
      new URL(`${supabaseUrl}/storage/v1/object/public/images/**`),
      new URL(`${supabaseUrl}/storage/v1/object/public/avatars/**`),
    ],
  },
};

export default nextConfig;
