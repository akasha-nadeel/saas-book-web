import { hiddenLaunchApiResponse, launchFeatureEnabled } from "@/lib/launch-server";
import { NextResponse } from "next/server";
import { parseSubjectIndex, rankHeadings } from "@/lib/comps/subjects";

/**
 * Open Library's subject index, for typing into.
 *
 * The categories screen lets a writer type their own, and a bare text box is
 * a poor way to ask for a category: they do not know the vocabulary, and the
 * one they invent is one no shop files anything under. This is the same
 * catalogue the rest of the tool reads, queried as they type — so the
 * suggestions are real shelves with real sizes rather than a taxonomy we made
 * up.
 *
 * **Which is the whole reason it is not a hard-coded list.** BISAC is owned by
 * BISG and licensed, and inventing our own list of "all book categories" would
 * be the same failure the categories screen was built to avoid. Nobody here
 * knows what the categories are; the catalogue does.
 *
 * **Free, keyless, and it stays that way**, like `/api/comps`. It is a lookup
 * rather than a judgement, and a writer should not have to pay to find out
 * what a shelf is called. Server-side for the shared cache and so a reader's
 * browser is not handed to a third party on every keystroke.
 */

/** A subject index moves even more slowly than the books in it. */
const CACHE_SECONDS = 60 * 60 * 24 * 7;

/** Enough to choose from, few enough to read without scrolling a dropdown. */
const LIMIT = 8;

export async function GET(request: Request) {
  if (!launchFeatureEnabled()) return hiddenLaunchApiResponse("Subject search");
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";

  /*
   * One letter is not a request this index can answer, and both ways of
   * asking fail differently — measured, not assumed.
   *
   * With the wildcard, `m*` is an **HTTP 500**: a single-letter prefix matches
   * so many terms that Open Library's own server gives up. Without it, plain
   * `m` returns 200 and 18,367 hits of which the largest are "Nixon, richard
   * m.", "Turner, j. m. w." and a Moscow university — because one letter
   * matches middle initials and abbreviations rather than the start of a
   * category name.
   *
   * So nothing is fetched below two characters. The screen fills that gap from
   * the app's own genre list instead, which needs no request at all.
   */
  if (query.length < 2) return NextResponse.json({ subjects: [] });
  if (query.length > 60) {
    return NextResponse.json({ subjects: [] });
  }

  try {
    const response = await fetch(
      `https://openlibrary.org/search/subjects.json?q=${encodeURIComponent(
        prefix(query),
      )}&limit=${LIMIT * 3}`,
      {
        headers: {
          // Open Library's documentation is explicit that anonymous bulk
          // traffic gets blocked. The same identifier `/api/comps` sends.
          "User-Agent": "OpenChapter (comparable-titles; contact via openchapter)",
          Accept: "application/json",
        },
        // Shorter than the comps search: this fires while somebody is typing,
        // and a suggestion that arrives after they have finished is noise.
        signal: AbortSignal.timeout(4000),
        next: { revalidate: CACHE_SECONDS },
      },
    );

    if (!response.ok) return NextResponse.json({ subjects: [] });

    // Over-fetched above for two reasons: the parser drops people, places and
    // administrative headings, and the ranking below reorders what survives —
    // so the eight shown are chosen after both, not before.
    //
    // Ranked against what was typed rather than by shelf size alone. Somebody
    // typing "thri" means Thriller, not whichever thriller shelf is biggest.
    const subjects = rankHeadings(
      parseSubjectIndex(await response.json()),
      query,
    ).slice(0, LIMIT);

    return NextResponse.json(
      { subjects },
      {
        headers: {
          "Cache-Control": `public, max-age=0, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      },
    );
  } catch {
    // A dropdown that cannot suggest is a text box, which is what this screen
    // had before and still works. Never an error on a keystroke.
    return NextResponse.json({ subjects: [] });
  }
}

/**
 * Turn what somebody has typed so far into a query the index answers well.
 *
 * **Two things are wrong with sending the raw text, and they pull opposite
 * ways.** The index is not a prefix search, so `myst` answers with *Myst*, the
 * computer game, 14 works — and not one mystery shelf. Somebody typing into a
 * box has by definition not finished the word, so the dropdown would be at its
 * worst exactly when it is most needed.
 *
 * But a bare wildcard is worse. Solr does not run its analyser over a wildcard
 * term and this index is stemmed, so `cozy*` looks for a literal "cozy" among
 * terms stored as "cozi" and matches **nothing at all** — where plain `cozy`
 * matches 26. A prefix search alone would have silently broken every word
 * whose stem is spelt differently, which is most of the interesting ones.
 *
 * So both forms go, joined by OR: the plain word for the stemmer, the wildcard
 * for the half-typed one.
 *
 * The wildcard goes on the last word only — the earlier ones are finished, and
 * `small* town*` matches less than `small town*` does.
 *
 * Solr's own syntax is stripped first. A stray quote or colon in a half-typed
 * category is a parse error rather than a search, and the reply would be an
 * empty dropdown with nothing on screen to explain it.
 */
function prefix(query: string): string {
  const clean = query
    .replace(/[+\-!(){}[\]^"~*?:\\/]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!clean) return query;

  const words = clean.split(" ");
  const wild = [...words.slice(0, -1), `${words[words.length - 1]}*`].join(" ");
  return `${clean} OR ${wild}`;
}
