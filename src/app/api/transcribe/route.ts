import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { TIER_NAMES } from "@/lib/billing/tiers";
import { gateway, transcribe } from "ai";
import { transcriptToProse } from "@/lib/import/transcript";
import { requirePro } from "@/lib/billing/server";

/**
 * Audio in, words out. The far end of "import an audiobook".
 *
 * The second part of the app that talks to a paid service, and it degrades the
 * same way the assistant does: with no key it answers 501 saying so, rather
 * than presenting a control that fails in some less legible way. Nothing here
 * costs anything until a key is set.
 *
 * Only the transcript is produced here. Splitting it into chapters and making
 * a book of it happens on the client, through the same
 * parseText → splitIntoChapters → createBookFromImport path every other import
 * takes — so an audiobook lands as a book indistinguishable from a .docx.
 */

// Transcribing an hour of audio is not a two-second request.
export const maxDuration = 300;

/**
 * Whisper and the gpt-4o transcribers both refuse anything larger, so the cap
 * is theirs rather than ours. Checked here so a writer is told plainly instead
 * of waiting through an upload for the provider to reject it.
 */
const MAX_AUDIO_BYTES = 25_000_000;

const MODEL = "openai/gpt-4o-transcribe";

export async function POST(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Audio transcription");
  if (!process.env.AI_GATEWAY_API_KEY) {
    return Response.json(
      {
        error:
          "No AI_GATEWAY_API_KEY is set. Add one to .env.local and restart the dev server.",
      },
      { status: 501 },
    );
  }

  // The proxy's sign-in wall skips /api, so this route checks for itself — the
  // same reasoning as the assistant. Transcription is billed by the minute; an
  // open endpoint is somebody else's invoice. Both directions of the audiobook
  // sit behind the plan's one Audiobook line, which is how the app talks about
  // them everywhere else.
  const denied = await requirePro({
    signIn: "Sign in to import an audiobook.",
    upgrade: `Audiobooks are part of ${TIER_NAMES.writer}. Upgrade to switch them on.`,
  });
  if (denied) return denied;

  let audio: File | null = null;
  try {
    const form = await request.formData();
    const field = form.get("audio");
    if (field instanceof File) audio = field;
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  if (!audio) {
    return Response.json({ error: "No audio file was sent." }, { status: 400 });
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return Response.json(
      {
        error: `That file is ${Math.round(audio.size / 1_000_000)}MB. The transcriber accepts up to ${MAX_AUDIO_BYTES / 1_000_000}MB — split the recording and import the parts as separate books.`,
      },
      { status: 413 },
    );
  }

  try {
    const result = await transcribe({
      model: gateway.transcriptionModel(MODEL),
      audio: new Uint8Array(await audio.arrayBuffer()),
    });

    // Paragraphed here rather than on the client, because this is where the
    // segment timings are. A transcript without them is one unbroken run, and
    // the chapter splitter would have nothing to split on.
    const text = transcriptToProse(result.text, result.segments).trim();
    if (!text) {
      return Response.json(
        { error: "Nothing was said in that recording, or none of it could be made out." },
        { status: 422 },
      );
    }

    return Response.json({ text });
  } catch (err) {
    console.error("[transcribe] failed", err);
    return Response.json(
      {
        error:
          providerReason(err) ??
          "The transcriber could not read that file. Try MP3, M4A, WAV or WebM.",
      },
      { status: 502 },
    );
  }
}

/**
 * The provider's own words, when it gave any.
 *
 * "Add a credit card to unlock your free credits" tells a writer exactly what
 * to do; "could not read that file" sends them re-encoding audio that was
 * never the problem. Only sentence-shaped messages are forwarded — a bare code
 * or a stack trace helps nobody.
 */
function providerReason(err: unknown): string | null {
  const message = err instanceof Error ? err.message.trim() : "";
  if (!message || message.length > 300) return null;
  return /\s/.test(message) ? message : null;
}
