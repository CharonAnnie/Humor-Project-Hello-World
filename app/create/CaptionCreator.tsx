"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import type { Voice } from "@/lib/prompts";
import { generateCaptionsForUpload, type GeneratedRow } from "./actions";
import { deleteCaption } from "@/app/actions/captions";

// Downscaling before upload keeps the Storage object small, the upload quick and
// the image token count (and so the latency) down. 1600px is still more detail
// than Gemini uses for a caption.
const MAX_EDGE = 1600;
const RECODE_ABOVE_BYTES = 1_500_000;
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];

type Phase = "idle" | "ready" | "working" | "done";

type Prepared = {
  blob: Blob;
  mimeType: string;
  width: number;
  height: number;
  extension: string;
};

// Reads the real pixel dimensions, and re-encodes only when the photo is big
// enough to be worth it, so a small PNG keeps its original bytes.
async function prepareImage(file: File): Promise<Prepared> {
  const bitmap = await createImageBitmap(file);
  const { width, height } = bitmap;
  const longEdge = Math.max(width, height);
  const needsResize = longEdge > MAX_EDGE;
  const needsRecode = needsResize || file.size > RECODE_ABOVE_BYTES;

  if (!needsRecode) {
    bitmap.close();
    return {
      blob: file,
      mimeType: file.type,
      width,
      height,
      extension: file.name.split(".").pop()?.toLowerCase() || "jpg",
    };
  }

  const scale = needsResize ? MAX_EDGE / longEdge : 1;
  const targetWidth = Math.round(width * scale);
  const targetHeight = Math.round(height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Your browser couldn't process that image.");
  }

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );

  if (!blob) {
    throw new Error("Your browser couldn't process that image.");
  }

  return {
    blob,
    mimeType: "image/jpeg",
    width: targetWidth,
    height: targetHeight,
    extension: "jpg",
  };
}

