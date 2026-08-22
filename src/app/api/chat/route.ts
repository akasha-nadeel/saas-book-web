import {
  ModelError,
  modelProvider,
  streamModel,
  type ChatMessage,
} from "@/lib/ai";
import { claimAssistantReplyAllowance } from "@/lib/billing/launch-entitlements";

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
  let body: { messages?: ChatMessage[]; chapter?: string };
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

  const allowance = await claimAssistantReplyAllowance();
  if (!allowance.ok) return allowance.response;

  // The chapter is `context` rather than part of the conversation so it stays
  // put as the prefix while the exchange grows, which is what lets it be cached
  // across turns. See `StreamAsk` for what each provider does with it.
  const chapter = (body.chapter ?? "").slice(0, MAX_CHAPTER_CHARS);
  const context = chapter
    ? `The chapter as it currently stands:\n\n${chapter}`
    : "The chapter is currently empty.";

  /* Aborts the provider when the writer closes the panel or asks something
     else — the stream's `cancel` fires this. */
  const abort = new AbortController();

  const pieces = streamModel({
    system: SYSTEM,
    context,
    messages,
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
