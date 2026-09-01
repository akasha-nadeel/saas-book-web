/**
 * A word-level diff, so a writer can see what a change would do before it does
 * it.
 *
 * **Why this exists at all.** The assistant can now put a passage into the
 * manuscript, and a replacement destroys words. A card saying "replace this
 * paragraph?" asks somebody to approve a change they have not been shown; the
 * diff *is* the approval, which is the whole reason the review step is there.
 *
 * **Words rather than characters.** A character diff of two drafts of the same
 * sentence is a hedge of one-letter fragments nobody can read. Prose is edited
 * a word at a time, so that is the unit — and it is the unit every tool a
 * writer has seen this in uses.
 *
 * **Pure, and tested, and it never touches the document.** It describes a
 * change; `assistant-write.ts` makes one. Keeping the two apart is what lets
 * the description be checked without a ProseMirror instance.
 */

export interface DiffPart {
  text: string;
  /** `same` survives; `out` is the writer's words going; `in` is what arrives. */
  kind: "same" | "in" | "out";
}

/**
 * Above this many tokens a side, the diff is not attempted.
 *
 * The table below is O(n×m), so two thousand words against two thousand is
 * four million cells to build a picture nobody could read anyway. Past the cap
 * the honest answer is "all of this, for all of that", which is exactly what a
 * whole-passage replacement is — and it is one press either way.
 *
 * The common prefix and suffix come off before this is measured, so the cap
 * bites on how much genuinely *changed* rather than on how long the passage
 * is. A tightened paragraph inside a long selection stays a real diff.
 */
const MAX_TOKENS = 1_200;

/**
 * Words and the gaps between them, in order, as separate tokens.
 *
 * Splitting on a captured group keeps the whitespace, so joining the tokens
 * back together reproduces the input exactly — which is what lets a rebuilt
 * "same" run be printed verbatim rather than re-spaced.
 */
function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((token) => token !== "");
}

/** Adjacent parts of one kind, joined — a run per colour, not a token per colour. */
function merge(parts: DiffPart[]): DiffPart[] {
  const merged: DiffPart[] = [];
  for (const part of parts) {
    if (part.text === "") continue;
    const last = merged[merged.length - 1];
    if (last && last.kind === part.kind) last.text += part.text;
    else merged.push({ ...part });
  }
  return merged;
}

/**
 * The longest common subsequence of two token lists, as a diff.
 *
 * The classic table. Only reached with the matching ends already stripped, and
 * only under `MAX_TOKENS`.
 */
function lcsDiff(before: string[], after: string[]): DiffPart[] {
  const n = before.length;
  const m = after.length;

  /* One flat array rather than an array of arrays: the whole table is at most
     MAX_TOKENS², and a single allocation is cheaper than n+1 of them. */
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);

  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        before[i] === after[j]
          ? table[(i + 1) * width + j + 1] + 1
          : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
    }
  }

  const parts: DiffPart[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      parts.push({ text: before[i], kind: "same" });
      i++;
      j++;
    } else if (table[(i + 1) * width + j] >= table[i * width + j + 1]) {
      parts.push({ text: before[i], kind: "out" });
      i++;
    } else {
      parts.push({ text: after[j], kind: "in" });
      j++;
    }
  }
  while (i < n) parts.push({ text: before[i++], kind: "out" });
  while (j < m) parts.push({ text: after[j++], kind: "in" });

  return parts;
}

/**
 * What changes on the way from `before` to `after`.
 *
 * Identical inputs give one `same` part rather than an empty list, so a caller
 * printing the result always prints the passage.
 */
export function diffWords(before: string, after: string): DiffPart[] {
  if (before === after) {
    return before === "" ? [] : [{ text: before, kind: "same" }];
  }

  const beforeTokens = tokenize(before);
  const afterTokens = tokenize(after);

  /* **The matching ends come off first, and that is not only an optimisation.**
     Most real edits change the middle of a passage, so this is what keeps the
     table small enough to build — and it is why the cap below measures the
     changed part rather than the whole selection. */
  let head = 0;
  const shortest = Math.min(beforeTokens.length, afterTokens.length);
  while (head < shortest && beforeTokens[head] === afterTokens[head]) head++;

  let tail = 0;
  while (
    tail < shortest - head &&
    beforeTokens[beforeTokens.length - 1 - tail] ===
      afterTokens[afterTokens.length - 1 - tail]
  ) {
    tail++;
  }

  const prefix = beforeTokens.slice(0, head).join("");
  const suffix = beforeTokens.slice(beforeTokens.length - tail).join("");
  const beforeMiddle = beforeTokens.slice(head, beforeTokens.length - tail);
  const afterMiddle = afterTokens.slice(head, afterTokens.length - tail);

  const middle =
    beforeMiddle.length > MAX_TOKENS || afterMiddle.length > MAX_TOKENS
      ? /* Too much moved to draw. Say so as one swap rather than as a table
           that would take a second to build and a minute to read. */
        [
          { text: beforeMiddle.join(""), kind: "out" as const },
          { text: afterMiddle.join(""), kind: "in" as const },
        ]
      : lcsDiff(beforeMiddle, afterMiddle);

  return merge([
    { text: prefix, kind: "same" },
    ...middle,
    { text: suffix, kind: "same" },
  ]);
}

/** How much of the passage the change actually touches, for a one-line summary. */
export function diffCounts(parts: DiffPart[]): { added: number; removed: number } {
  const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
  let added = 0;
  let removed = 0;
  for (const part of parts) {
    if (part.kind === "in") added += words(part.text);
    if (part.kind === "out") removed += words(part.text);
  }
  return { added, removed };
}
