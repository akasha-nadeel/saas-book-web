import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import {
  buildWorkshopPrompt,
  extractDraft,
  MAX_TOKENS,
  MAX_WORKSHOP_OPENING,
  replyWithoutDraft,
  WORKSHOP_SYSTEM,
  type WorkshopMessage,
} from "@/lib/blurb-workshop";
import { openingFrom } from "@/lib/comps/rank";
import { BLURB_MAX } from "@/lib/publishing";

/**
 * One turn of the blurb conversation.
 *
 * **Not streamed, and that is a deployment decision rather than a UX one.**
 * The assistant at `/api/chat` streams because it answers about a chapter at
 * length, and it can afford to be Anthropic-only. This route has to run on
 * whichever provider is configured — Gemini in development here, Claude in
 * production — and `ai.ts` is the only path that does both. Streaming would
 * mean writing an SSE reader for Gemini's REST API, which is exactly the
 * complication `ai.ts` was scoped to avoid.
 *
 * The cost is a few seconds' wait per turn, and the shape of this feature is
 * unusually forgiving of it: most turns are one short question, and the long
 * turn — the draft — is the same wait "Ask a reader" already asks for on this
 * screen. If it ever becomes worth streaming, the change belongs in `ai.ts`
 * for both providers rather than as a second Anthropic-only route.
 *
 * **This is the third route that sends prose**, after the assistant and comps
 * ranking. The opening of the manuscript goes; the rest never does, and the
 * cap is applied here as well as on the client because a browser is not where
 * a limit is kept. `/privacy` names this route; add a field to what is sent
 * and add it there in the same commit.
 */

export const maxDuration = 60;

/** More than a conversation about one paragraph could need. */
const MAX_TURNS = 40;

/** One turn of chat. Anything longer is a paste of the manuscript. */
const MAX_TURN_CHARS = 4000;

function text(value: unknown, cap: number): string {
  return typeof value === "string" ? value.slice(0, cap).trim() : "";
}

/**
 * Whatever arrived, as a conversation.
 *
 * The history is client-held — nothing about a chat is persisted — so every
 * turn of it is untrusted input rather than something read back from our own
 * store. Anything unrecognised is dropped rather than repaired.
 */
function turnsIn(value: unknown): WorkshopMessage[] {
  if (!Array.isArray(value)) return [];

  const turns: WorkshopMessage[] = [];
  for (const raw of value.slice(-MAX_TURNS)) {
    if (!raw || typeof raw !== "object") continue;
    const { role, content } = raw as { role?: unknown; content?: unknown };
    if (role !== "user" && role !== "assistant") continue;
    const said = text(content, MAX_TURN_CHARS);
    if (said) turns.push({ role, content: said });
  }
  return turns;
}

export async function POST(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Blurb workshop");
  if (!modelProvider()) {
    return Response.json(
      {
        error:
          "No model is configured. Add ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to .env.local and restart.",
      },
      { status: 501 },
    );
  }

  const denied = await requirePro({
    signIn: "Sign in to work on your blurb with a reader.",
    upgrade:
      "The free plan includes three blurb conversations, and yours are used. Writing the blurb, the counts and the findings stay free.",
  });
  if (denied) return denied;

  let body: {
    messages?: unknown;
    title?: unknown;
    genre?: unknown;
    draft?: unknown;
    opening?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Nothing to read." }, { status: 400 });
  }

  const messages = turnsIn(body.messages);
  if (messages.length === 0) {
    return Response.json({ error: "Say something first." }, { status: 400 });
  }

  try {
    const reply = await askModel({
      system: WORKSHOP_SYSTEM,
      prompt: buildWorkshopPrompt({
        messages,
        title: text(body.title, 200) || undefined,
        genre: text(body.genre, 60) || undefined,
        draft: text(body.draft, BLURB_MAX) || undefined,
        // Cut here as well as on the client: the client's cap is a courtesy,
        // this one is the promise that the ending never leaves the machine.
        opening:
          openingFrom(text(body.opening, MAX_WORKSHOP_OPENING * 2), MAX_WORKSHOP_OPENING) ||
          undefined,
      }),
      maxTokens: MAX_TOKENS,
    });

    /*
     * Split here rather than on the client so the two halves cannot disagree
     * about what counts as a draft — the bubble and the button are read from
     * one parse of one reply.
     */
    return Response.json({
      message: replyWithoutDraft(reply),
      draft: extractDraft(reply),
    });
  } catch (err) {
    if (err instanceof ModelError) {
      return Response.json(
        { error: err.message },
        { status: err.kind === "auth" ? 502 : err.kind === "rate" ? 429 : 502 },
      );
    }
    return Response.json(
      { error: "That did not work. Your blurb is unaffected." },
      { status: 502 },
    );
  }
}
