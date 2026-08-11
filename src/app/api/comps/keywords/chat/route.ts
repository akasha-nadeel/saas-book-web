import { askModel, ModelError, modelProvider } from "@/lib/ai";
import { requirePro } from "@/lib/billing/server";
import { SLOTS, type Listing } from "@/lib/keywords";
import { keepUsable } from "@/lib/keywords/suggest";
import {
  buildWorkshopPrompt,
  extractKeywords,
  MAX_TOKENS,
  replyWithoutKeywords,
  WORKSHOP_SYSTEM,
  type KeywordMessage,
} from "@/lib/keywords/workshop";

/**
 * One turn of the keyword conversation.
 *
 * **A sibling of `/api/comps/keywords`, not a replacement for it**, and the
 * two answer different questions: the press asks "give me seven from the
 * blurb" and costs one model call, this asks "which seven, and why" and costs
 * a call per turn. They share the filter, so neither can offer a phrase the
 * other's checker would flag, and they sit under one parent so a reader of the
 * tree finds the whole feature in one place.
 *
 * **Not streamed**, for the reason `/api/blurb/workshop` gives: `ai.ts` is the
 * only path that runs on both providers, and an SSE reader for Gemini's REST
 * API is the complication it was scoped to avoid.
 *
 * **No prose leaves.** The conversation, the blurb, the genre, the categories,
 * the listing's names and the seven boxes — all form fields. That keeps this
 * off the short list of routes that carry the manuscript, and it is a promise
 * that has to be kept here rather than on the client: nothing in the body is
 * read except the fields named below. `/privacy` names the route; add a field
 * and add it there in the same commit.
 */

export const maxDuration = 60;

/** More than a conversation about seven short phrases could need. */
const MAX_TURNS = 40;

/** One turn of chat. Anything longer is a paste of something else. */
const MAX_TURN_CHARS = 2000;

/** Guards a paste. The blurb is cut again inside `buildWorkshopPrompt`. */
const MAX_BLURB = 4000;

/** More than the seven boxes could ever be shelved under. */
const MAX_CATEGORIES = 8;

function text(value: unknown, cap: number): string {
  return typeof value === "string" ? value.slice(0, cap).trim() : "";
}

function strings(value: unknown, cap: number, each: number): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => text(v, each))
    .filter((v) => v.length > 0)
    .slice(0, cap);
}

/**
 * Whatever arrived, as a conversation.
 *
 * The history is client-held — nothing about a chat is persisted — so every
 * turn of it is untrusted input rather than something read back from our own
 * store. Anything unrecognised is dropped rather than repaired.
 */
function turnsIn(value: unknown): KeywordMessage[] {
  if (!Array.isArray(value)) return [];

  const turns: KeywordMessage[] = [];
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
    signIn: "Sign in to talk through your keywords.",
    upgrade:
      "The free plan includes three keyword conversations, and yours are used. Typing the seven yourself, the checks and the copy buttons stay free.",
  });
  if (denied) return denied;

  let body: {
    messages?: unknown;
    blurb?: unknown;
    genre?: unknown;
    categories?: unknown;
    keywords?: unknown;
    listing?: unknown;
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

  const raw = (body.listing ?? {}) as Record<string, unknown>;
  const categories = strings(body.categories, MAX_CATEGORIES, 200);

  /*
   * The shelves ride in the listing as well as in the prompt: the prompt asks
   * the model not to repeat them, and `keepUsable` makes sure of it.
   */
  const listing: Listing = {
    title: text(raw.title, 300) || undefined,
    subtitle: text(raw.subtitle, 300) || undefined,
    author: text(raw.author, 200) || undefined,
    series: text(raw.series, 200) || undefined,
    categories,
  };

  try {
    const reply = await askModel({
      system: WORKSHOP_SYSTEM,
      prompt: buildWorkshopPrompt({
        messages,
        blurb: text(body.blurb, MAX_BLURB) || undefined,
        genre: text(body.genre, 100) || undefined,
        categories,
        listing,
        keywords: strings(body.keywords, SLOTS, 200),
      }),
      maxTokens: MAX_TOKENS,
    });

    /*
     * Parsed and filtered here rather than on the client, so the bubble and
     * the button are read from one parse of one reply — and so the checker's
     * verdict on a candidate is not something a browser could skip.
     *
     * A tag whose every phrase is dropped answers `null`, the same as no tag
     * at all: there is nothing to press either way, and an empty list under a
     * message would read as a suggestion that failed rather than as a turn
     * that was not offering one.
     */
    const offered = extractKeywords(reply);
    const keywords = offered ? keepUsable(offered, listing) : [];

    return Response.json({
      message: replyWithoutKeywords(reply),
      keywords: keywords.length > 0 ? keywords : null,
    });
  } catch (err) {
    if (err instanceof ModelError) {
      return Response.json(
        { error: err.message },
        { status: err.kind === "auth" ? 502 : err.kind === "rate" ? 429 : 502 },
      );
    }
    return Response.json(
      { error: "That did not work. Your keywords are unaffected." },
      { status: 502 },
    );
  }
}
