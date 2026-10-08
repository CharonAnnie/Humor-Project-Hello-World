// Prompt construction for Caption Drop.
//
// One Gemini call produces a caption in every voice, which keeps a generation to
// a single round trip. The per-voice prompt is still rendered separately and
// stored on `captions.prompt`, so every saved caption carries the exact prompt
// that produced it rather than a pointer to a shared blob.

export type Voice = {
  id: string;
  label: string;
  instruction: string;
};

export const MAX_CAPTION_CHARS = 120;

// Subject-agnostic on purpose: the photo can be anything. The voice supplies the
// attitude, so this only has to set the house rules for what a caption may be.
export const SYSTEM_INSTRUCTION = [
  "You write captions for Caption Drop, where people upload a photo and everyone votes on the captions.",
  "",
  "Rules for every caption:",
  `- At most ${MAX_CAPTION_CHARS} characters. Shorter is funnier.`,
  "- One line. No hashtags, no emoji, no quotation marks around the caption.",
  "- Caption what is actually visible in the photo. Do not invent details that aren't there.",
  "- Specific beats generic: the funniest thing in a photo is usually a small detail, so name it.",
  "- Punch up, never down. No slurs, nothing sexual, nothing about real named people.",
  "- If the photo is boring, find the joke in how boring it is.",
].join("\n");

// The prompt for a single caption, as stored on `captions.prompt`. Self-contained
// on purpose: pasted into Gemini with the same photo, it reproduces the caption.
export function renderCaptionPrompt(voice: Voice, note?: string | null): string {
  const lines = [
    SYSTEM_INSTRUCTION,
    "",
    `Voice: ${voice.label}`,
    voice.instruction,
  ];

  if (note && note.trim()) {
    lines.push("", `Context from the person who took the photo: ${note.trim()}`);
  }

  lines.push(
    "",
    "Write exactly one caption for the attached photo in this voice.",
  );

  return lines.join("\n");
}

// The prompt for the real call, which asks for all the voices at once.
export function buildUserPrompt(voices: Voice[], note?: string | null): string {
  const lines = [
    `Write exactly one caption for the attached photo in each of these ${voices.length} voices.`,
    "",
  ];

  for (const voice of voices) {
    lines.push(`- ${voice.id} (${voice.label}): ${voice.instruction}`);
  }

  if (note && note.trim()) {
    lines.push("", `Context from the person who took the photo: ${note.trim()}`);
  }

  lines.push(
    "",
    "Return one entry per voice, using the voice ids above verbatim.",
  );

  return lines.join("\n");
}
