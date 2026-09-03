import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { TIER_NAMES } from "@/lib/billing/tiers";
import { gateway, generateSpeech } from "ai";
import { MAX_SPEECH_CHARS } from "@/lib/export/narrate";
import { requirePro } from "@/lib/billing/server";

/**
 * Words in, a voice out. The other half of the audiobook pair.
 *
 * One chunk per request, and deliberately no more. A book is far past any
 * speech model's input limit, so it has to be cut up somewhere; doing it on the
 * client means a forty-chapter book is forty visible steps rather than one
 * request that either succeeds after several minutes or fails having produced
 * nothing. It also keeps this route stateless — there is no job to track, no
 * partial result to store, and a failed chunk is retried on its own.
 *
 * Degrades like its neighbours: no key, 501 with a message saying so.
 */

export const maxDuration = 300;

const MODEL = "openai/tts-1";

/** Voices the model offers. Named here so an unknown one cannot be passed on. */
const VOICES = new Set([
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
]);
const DEFAULT_VOICE = "onyx";

export async function POST(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Narration");
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error:
          "No AI_GATEWAY_API_KEY is set. Add one to .env.local and restart the dev server.",
      },
      { status: 501 },
    );
  }

  // Billed by the character, so it is gated like the assistant and the
  // transcriber. The proxy skips /api, so the route checks for itself. This
  // runs once per chunk, which is once per few thousand characters rather than
  // once per book — a plan cancelled halfway through a forty-chapter export
  // stops it, which is the behaviour you want from a metered call.
  const denied = await requirePro({
    signIn: "Sign in to export an audiobook.",
    upgrade: `Audiobooks are part of ${TIER_NAMES.writer}. Upgrade to switch them on.`,
  });
  if (denied) return denied;

  let text: string;
  let voice: string;
  try {
    const body = (await request.json()) as { text?: string; voice?: string };
    text = (body.text ?? "").trim();
    voice = VOICES.has(body.voice ?? "") ? body.voice! : DEFAULT_VOICE;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!text) {
    return Response.json({ error: "No text to read." }, { status: 400 });
  }

  // The client splits to this size already; a longer body means the two have
  // drifted apart, and the model would reject it less legibly than this does.
  if (text.length > MAX_SPEECH_CHARS + 500) {
    return Response.json(
      { error: "That passage is too long to read in one request." },
      { status: 413 },
    );
  }

  try {
    const { audio } = await generateSpeech({
      model: gateway.speechModel(MODEL),
      text,
      voice,
      outputFormat: "mp3",
    });

    // The bytes themselves, not JSON. Base64 in a JSON envelope would inflate
    // an audiobook by a third across hundreds of requests.
    return new Response(new Uint8Array(audio.uint8Array), {
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("[narrate] failed", err);
    return Response.json(
      {
        error:
          providerReason(err) ?? "The narrator could not read that passage.",
      },
      { status: 502 },
    );
  }
}

/**
 * The provider's own words, when it gave any.
 *
 * Worth passing through rather than replacing: "add a credit card to unlock
 * your free credits" tells a writer exactly what to do, while "the narrator
 * could not read that passage" sends them looking at their prose for a fault
 * that is not there. Only messages that read as sentences are forwarded — a
 * stack trace or a bare code helps nobody.
 */
function providerReason(err: unknown): string | null {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message || message.length > 300) return null;
  return /\s/.test(message) ? message : null;
}
