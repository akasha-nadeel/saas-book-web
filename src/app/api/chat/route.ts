import {
  ModelError,
  asChatModel,
  modelProvider,
  streamModel,
  type ChatMessage,
} from "@/lib/ai";
import { claimAssistantReplyAllowance } from "@/lib/billing/launch-entitlements";
import { requireTier } from "@/lib/billing/server";
import { TIER_NAMES, assistantWriteAllowed } from "@/lib/billing/tiers";

/**
 * The assistant behind the editor's right-hand panel.
 *
 * This is the only part of OpenChapter that talks to a server. Everything else
 * is local, and the chapter text sent here is sent only when the writer opens
 * the panel and asks something.
 *
 * **It runs on whichever provider is configured, as of 2026-08-15.** It was
 * Anthropic-only and answered 501 with "No ANTHROPIC_API_KEY is set" to anybody
 * without one — including a deployment with a Google key where every other
 * model route worked. The provider choice is `ai.ts`'s, the same one the six
 * comps and blurb routes make, so an installation has one answer to "is there a
 * model" rather than two.
 *
 * The streaming itself moved into `ai.ts` with it, which is where that file
 * always said it would go if it were needed for both providers.
 */

export const maxDuration = 300;

const MAX_CHAPTER_CHARS = 60_000;
const MAX_MESSAGES = 20;
const MAX_MESSAGE_CHARS = 4_000;
const MAX_OUTPUT_TOKENS = 2_000;
/**
 * The highlighted passage, capped separately from the chapter.
 *
 * Its own cap because it is its own field on the way out and its own line on
 * `/privacy`: a writer who selects half a chapter and asks for a rewrite would
 * otherwise be sending that half twice, and the point of the field is to say
 * *which part* rather than to send the part again.
 */
const MAX_SELECTION_CHARS = 8_000;

const SYSTEM = `You are a writing assistant inside a novel-drafting app, helping
with the chapter the writer currently has open.

Answer about their prose: continuations, alternatives, tightening, continuity
problems, whether a scene is landing. When they ask for prose, write in their
voice as it appears in the chapter — do not impose your own style, and do not
smooth away deliberate roughness.

Be concise. Lead with the thing they asked for rather than a preamble about
what you are about to do. If you have a reservation about a suggestion, say it
in a sentence; do not survey every option.

You cannot edit the document. Offer text for the writer to use, and say so
plainly if a request needs something you cannot see.`;

/**
 * The same assistant, for a writer who has turned write mode on.
 *
 * **Only the closing paragraph differs, and deliberately so.** Everything above
 * it is what makes the answers good — the voice rule, the brevity, the single
 * reservation — and a second prompt that drifted from the first would be two
 * assistants under one name. What changes is the shape offered prose has to
 * arrive in, because a blockquote is the thing the panel can put a control on:
 * `isOffered` in `markdown.ts` is the whole of the protocol, and it recognises
 * exactly two kinds of block.
 *
 * **It still does not say the model can edit anything**, because it cannot. It
 * writes a passage and the writer presses Apply. Telling it otherwise would
 * invite answers written as though the change had already been made.
 */
const SYSTEM_WRITE = `${SYSTEM.slice(0, SYSTEM.lastIndexOf("\n\n"))}

You still cannot edit the document, but the writer can now apply what you offer
with one press. So put prose you are offering in a blockquote of its own, with
no commentary inside it, and keep the explanation outside the quote. Do not put
a passage in a quote unless it is meant to go into the book as it stands.

When the writer has selected a passage, offer a complete replacement for
exactly that passage — the whole of it, ready to stand in its place — rather
than notes on what to change. When they have not, offer the new prose on its
own. Say so plainly if a request needs something you cannot see.`;

