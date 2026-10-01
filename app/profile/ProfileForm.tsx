"use client";

import { useState } from "react";
import Link from "next/link";
import Avatar from "@/app/components/Avatar";
import { createClient } from "@/lib/supabase/client";

type Props = {
  userId: string;
  email: string | null;
  initialFirstName: string;
  initialLastName: string;
  initialAvatarUrl: string | null;
};

type Status = { kind: "ok" | "error"; message: string } | null;

export default function ProfileForm({
  userId,
  email,
  initialFirstName,
  initialLastName,
  initialAvatarUrl,
}: Props) {
  const supabase = createClient();
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [savedNames, setSavedNames] = useState({
    first: initialFirstName,
    last: initialLastName,
  });
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [status, setStatus] = useState<Status>(null);
  const [busy, setBusy] = useState(false);

  const dirty =
    firstName.trim() !== savedNames.first ||
    lastName.trim() !== savedNames.last;
  const complete = Boolean(firstName.trim() && lastName.trim());

  const saveNames = async () => {
    setBusy(true);
    setStatus(null);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setBusy(false);

    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }

    setSavedNames({ first: firstName.trim(), last: lastName.trim() });
    setStatus({ kind: "ok", message: "Profile saved." });
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setBusy(true);
    setStatus(null);

    // The first path segment must be the user's id: the Storage policies only
    // allow writes inside your own folder. The timestamp keeps each upload at a
    // fresh URL so caches don't serve the previous photo.
    const extension = file.name.split(".").pop() ?? "jpg";
    const path = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, file);

    if (uploadError) {
      setBusy(false);
      setStatus({ kind: "error", message: uploadError.message });
      return;
    }

    // Only the public URL goes in the database — never the image bytes.
    const { data } = supabase.storage.from("avatars").getPublicUrl(path);

    const { error } = await supabase
      .from("profiles")
      .update({
        avatar_url: data.publicUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setBusy(false);

    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }

    setAvatarUrl(data.publicUrl);
    setStatus({ kind: "ok", message: "Photo updated." });
  };

  return (
    <div className="card mt-8 divide-y divide-line">
      <section className="flex items-center gap-5 p-6">
        <Avatar
          url={avatarUrl}
          firstName={firstName}
          lastName={lastName}
          email={email}
          size={80}
        />
        <div className="min-w-0">
          <label className="btn btn-secondary cursor-pointer">
            {avatarUrl ? "Change photo" : "Upload photo"}
            <input
              type="file"
              accept="image/*"
              onChange={uploadPhoto}
              disabled={busy}
              className="sr-only"
            />
          </label>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            A square JPG or PNG works best.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-5 p-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label" htmlFor="first_name">
              First name
            </label>
            <input
              id="first_name"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              placeholder="Ada"
              autoComplete="given-name"
              className="input"
            />
          </div>
          <div>
            <label className="label" htmlFor="last_name">
              Last name
            </label>
            <input
              id="last_name"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              placeholder="Lovelace"
              autoComplete="family-name"
              className="input"
            />
          </div>
        </div>

        {email && (
          <div>
            <span className="label">Email</span>
            <p className="text-sm text-muted">{email} · from Google</p>
          </div>
        )}
      </section>

      <section className="flex flex-wrap items-center justify-between gap-3 p-6">
        <div className="flex items-center gap-3">
          <button
            onClick={saveNames}
            disabled={busy || !complete || !dirty}
            className="btn btn-primary"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <Link href="/" className="btn btn-secondary">
            Done
          </Link>
        </div>

        {status && (
          <p
            className={
              status.kind === "ok"
                ? "text-sm text-emerald-600 dark:text-emerald-400"
                : "text-sm text-red-600 dark:text-red-400"
            }
          >
            {status.message}
          </p>
        )}
      </section>
    </div>
  );
}
