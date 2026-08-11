import { openingFrom } from "@/lib/comps/rank";
import { BLURB_MAX } from "@/lib/publishing";

/**
 * A conversation about the blurb — questions first, a draft from the answers.
 *
 * **This is the one place in the app a model writes something a reader will
 * see**, and the shape is what makes that allowable. The public refusal is
 * *"We will not design your cover or edit your prose with AI"*: a blurb is
 * neither — it is marketing copy about the book rather than the book, which is
 * why the shops treat it as metadata and ask for no AI declaration. So no
 * promise is broken. What is refused instead is the thing every competitor
 * sells, and for two reasons that survive better prompting:
 *
 * - **A model that has read to the end writes a synopsis with the ending in
 *   it.** A blurb stops around the inciting incident. More manuscript makes
 *   the output worse at the job, not better — which is why only the opening
 *   goes, and why the cap is not a compromise to be raised later.
 * - **A blurb written from nothing is vague exactly where a blurb cannot
 *   afford to be.** Vagueness is what readers use to spot machine copy, and a
 *   blurb's whole job is to be more specific than the forty books beside it.
 *
 * So it interviews. Who is this about, what do they want, what is in the way,
 * what does failure cost — and the draft is assembled from the writer's own
 * answers. The odd, specific details are theirs; the model does the shaping.
 * `blurb-critique.ts` is the sibling that reads a finished blurb and reports;
 * this one is for the empty box, which is where writers say they are stuck.
 *
 * **What leaves: the conversation, the draft, the title, the genre, and the
 * opening of the manuscript.** That last one makes this the third route in the
 * app that sends prose, after the assistant and comps ranking, and it carries
 * the obligations that come with that — a line on `/privacy`, and a sentence
 * on the screen naming what goes *before* the press. Add a field here and add
 * it to both.
 */

/** One turn. The same shape `chat-panel.tsx` keeps for the assistant. */
export interface WorkshopMessage {
  role: "user" | "assistant";
  content: string;
}

export interface WorkshopInput {
  messages: readonly WorkshopMessage[];
  title?: string;
  genre?: string;
  /** What is in the blurb box now, if anything. */
  draft?: string;
  /** The opening of the manuscript, already cut. */
  opening?: string;
}

/**
 * How much of the manuscript goes.
 *
 * Deliberately shorter than `rank.ts`'s 6,000: ranking asks whether a book
 * *sounds* like another and wants as much voice as it can get, where this
 * needs only the setup a blurb covers. Every extra paragraph is one more
 * chance for something past the inciting incident to arrive, which is the
 * failure this whole feature is shaped around.
 */
export const MAX_WORKSHOP_OPENING = 4000;

/** Room for a few questions or one blurb, with thinking on top. */
export const MAX_TOKENS = 1200;

/** Below this there is nothing to work with; the screen says so too. */
export const MIN_TO_START = 2;

/**
 * The instructions.
 *
 * Two rules carry the design and both are stated as prohibitions, because the
 * failure they prevent is one a model reaches for naturally: **ask before
 * drafting**, and **never state a fact the writer did not give you**. The
 * third — stop at the inciting incident — is the blurb convention a writer is
 * actually hiring this for.
 */
export const WORKSHOP_SYSTEM = `You help a writer work out the blurb for their book — the description a shop shows under the cover. You are in a conversation with them.

How to work:
- If you do not yet know enough, ASK. One question at a time, in plain words. The four that matter are: who the story is about, what they want, what stands in their way, and what it costs them if they fail.
- Once the writer has given you enough, offer a draft. Put the draft on its own, wrapped in <blurb> and </blurb> tags, with nothing else inside those tags.
- After a draft, keep working with them: shorter, different opening, more tension — whatever they ask.
- If the writer pastes a draft of their own, work on that rather than starting again.

Hard rules:
- NEVER state a fact about this book that the writer has not told you or that is not in the opening you were given. No invented names, places, twists, or stakes. If you need something, ask for it.
- NEVER reveal or hint at the ending. A blurb stops around the moment the story properly begins. You may have been given the opening chapters; they are for voice and setup only.
- Keep a draft under ${BLURB_MAX} characters, and around 150 words unless asked otherwise.
- No praise for the book, no review language, no "a gripping tale of". Write the book's own specifics.
- You are writing the description, never the book. Do not offer to write chapters.

Talk like a person helping with a hard paragraph. Short replies. No headings, no bullet lists, no preamble.`;

