"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  CaptionGenerationError,
  generateCaptions,
  MODEL_CHAIN,
} from "@/lib/gemini";
import {
  buildUserPrompt,
  renderCaptionPrompt,
  SYSTEM_INSTRUCTION,
  type Voice,
} from "@/lib/prompts";

// Mirrors the `images` bucket's own limits, so a rejected upload fails before
// the model call rather than after it.
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);
const MAX_BYTES = 10 * 1024 * 1024;
const MAX_NOTE_CHARS = 200;

export type GeneratedRow = {
  id: string;
  voice: string;
  voiceLabel: string;
  text: string;
  prompt: string;
};

export type GenerateState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "done"; imageId: string; captions: GeneratedRow[] };

export type UploadInput = {
  storagePath: string;
  fileName: string | null;
  mimeType: string;
  width: number | null;
  height: number | null;
  sizeBytes: number | null;
  note: string | null;
};

export async function generateCaptionsForUpload(
  input: UploadInput,
): Promise<GenerateState> {
  const supabase = await createClient();

  // Server Functions accept direct POSTs, not just calls from our own UI, so this
  // is the real authorization gate rather than a convenience. The RLS policies
  // are the second one.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { status: "error", message: "Sign in to generate captions." };
  }

  // The uploader can name any path in the request body. Storage RLS already
  // confines writes to the caller's own folder, but reads are public — without
  // this check someone could pass another user's object and caption it.
  if (
    !input.storagePath.startsWith(`${user.id}/`) ||
    input.storagePath.includes("..")
  ) {
    return { status: "error", message: "That photo isn't yours to caption." };
  }

  if (!ALLOWED_MIME.has(input.mimeType)) {
    return {
      status: "error",
      message: "Upload a JPEG, PNG or WebP photo.",
    };
  }

  const note = input.note?.trim().slice(0, MAX_NOTE_CHARS) || null;

  // The bytes come back from Storage rather than through the action: a Server
  // Action body is capped at 1MB, which is smaller than most phone photos.
  const { data: blob, error: downloadError } = await supabase.storage
    .from("images")
    .download(input.storagePath);

  if (downloadError || !blob) {
    return {
      status: "error",
      message: "We couldn't read that photo from storage. Try uploading again.",
    };
  }

  if (blob.size > MAX_BYTES) {
    return { status: "error", message: "That photo is larger than 10MB." };
  }

  const imageBase64 = Buffer.from(await blob.arrayBuffer()).toString("base64");

  const { data: voices } = await supabase
    .from("voices")
    .select("id, label, instruction")
    .eq("is_active", true)
    .order("sort_order", { ascending: true })
    .returns<Voice[]>();

  if (!voices || voices.length === 0) {
    return { status: "error", message: "No caption voices are configured yet." };
  }

  // Upsert rather than insert: a retry after a failed generation reuses the photo
  // it already uploaded, and storage_path is unique. onConflict updates, which
  // RLS confines to rows this user owns.
  const { data: image, error: imageError } = await supabase
    .from("images")
    .upsert(
      {
        user_id: user.id,
        storage_path: input.storagePath,
        file_name: input.fileName,
        mime_type: input.mimeType,
        width: input.width,
        height: input.height,
        size_bytes: input.sizeBytes ?? blob.size,
      },
      { onConflict: "storage_path" },
    )
    .select("id")
    .single();

  if (imageError || !image) {
    return {
      status: "error",
      message: "We couldn't save that photo. Try again.",
    };
  }

  const userPrompt = buildUserPrompt(voices, note);

  // Recorded before the call so a crash or timeout still leaves a trace of what
  // was attempted.
  const { data: generation, error: generationError } = await supabase
    .from("generations")
    .insert({
      user_id: user.id,
      image_id: image.id,
      model: MODEL_CHAIN[0],
      system_instruction: SYSTEM_INSTRUCTION,
      user_prompt: userPrompt,
      status: "pending",
    })
    .select("id")
    .single();

  if (generationError || !generation) {
    return {
      status: "error",
      message: "We couldn't start the generation. Try again.",
    };
  }

  try {
    const result = await generateCaptions({
      imageBase64,
      mimeType: input.mimeType,
      voices,
      userPrompt,
    });

    await supabase
      .from("generations")
      .update({
        status: "succeeded",
        model: result.model,
        response_schema: result.responseSchema,
        raw_response: { output_text: result.raw },
        input_tokens: result.inputTokens,
        output_tokens: result.outputTokens,
        latency_ms: result.latencyMs,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generation.id);

    const byId = new Map(voices.map((voice) => [voice.id, voice]));

    // Requirement: each caption is stored with the exact prompt that produced it.
    // One call covers every voice, so the per-voice prompt is rendered here.
    const rows = result.captions.map((caption) => ({
      user_id: user.id,
      image_id: image.id,
      generation_id: generation.id,
      voice: caption.voice,
      text: caption.text,
      prompt: renderCaptionPrompt(byId.get(caption.voice)!, note),
      model: result.model,
    }));

    const { data: inserted, error: captionsError } = await supabase
      .from("captions")
      .insert(rows)
      .select("id, voice, text, prompt")
      .returns<
        { id: string; voice: string; text: string; prompt: string }[]
      >();

    if (captionsError || !inserted) {
      return {
        status: "error",
        message: "The captions were written but couldn't be saved. Try again.",
      };
    }

    revalidatePath("/");
    revalidatePath("/dashboard");

    return {
      status: "done",
      imageId: image.id,
      captions: inserted.map((row) => ({
        id: row.id,
        voice: row.voice,
        voiceLabel: byId.get(row.voice)?.label ?? row.voice,
        text: row.text,
        prompt: row.prompt,
      })),
    };
  } catch (error) {
    const message =
      error instanceof CaptionGenerationError
        ? error.userMessage
        : "Caption generation failed. Try again.";

    await supabase
      .from("generations")
      .update({
        status: "failed",
        error_message: message,
        completed_at: new Date().toISOString(),
      })
      .eq("id", generation.id);

    return { status: "error", message };
  }
}
