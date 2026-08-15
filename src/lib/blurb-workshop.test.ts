import { describe, expect, it } from "vitest";
import { BLURB_MAX } from "@/lib/publishing";
import {
  buildWorkshopPrompt,
  extractDraft,
  MAX_WORKSHOP_OPENING,
  replyWithoutDraft,
  shortDraftNote,
  TARGET_WORDS,
  wordCount,
  WORKSHOP_SYSTEM,
  type WorkshopMessage,
} from "./blurb-workshop";

const SAID: WorkshopMessage[] = [
  { role: "user", content: "It is about a retired schoolteacher." },
  { role: "assistant", content: "What does she want?" },
  { role: "user", content: "To be believed." },
];

describe("what the model is told", () => {
  /*
   * **The two rules the whole feature rests on.** Everything else here is
   * craft advice; these two are what make a blurb written with a model
   * defensible at all, and a prompt edit that dropped either would look
   * harmless in review.
   */
  it("forbids inventing anything the writer did not say", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/NEVER state a fact/i);
    expect(WORKSHOP_SYSTEM).toMatch(/ask for it/i);
  });

  it("forbids the ending, which is what reading the book would leak", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/NEVER reveal or hint at the ending/i);
  });

  it("asks before it drafts", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/if you do not yet know enough, ASK/i);
  });

  it("keeps a draft inside the shops' limit", () => {
    expect(WORKSHOP_SYSTEM).toContain(String(BLURB_MAX));
  });

  /* It writes the description; the manuscript is not its business. */
  it("says outright that it does not write the book", () => {
    expect(WORKSHOP_SYSTEM).toMatch(/never the book/i);
  });
});

describe("what is sent", () => {
  it("carries the conversation, the title and the genre", () => {
    const prompt = buildWorkshopPrompt({
      messages: SAID,
      title: "The Salt Road",
      genre: "Mystery",
    });

    expect(prompt).toContain("The Salt Road");
    expect(prompt).toContain("Mystery");
    expect(prompt).toContain("retired schoolteacher");
    expect(prompt).toContain("To be believed.");
    // Both sides are labelled, or the model cannot tell who said what.
    expect(prompt).toContain("Writer:");
    expect(prompt).toContain("You:");
  });

  it("says plainly when the box is empty, and carries a draft when it is not", () => {
    expect(buildWorkshopPrompt({ messages: SAID })).toContain(
      "The blurb box is empty",
    );
    expect(
      buildWorkshopPrompt({ messages: SAID, draft: "A body on the causeway." }),
    ).toContain("A body on the causeway.");
  });

  /*
   * The cap is the feature, not a performance tweak: everything past the
   * opening is where the ending lives. It is enforced here as well as on the
   * client, because a browser is not where a limit is kept.
   */
  it("cuts the manuscript to the opening", () => {
    const prompt = buildWorkshopPrompt({
      messages: SAID,
      opening: "word ".repeat(20000),
    });
    expect(prompt.length).toBeLessThan(MAX_WORKSHOP_OPENING + 3000);
  });

  it("tells the model the opening is not the whole book", () => {
    const prompt = buildWorkshopPrompt({
      messages: SAID,
      opening: "The tide came in twice a day, and twice a day the road went under.",
    });
    expect(prompt).toMatch(/not the whole book/i);
    expect(prompt).toContain("the road went under");
  });

  it("says nothing about a manuscript when none was given", () => {
    const prompt = buildWorkshopPrompt({ messages: SAID });
    expect(prompt).not.toMatch(/opening of the manuscript/i);
  });
});

describe("finding the draft in a reply", () => {
  it("takes what is inside the tags", () => {
    expect(
      extractDraft("Here is a go:\n<blurb>A body washes up.</blurb>\nWant it shorter?"),
    ).toBe("A body washes up.");
  });

  /*
   * The reason the tag exists. A question and a draft are both prose, and
   * every heuristic for telling them apart is wrong somewhere — so a turn
   * with no tag offers no button rather than guessing.
   */
  it("finds nothing in a turn that is a question", () => {
    expect(extractDraft("What does she stand to lose if she fails?")).toBeNull();
  });

  it("survives a code fence inside the tags", () => {
    expect(extractDraft("<blurb>```\nA body washes up.\n```</blurb>")).toBe(
      "A body washes up.",
    );
  });

  it("takes the first of two rather than gluing them together", () => {
    expect(extractDraft("<blurb>First.</blurb> or <blurb>Second.</blurb>")).toBe(
      "First.",
    );
  });

  it("finds nothing when the tag was never closed", () => {
    expect(extractDraft("<blurb>A body washes up.")).toBeNull();
  });

  it("finds nothing in empty tags", () => {
    expect(extractDraft("<blurb>   </blurb>")).toBeNull();
  });

  /*
   * **Refused, not truncated.** A blurb cut at the limit ends mid-sentence,
   * and the writer would be offered words nobody wrote as a finished draft.
   */
  it("refuses a draft past the shops' limit rather than cutting it", () => {
    expect(extractDraft(`<blurb>${"a".repeat(BLURB_MAX + 1)}</blurb>`)).toBeNull();
  });

  it("answers nothing for junk rather than throwing", () => {
    for (const junk of ["", "I cannot help with that.", "<blurb", "</blurb>"]) {
      expect(extractDraft(junk)).toBeNull();
    }
  });
});

