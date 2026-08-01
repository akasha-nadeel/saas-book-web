/**
 * What a writer wants to tell us, and what leaves the machine when they do.
 *
 * A private channel, not a forum: feedback goes to whoever runs the app and is
 * never shown to another writer. That is enforced in the database rather than
 * here — see the migration, where `authenticated` gets an insert grant and no
 * select at all, so a signed-in reader with devtools cannot read anybody's
 * notes including their own.
 *
 * **What is sent is the hard part.** This product's whole argument is that the
 * manuscript stays in the browser, so a form that quietly posted "some context
 * to help us debug" would undo the claim the rest of the app is built on.
 * Nothing here reads a book, a chapter, a title or a word count. What goes is
 * the message typed into the box, the topic picked from a fixed list, one of
 * four faces, and the writer's own account id — which the server knows already,
 * because they are signed in to send at all. The dialog lists exactly that,
 * above the send button.
 *
 * The topic is one value from the list below and **never a URL**: a URL in this
 * app carries book and chapter ids, which is precisely the thing that must not
 * travel.
 */

export type Sentiment = "bad" | "poor" | "fine" | "good";

/**
 * Four faces, the shape every feedback widget uses.
 *
 * Four rather than five, and no middle. An odd-numbered scale collects a pile
 * of neutral answers that mean "I did not want to think about it", which tells
 * whoever reads them nothing. Four makes the writer lean one way, and both
 * leaning-ways are useful.
 */
export const SENTIMENTS: { id: Sentiment; face: string; label: string }[] = [
  { id: "bad", face: "😞", label: "Bad" },
  { id: "poor", face: "🙁", label: "Not great" },
  { id: "fine", face: "🙂", label: "Fine" },
  { id: "good", face: "😄", label: "Great" },
];

/**
 * What it is about.
 *
 * The dashboard's own areas plus the screens that are not areas, because a note
 * saying "this is broken" is three messages from being actionable without one.
 * Ids are stable strings; renaming a label is free, renaming an id orphans
 * every row already collected under it.
 */
export const TOPICS: { id: string; label: string }[] = [
  { id: "editor", label: "Writing and the editor" },
  { id: "export", label: "Export and publishing" },
  { id: "tools", label: "The per-book tools" },
  { id: "dashboard", label: "The dashboard" },
  { id: "account", label: "Account, plans and billing" },
  { id: "other", label: "Something else" },
];

/**
 * The most we will send.
 *
 * Generous — a writer describing a bug properly needs room, and a limit that
 * cuts them off mid-sentence produces a report nobody can act on. It exists to
 * stop a paste of a whole chapter, which is the one thing that must not go.
 */
export const MESSAGE_MAX = 4000;

/**
 * The least worth sending.
 *
 * Not one character. "no" or "bad" arrives with nothing to act on, and the
 * writer who sent it believes they have been heard.
 */
export const MESSAGE_MIN = 10;

export interface Draft {
  topic: string;
  message: string;
  /** Absent until a face is pressed — it is optional, not defaulted. */
  sentiment?: Sentiment;
}

/**
 * Whether it can be sent, and what to say if not.
 *
 * One string or null rather than a list: this form has one field that can be
 * wrong, and a validation framework around a textarea is more machinery than
 * the problem has.
 */
export function checkDraft(draft: Draft): string | null {
  const message = draft.message.trim();

  if (message.length === 0) return "There is nothing to send yet.";
  if (message.length < MESSAGE_MIN) {
    return "A few more words — we cannot act on this one.";
  }
  if (message.length > MESSAGE_MAX) {
    return `That is ${message.length.toLocaleString()} characters, and the most we can send is ${MESSAGE_MAX.toLocaleString()}.`;
  }
  if (!TOPICS.some((t) => t.id === draft.topic)) {
    return "Pick what this is about.";
  }
  return null;
}

/**
 * The row that goes to the server.
 *
 * Built here rather than inline beside a submit handler, so what leaves the
 * machine is one readable object in a tested file. No sentiment is null rather
 * than a default, because "did not answer" and "said it was fine" are different
 * things and averaging them together would be inventing a number — the same
 * rule the rest of this app is held to.
 */
export function toRow(draft: Draft): {
  topic: string;
  message: string;
  sentiment: Sentiment | null;
} {
  return {
    topic: draft.topic,
    message: draft.message.trim(),
    sentiment: draft.sentiment ?? null,
  };
}