export async function POST(request: Request) {
  /* The same check every model route makes, and the message names both keys
     rather than the one this route used to want — a reader with a Google key
     being told to go and get an Anthropic one is being sent to fix something
     that is not broken. */
  if (!modelProvider()) {
    return Response.json(
      {
        error:
          "No model is configured. Add ANTHROPIC_API_KEY or GOOGLE_GENERATIVE_AI_API_KEY to .env.local and restart the dev server.",
      },
      { status: 501 },
    );
  }

  // The proxy's sign-in wall skips /api on purpose — redirecting a fetch to an
  // HTML page yields a parse error, not a 401 — so this route checks for
  // itself. A billed endpoint left open is somebody else's bill, and the plan
  // check has to be here rather than in the panel for the same reason: a
  // control hidden in the browser is a control a reader can unhide.
  //
  // With no accounts or no payment gateway configured this passes everyone, so
  // a self-hosted copy running on its owner's key works as it always did.
  let body: {
    messages?: ChatMessage[];
    chapter?: string;
    selection?: string;
    write?: boolean;
    model?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Malformed request." }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (m) =>
        (m?.role === "user" || m?.role === "assistant") &&
        typeof m?.content === "string" &&
        m.content.trim(),
    )
    .slice(-MAX_MESSAGES)
    .map((m) => ({
      role: m.role,
      content: m.content.trim().slice(0, MAX_MESSAGE_CHARS),
    }));
  if (messages.length === 0) {
    return Response.json({ error: "No message to answer." }, { status: 400 });
  }

  /**
   * **Which of the two models to ask — narrowed here, and defaulted to the
   * cheap one.**
   *
   * This narrows; it does not authorise. Both models are on both plans that
   * have the assistant at all, so there is no per-plan allowlist to check —
   * what differs is the *allowance*, and Postgres claims that a few lines
   * below.
   *
   * **The default matters more than the narrowing does.** A body that names
   * nothing, or names rubbish, gets Quick: the daily meter, the cheap model.
   * Defaulting the other way would let a malformed request spend a reply out of
   * the scarce monthly allowance, which is the one mistake here that costs a
   * writer something they would notice.
   */
  const model = asChatModel(body.model) ?? "quick";

  /**
   * **The plan gate, and it is the broadest refusal here so it goes first.**
   *
   * The assistant is what Writer and Studio buy. Free and Draft carry the whole
   * of the rest of OpenChapter — every import, sync, all three export formats,
   * unlimited words, the title and consistency checks — and no assistant at
   * all, so a request from one of those plans is refused entirely rather than
   * being asked the narrower question about write mode.
   *
   * **Before the allowance is claimed**, which is the rule the write gate
   * already followed: a refusal must cost nobody a reply out of their day or
   * their month.
   *
   * It answers with the *tier* rather than a boolean because the two questions
   * below need it — whether the assistant may write into the chapter, and which
   * allowance to spend — and one subscription read is better than three.
   *
   * The message names the plan rather than the paywall, and reads the name out
   * of `TIER_NAMES` so it cannot drift from the card.
   */
  const gate = await requireTier("writer", {
    signIn: "Sign in to use the writing assistant.",
    upgrade: `The writing assistant is part of ${TIER_NAMES.writer} and ${TIER_NAMES.studio}. ${TIER_NAMES.draft} carries unlimited books, every export format and unlimited title checks.`,
  });
  if (!gate.ok) return gate.response;

  /**
   * **Write mode is a second question, asked of the same answer.**
   *
   * Folded into the tier above rather than a second `requirePro` — that was a
   * second subscription read for a question the first one could already answer.
   * It stays stated separately from the chat rule so that a future plan with
   * the assistant but not the writing already has its shape here.
   *
   * The switch in the panel is locked where this would refuse, so a real writer
   * never reaches it; this is the backstop for a request that did not come from
   * the panel.
   */
  const write = body.write === true;
  if (write && !assistantWriteAllowed(gate.tier)) {
    return Response.json(
      {
        error: `Letting the assistant write into your chapter is part of ${TIER_NAMES.writer} and ${TIER_NAMES.studio}. It can still read the chapter and offer you text.`,
        upgrade: true,
      },
      { status: 402 },
    );
  }

  const allowance = await claimAssistantReplyAllowance(model);
  if (!allowance.ok) return allowance.response;

  // The chapter is `context` rather than part of the conversation so it stays
  // put as the prefix while the exchange grows, which is what lets it be cached
  // across turns. See `StreamAsk` for what each provider does with it.
  const chapter = (body.chapter ?? "").slice(0, MAX_CHAPTER_CHARS);
  const chapterContext = chapter
    ? `The chapter as it currently stands:\n\n${chapter}`
    : "The chapter is currently empty.";

  /* Sent in write mode only, because it is only asked for there: it names
     the range an offered replacement would land on. In suggest mode there is
     nothing for a replacement to land on, so it does not leave the browser
     at all. Named on /privacy beside the chapter. */
  const selection = write
    ? (body.selection ?? "").slice(0, MAX_SELECTION_CHARS).trim()
    : "";
  const context = selection
    ? `${chapterContext}\n\nThe writer has selected this passage, and a replacement you offer will be put in its place:\n\n${selection}`
    : chapterContext;

  /* Aborts the provider when the writer closes the panel or asks something
     else — the stream's `cancel` fires this. */
  const abort = new AbortController();

  const pieces = streamModel({
    system: write ? SYSTEM_WRITE : SYSTEM,
    context,
    messages,
    model,
    maxTokens: MAX_OUTPUT_TOKENS,
    signal: abort.signal,
  })[Symbol.asyncIterator]();

  /**
   * The first piece is pulled *before* the response is returned, and that is
   * what keeps a rejected key a 401 rather than a 200 with an apology in it.
   *
   * Everything that can fail cleanly fails here: the request is sent, the
   * provider answers, and only then does any of it become a stream. Once the
   * first byte has gone out the status is spent — a failure after that can only
   * be a note in the prose, which is what the `catch` below writes. So the two
   * paths are not redundant; they are the two halves of the same failure, told
   * apart by whether the writer has seen anything yet.
   */
  let first: IteratorResult<string>;
  try {
    first = await pieces.next();
  } catch (err) {
    await allowance.refund();
    if (err instanceof ModelError) {
      const status =
        err.kind === "auth" ? 401 : err.kind === "rate" ? 429 : 502;
      return Response.json({ error: err.message }, { status });
    }
    console.error("[chat] request failed", err);
    return Response.json(
      { error: "The assistant is unavailable." },
      { status: 502 },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        if (!first.done) controller.enqueue(encoder.encode(first.value));
        for (;;) {
          const next = await pieces.next();
          if (next.done) break;
          controller.enqueue(encoder.encode(next.value));
        }
      } catch (err) {
        /* **The reply has already started, so this cannot become a status
           code.** The headers went out with the first chunk. A note in the
           stream is the only way left to tell the writer the answer stopped
           early rather than simply ending — which, in a panel that writes
           prose, is otherwise indistinguishable from the model finishing. */
        if ((err as Error)?.name !== "AbortError") {
          console.error("[chat] stream failed", err);
          controller.enqueue(
            encoder.encode("\n\n[The reply was cut short by an error.]"),
          );
        }
      } finally {
        controller.close();
      }
    },
    cancel() {
      // The writer closed the panel or asked something else. Stop paying for
      // tokens nobody will read. `return()` runs the generator's own `finally`,
      // which releases Gemini's reader; the signal is what reaches Anthropic.
      abort.abort();
      pieces.return?.(undefined).catch(() => {});
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      ...(allowance.usage.remaining !== null
        ? { "X-OpenChapter-AI-Remaining": String(allowance.usage.remaining) }
        : {}),
    },
  });
}
