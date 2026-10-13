import { GoogleGenAI } from "@google/genai";
import { SYSTEM_INSTRUCTION, type Voice } from "./prompts";

// Server-only: the key has no NEXT_PUBLIC_ prefix, so importing this from a
// Client Component would leave `apiKey` undefined and throw at module load.
const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "Missing GEMINI_API_KEY in .env.local. Get one at https://aistudio.google.com/apikey",
  );
}

// Model order was measured against this project's own key, not chosen by vintage:
//
//   gemini-3.5-flash       ~5s    good captions          <- primary
//   gemini-3.1-flash-lite  ~18s   blander but steady     <- fallback
//
// The primary routes to gemini-3.6-flash, which the free tier caps at 20 requests
// a day. Past that it 429s until the daily reset and every generation runs on the
// fallback, so the fallback is a normal path rather than an emergency one.
//
// Deliberately NOT gemini-3.8-flash: on the free tier it is capped at 20 requests
// and returns 503 under load. One observed success took 61s and a retry cycle
// reached 140s. gemini-2.5-flash is gone — it 404s as "no longer available to new
// users", so anything written against it in an older tutorial will not run.
export const MODEL_CHAIN = ["gemini-3.5-flash", "gemini-3.1-flash-lite"];

// A page-level maxDuration of 60s has to cover the Storage download, the model
// call and the inserts, so a stalled attempt is cut loose rather than allowed to
// eat the whole budget.
const ATTEMPT_TIMEOUT_MS = 20_000;
const ATTEMPTS_PER_MODEL = 2;

// The whole chain has to finish inside the page's maxDuration (60s) with room
// left for the Storage download and the inserts. Without a ceiling the platform
// kills the function mid-call, which loses the catch block below: the client
// gets an unparseable response and the `generations` row is stranded `pending`.
const CHAIN_BUDGET_MS = 45_000;

// Below this there is not enough time left for a call to be worth starting.
const MIN_ATTEMPT_MS = 6_000;

// 408/429/5xx are capacity problems: worth one more attempt, then the next model.
// A 400 or 403 is our bug or a bad key and will fail identically on a retry.
const RETRYABLE_STATUS = new Set([408, 429, 500, 502, 503, 504]);

// A 429 is either a burst limit, which clears in a second, or the free tier's
// daily cap, which does not: gemini-3.5-flash routes to gemini-3.6-flash and is
// capped at 20 requests a day. Retrying the daily one just burns the request
// budget, so it is told apart by the message and falls straight through to the
// next model.
function isDailyQuota(error: unknown): boolean {
  const message = String(
    (error as { message?: unknown })?.message ?? error ?? "",
  );
  return /per day|daily limit|quota.*exceeded.*day/i.test(message);
}

const ai = new GoogleGenAI({
  apiKey,
  // Kept for any call that still reads it, but the interactions client does not:
  // `maxRetries: 0` per request is what actually turns the SDK's own retries off.
  // Retries belong here anyway, so the model fallback can interleave with them.
  httpOptions: { retryOptions: { attempts: 1 } },
});

export type GeneratedCaption = { voice: string; text: string };

export type GenerateResult = {
  captions: GeneratedCaption[];
  model: string;
  systemInstruction: string;
  userPrompt: string;
  responseSchema: Record<string, unknown>;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  raw: unknown;
};

export class CaptionGenerationError extends Error {
  readonly userMessage: string;

  constructor(userMessage: string, cause?: unknown) {
    super(userMessage);
    this.name = "CaptionGenerationError";
    this.userMessage = userMessage;
    this.cause = cause;
  }
}

// Constrains the reply to one entry per voice. `enum` on `voice` is what stops
// the model inventing a fourth persona.
function buildResponseSchema(voiceIds: string[]): Record<string, unknown> {
  return {
    type: "object",
    properties: {
      captions: {
        type: "array",
        items: {
          type: "object",
          properties: {
            voice: { type: "string", enum: voiceIds },
            text: { type: "string" },
          },
          required: ["voice", "text"],
        },
      },
    },
    required: ["captions"],
  };
}