/**
 * The conversation, flattened into one prompt.
 *
 * **A single string rather than a message array**, because `askModel` takes a
 * system prompt and one user message and is the only path that works on both
 * providers — and this route has to run on Gemini in development and Claude in
 * production without branching. The cost is that the history is re-sent
 * uncached each turn, which for a conversation of this length is a few pence.
 *
 * The opening goes at the *top*, before the exchange: it is the longest and
 * most stable part, so a provider that caches prefixes has the best chance of
 * holding it, and the model reads the book's own voice before it reads the
 * conversation about it.
 */
export function buildWorkshopPrompt(input: WorkshopInput): string {
  const parts: string[] = [];

  parts.push(input.title ? `Title: ${input.title}` : "No title set yet.");
  if (input.genre) parts.push(`Genre: ${input.genre}`);

  if (input.opening?.trim()) {
    parts.push(
      `The opening of the manuscript, for voice and setup only — it is not the whole book and you must not guess what happens later:\n\n${openingFrom(
        input.opening,
        MAX_WORKSHOP_OPENING,
      )}`,
    );
  }

  if (input.draft?.trim()) {
    parts.push(
      `The blurb as it currently stands:\n\n${input.draft.trim().slice(0, BLURB_MAX)}`,
    );
  } else {
    parts.push("The blurb box is empty.");
  }

  parts.push(
    "The conversation so far:\n\n" +
      input.messages
        .map(
          (m) =>
            `${m.role === "user" ? "Writer" : "You"}: ${m.content.trim()}`,
        )
        .join("\n\n"),
  );

  parts.push("Reply as yourself, continuing the conversation.");

  return parts.join("\n\n");
}

/**
 * The blurb a reply is offering, if it is offering one.
 *
 * **Tagged rather than guessed at.** An earlier shape asked the model for
 * prose and tried to work out which paragraph was the draft; every heuristic
 * for that is wrong somewhere — a long answer to "why does that opening not
 * work" looks exactly like a blurb. A tag the prompt asks for is a signal the
 * model either sends or does not, and a turn that is a question has none, so
 * the **Use this** button simply does not appear.
 *
 * Generated text is hostile input, so the tag is not trusted to be well
 * formed: unclosed, duplicated, fenced and over-long all have tests.
 */
export function extractDraft(reply: string): string | null {
  const match = reply.match(/<blurb>([\s\S]*?)<\/blurb>/i);
  if (!match) return null;

  const draft = match[1]
    .trim()
    // A model that wrapped its draft in a code fence as well.
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  if (!draft) return null;

  /*
   * **Refused, not truncated.** A blurb cut at 4,000 characters ends
   * mid-sentence, and the writer would be offered words nobody wrote as
   * though they were a finished draft. Losing the button costs one press;
   * offering a mangled paragraph costs the trust the screen runs on.
   */
  if (draft.length > BLURB_MAX) return null;

  return draft;
}

/**
 * The reply with the draft tags taken out, for showing in the chat.
 *
 * The draft is rendered as its own block with a button under it, so leaving
 * the raw tags in the bubble would show it twice — once as markup a reader has
 * to decode, once properly.
 */
export function replyWithoutDraft(reply: string): string {
  return reply
    .replace(/<blurb>[\s\S]*?<\/blurb>/gi, "")
    // An unclosed tag would otherwise leave the whole tail in the bubble.
    .replace(/<\/?blurb>/gi, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * What the chat opens with.
 *
 * **The interview's own first questions, not free-text prompts.** An empty
 * chat box teaches nothing; four questions teach the shape of the thing in one
 * glance, and a writer who presses one has already started. They are the four
 * a blurb is built from, in the order a blurb uses them.
 */
export const STARTERS = [
  "Who is the story about, and what do they want?",
  "What stands in their way?",
  "Help me shorten what I have.",
  "Give me a different opening line.",
] as const;