export default function CaptionCreator({
  userId,
  voices,
}: {
  userId: string;
  voices: Voice[];
}) {
  const supabase = createClient();
  const fileInput = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>("idle");
  const [step, setStep] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  // Caption id waiting for a second click, and the one currently being deleted.
  const [armed, setArmed] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [captions, setCaptions] = useState<GeneratedRow[]>([]);

  const reset = () => {
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
    setPrepared(null);
    setFileName(null);
    setArmed(null);
    setDeleting(null);
    setCaptions([]);
    setError(null);
    setNote("");
    setPhase("idle");
    setStep("");
    if (fileInput.current) fileInput.current.value = "";
  };

  // Step one: decode, downscale and preview. Nothing leaves the browser yet, so
  // the note can still be edited once you can see what you picked.
  const onPick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_MIME.includes(file.type)) {
      setError("Upload a JPEG, PNG or WebP photo.");
      return;
    }

    setError(null);
    setCaptions([]);

    try {
      const ready = await prepareImage(file);

      if (preview) URL.revokeObjectURL(preview);
      setPreview(URL.createObjectURL(ready.blob));
      setPrepared(ready);
      setFileName(file.name);
      setPhase("ready");
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Couldn't read that photo.",
      );
    }
  };

  // Step two: upload, then let the server read the bytes back and call Gemini.
  const onGenerate = async () => {
    if (!prepared) return;

    setError(null);
    setPhase("working");

    try {
      // The first path segment must be the user's id: Storage policies only allow
      // writes inside your own folder. The timestamp keeps each upload at a fresh
      // URL so caches don't serve a previous photo.
      const path = `${userId}/drop-${Date.now()}.${prepared.extension}`;

      setStep("Uploading…");
      const { error: uploadError } = await supabase.storage
        .from("images")
        .upload(path, prepared.blob, { contentType: prepared.mimeType });

      if (uploadError) {
        setError(uploadError.message);
        setPhase("ready");
        return;
      }

      // The photo itself never travels through the Server Action: its body is
      // capped at 1MB. The action reads the bytes back from Storage instead.
      setStep("Gemini is writing captions… this takes a few seconds.");
      const result = await generateCaptionsForUpload({
        storagePath: path,
        fileName,
        mimeType: prepared.mimeType,
        width: prepared.width,
        height: prepared.height,
        sizeBytes: prepared.blob.size,
        note: note.trim() || null,
      });

      if (result.status === "error") {
        setError(result.message);
        setPhase("ready");
        return;
      }

      if (result.status === "done") {
        setCaptions(result.captions);
        setPhase("done");
      }
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : "Something went wrong.",
      );
      setPhase("ready");
    } finally {
      setStep("");
    }
  };

  // Deleting is irreversible, so the first click arms the button and the second
  // confirms. Cheaper than a modal and it still prevents a misclick binning a
  // caption the user liked.
  const onDelete = async (id: string) => {
    if (armed !== id) {
      setArmed(id);
      return;
    }

    setArmed(null);
    setDeleting(id);
    setError(null);

    const result = await deleteCaption(id);
    setDeleting(null);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setCaptions((current) => current.filter((caption) => caption.id !== id));
  };

  const busy = phase === "working";

  return (
    <div className="card mt-8 divide-y divide-line">
      {preview && (
        <div className="relative aspect-square w-full overflow-hidden rounded-t-2xl bg-foreground/[0.03]">
          {/* A blob: URL from this browser, so it skips the Next optimizer. */}
          <Image
            src={preview}
            alt="The photo you're captioning"
            fill
            unoptimized
            className="object-contain"
          />
        </div>
      )}

      {phase !== "done" && (
        <section className="flex flex-col gap-5 p-6">
          <div>
            <label className="label" htmlFor="note">
              Anything we should know? (optional)
            </label>
            <input
              id="note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="my roommate's third attempt at bread"
              maxLength={200}
              disabled={busy}
              className="input"
            />
            <p className="mt-2 text-xs leading-relaxed text-muted">
              Context helps the jokes land. It becomes part of the prompt.
            </p>
          </div>

          <div>
            <label
              className={`btn btn-lg w-full cursor-pointer ${
                prepared ? "btn-secondary" : "btn-primary"
              }`}
            >
              {prepared ? "Pick a different photo" : "Choose a photo"}
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onPick}
                disabled={busy}
                className="sr-only"
              />
            </label>
            <p className="mt-2 text-xs leading-relaxed text-muted">
              JPEG, PNG or WebP. Large photos are shrunk before upload.
            </p>
          </div>

          {prepared && (
            <button
              type="button"
              onClick={onGenerate}
              disabled={busy}
              className="btn btn-primary btn-lg w-full"
            >
              {busy ? "Writing…" : `Write ${voices.length} captions`}
            </button>
          )}

          {voices.length > 0 && (
            <div>
              <span className="label">Voices</span>
              <div className="flex flex-wrap gap-2">
                {voices.map((voice) => (
                  <span key={voice.id} className="voice-chip">
                    {voice.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {busy && (
        <section className="flex items-center gap-3 p-6 text-sm text-muted">
          <span className="spinner" aria-hidden />
          <span aria-live="polite">{step}</span>
        </section>
      )}

      {error && (
        <section className="p-6">
          <p className="rounded-xl border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-600 dark:text-red-400">
            {error}
          </p>
        </section>
      )}

      {phase === "done" && (
        <section className="flex flex-col gap-4 p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-muted">
            {captions.length === 0
              ? "Nothing saved from this photo"
              : `${captions.length} ${captions.length === 1 ? "caption" : "captions"} saved`}
          </h2>

          {captions.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">
              You deleted all of them, so this photo won&apos;t appear in the
              gallery.
            </p>
          ) : (
            <>
              <p className="text-xs leading-relaxed text-muted">
                These are live in the gallery now. Delete any that didn&apos;t
                land and nobody will get to vote on them.
              </p>

              <ul className="flex flex-col gap-3">
                {captions.map((caption) => (
                  <li
                    key={caption.id}
                    className="rounded-xl border border-line p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className="voice-chip">{caption.voiceLabel}</span>

                      <button
                        type="button"
                        onClick={() => onDelete(caption.id)}
                        onBlur={() =>
                          setArmed((current) =>
                            current === caption.id ? null : current,
                          )
                        }
                        disabled={deleting === caption.id}
                        className="caption-delete"
                        data-armed={armed === caption.id || undefined}
                        aria-label={
                          armed === caption.id
                            ? `Confirm deleting the ${caption.voiceLabel} caption`
                            : `Delete the ${caption.voiceLabel} caption`
                        }
                      >
                        {deleting === caption.id
                          ? "Deleting…"
                          : armed === caption.id
                            ? "Really delete?"
                            : "Delete"}
                      </button>
                    </div>

                    <p className="mt-2 text-[15px] leading-relaxed">
                      {caption.text}
                    </p>
                    <details className="prompt-reveal">
                      <summary>Prompt used</summary>
                      <pre>{caption.prompt}</pre>
                    </details>
                  </li>
                ))}
              </ul>
            </>
          )}

          <div className="flex flex-wrap items-center gap-3">
            <Link href="/" className="btn btn-primary">
              {captions.length === 0 ? "Back to the gallery" : "See them in the gallery"}
            </Link>
            <button type="button" onClick={reset} className="btn btn-secondary">
              Drop another
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