function statusOf(error: unknown): number | null {
  if (error && typeof error === "object" && "status" in error) {
    const status = (error as { status?: unknown }).status;
    if (typeof status === "number") return status;
  }
  return null;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Pulls the captions out of the model's JSON and drops anything unusable, so a
// malformed reply becomes a clear error instead of a row of empty captions.
function parseCaptions(
  outputText: string | undefined,
  voices: Voice[],
): GeneratedCaption[] {
  if (!outputText) {
    throw new CaptionGenerationError("Gemini returned an empty response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    throw new CaptionGenerationError("Gemini returned a reply we couldn't read.");
  }

  const raw =
    parsed && typeof parsed === "object" && "captions" in parsed
      ? (parsed as { captions?: unknown }).captions
      : null;

  if (!Array.isArray(raw)) {
    throw new CaptionGenerationError("Gemini's reply was missing its captions.");
  }

  const allowed = new Map(voices.map((voice) => [voice.id, voice]));
  const byVoice = new Map<string, string>();

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue;

    const voice = (entry as { voice?: unknown }).voice;
    const text = (entry as { text?: unknown }).text;

    if (typeof voice !== "string" || typeof text !== "string") continue;
    if (!allowed.has(voice)) continue;

    const trimmed = text.trim();
    if (!trimmed) continue;

    // First answer per voice wins, so a duplicate can't overwrite a good one.
    if (!byVoice.has(voice)) byVoice.set(voice, trimmed);
  }

  if (byVoice.size === 0) {
    throw new CaptionGenerationError(
      "Gemini didn't write any usable captions for this photo. Try another one.",
    );
  }

  // Emitted in the configured voice order rather than the model's order.
  return voices
    .filter((voice) => byVoice.has(voice.id))
    .map((voice) => ({ voice: voice.id, text: byVoice.get(voice.id)! }));
}

export async function generateCaptions(args: {
  imageBase64: string;
  mimeType: string;
  voices: Voice[];
  // Built by the caller so the prompt recorded in `generations` before the call
  // is byte-identical to the one actually sent.
  userPrompt: string;
}): Promise<GenerateResult> {
  const { imageBase64, mimeType, voices, userPrompt } = args;

  if (voices.length === 0) {
    throw new CaptionGenerationError("No caption voices are configured.");
  }

  const responseSchema = buildResponseSchema(voices.map((voice) => voice.id));
  let lastError: unknown = null;
  const deadline = Date.now() + CHAIN_BUDGET_MS;

  chain: for (const model of MODEL_CHAIN) {
    for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
      const startedAt = Date.now();

      // Never start a call that cannot finish inside the budget: returning a
      // real error beats being killed mid-request with the row still `pending`.
      const remaining = deadline - startedAt;
      if (remaining < MIN_ATTEMPT_MS) break chain;

      try {
        // Params are snake_case on this API — camelCase keys are rejected
        // outright with "Unknown parameter".
        const response = await ai.interactions.create(
          {
            model,
            system_instruction: SYSTEM_INSTRUCTION,
            input: [
              { type: "text", text: userPrompt },
              { type: "image", data: imageBase64, mime_type: mimeType },
            ],
            response_format: {
              type: "text",
              mime_type: "application/json",
              schema: responseSchema,
            },
            // "low" keeps the jokes sharp while cutting thinking tokens from
            // ~800 to ~120. Temperature is up because identical captions every
            // time would make the whole product pointless.
            generation_config: { thinking_level: "low", temperature: 1.1 },
          },
          // Two measured gotchas, both silent:
          //
          // `timeout`, not `timeout_ms` — the options argument is camelCase even
          // though the request body is snake_case, and an unknown key here is
          // dropped without complaint, leaving the attempt uncapped.
          //
          // `maxRetries` is what this client honours. The constructor's
          // httpOptions.retryOptions is ignored here, so without this the SDK
          // retries a 429 behind our back: one measured attempt took 34s instead
          // of the 304ms the same call takes with retries off.
          { timeout: Math.min(ATTEMPT_TIMEOUT_MS, remaining), maxRetries: 0 },
        );

        const captions = parseCaptions(response.output_text, voices);

        return {
          captions,
          model,
          systemInstruction: SYSTEM_INSTRUCTION,
          userPrompt,
          responseSchema,
          inputTokens: response.usage?.total_input_tokens ?? null,
          outputTokens: response.usage?.total_output_tokens ?? null,
          latencyMs: Date.now() - startedAt,
          raw: response.output_text ?? null,
        };
      } catch (error) {
        lastError = error;

        // A malformed reply is not a capacity problem: try the next model rather
        // than asking the same one again.
        if (error instanceof CaptionGenerationError) break;

        const status = statusOf(error);

        // A rejected key fails identically on every model, so stop the chain and
        // say so rather than working through the fallbacks to the same end.
        if (status === 400 || status === 401 || status === 403) {
          throw new CaptionGenerationError(
            "Caption generation is misconfigured. Check GEMINI_API_KEY.",
            error,
          );
        }

        // Both of these are permanent for this model and fine on the next one: a
        // 404 is a retired model (which is what happened to gemini-2.5-flash),
        // and a spent daily quota will still be spent in 700ms.
        if (status === 404 || isDailyQuota(error)) continue chain;

        if (status !== null && !RETRYABLE_STATUS.has(status)) {
          throw new CaptionGenerationError(
            "Caption generation failed. Try again.",
            error,
          );
        }

        if (attempt < ATTEMPTS_PER_MODEL) {
          await sleep(700 * attempt);
        }
      }
    }
  }

  throw new CaptionGenerationError(
    isDailyQuota(lastError)
      ? "Today's free Gemini quota is used up on every model we try. It resets about a day after the first call, so this will work again tomorrow."
      : "Gemini is busy right now. Give it a few seconds and try again.",
    lastError,
  );
}