describe("the bubble the reader sees", () => {
  it("drops the draft, which is shown separately", () => {
    expect(
      replyWithoutDraft("Here is a go:\n<blurb>A body washes up.</blurb>\nShorter?"),
    ).toBe("Here is a go:\n\nShorter?");
  });

  /* An unclosed tag would otherwise leave raw markup in the bubble. */
  it("strips a stray tag rather than showing markup", () => {
    expect(replyWithoutDraft("A body washes up.</blurb>")).toBe(
      "A body washes up.",
    );
  });

  it("leaves an ordinary question alone", () => {
    expect(replyWithoutDraft("What does she want?")).toBe("What does she want?");
  });
});

describe("shortDraftNote", () => {
  const say = (words: number) => "word ".repeat(words).trim();

  /*
   * The case from the screenshot that prompted this: three short facts in, a
   * 34-word blurb out, and nothing on screen explaining why. A writer
   * reasonably reads that as the feature being broken.
   */
  it("explains a draft that came out well under the target", () => {
    const note = shortDraftNote(say(34));
    expect(note).toContain("34 words");
    expect(note).toContain(String(TARGET_WORDS));
  });

  /*
   * **It points at what the writer said, never at the manuscript**, and that is
   * the finding rather than a preference. Measured: the same model, with no
   * manuscript either way, gave nothing usable from three short facts and 118
   * words from one detailed answer. A note blaming empty chapters would send
   * somebody off to write prose when the fix is another sentence in the box.
   */
  it("does not blame the manuscript", () => {
    const note = shortDraftNote(say(30))!;
    expect(note).not.toMatch(/manuscript|chapter|write your book/i);
  });

  /* A fact and a next step. Never a verdict on the writing. */
  it("passes no judgement on the blurb", () => {
    const note = shortDraftNote(say(30))!;
    expect(note).not.toMatch(/\b(bad|poor|weak|too short|improve|better)\b/i);
  });

  it("says nothing about a full-length draft", () => {
    expect(shortDraftNote(say(TARGET_WORDS))).toBeNull();
    expect(shortDraftNote(say(TARGET_WORDS * 2))).toBeNull();
  });

  /*
   * A good short blurb is a good blurb. The threshold is loose so the note is
   * rare — one that fires on every draft is furniture nobody reads.
   */
  it("leaves a respectable short draft alone", () => {
    expect(shortDraftNote(say(120))).toBeNull();
    expect(shortDraftNote(say(100))).toBeNull();
  });

  it("has nothing to say about an empty draft", () => {
    expect(shortDraftNote("")).toBeNull();
    expect(shortDraftNote("   ")).toBeNull();
  });
});

describe("wordCount", () => {
  it("counts words rather than spaces", () => {
    expect(wordCount("one two three")).toBe(3);
    expect(wordCount("  padded   out  ")).toBe(2);
    expect(wordCount("line\nbreak")).toBe(2);
    expect(wordCount("")).toBe(0);
  });
});

describe("the target is stated once", () => {
  /*
   * The prompt used to carry "around 150 words" as prose, with the screen
   * saying nothing. Now both read `TARGET_WORDS`, so the figure a writer is
   * shown is the figure the model was actually asked for.
   */
  it("is the figure the prompt asks for", () => {
    expect(WORKSHOP_SYSTEM).toContain(`around ${TARGET_WORDS} words`);
  });
});

describe("the note claims nothing it cannot back", () => {
  /*
   * **It says what this tool aims for, never what books average**, and that
   * wording was arrived at the hard way — see the note on `TARGET_WORDS`.
   * "Most blurbs run about 150" was checked and could not be backed: named
   * bestsellers carry 236–304 words, while Google Books' description field
   * across 416 records has a median of 57. The second is a fact about
   * catalogue metadata rather than about blurbs, so neither number can be
   * printed as though it described the world.
   */
  it("does not claim to know what published blurbs average", () => {
    const note = shortDraftNote("word ".repeat(30))!;
    expect(note).not.toMatch(/most blurbs|average|typical(ly)?|published books/i);
    expect(note).toContain(`aims for about ${TARGET_WORDS}`);
  });
});
