import { describe, expect, it } from "vitest";
import {
  paragraphsFromSentences,
  paragraphsFromTimings,
  transcriptToProse,
  type TranscriptSegment,
} from "./transcript";

/** Builds a run of segments with an explicit silence before each one. */
function spoken(
  parts: { text: string; gapBefore?: number; length?: number }[],
): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  let clock = 0;
  for (const part of parts) {
    clock += part.gapBefore ?? 0;
    const start = clock;
    clock += part.length ?? 2;
    segments.push({ text: part.text, startSecond: start, endSecond: clock });
  }
  return segments;
}

describe("paragraphsFromTimings", () => {
  it("keeps sentences together across an ordinary breath", () => {
    const result = paragraphsFromTimings(
      spoken([
        { text: "She opened the door." },
        { text: "The hall was dark.", gapBefore: 0.3 },
      ]),
    );
    expect(result).toEqual(["She opened the door. The hall was dark."]);
  });

  it("breaks where the narrator pauses for longer", () => {
    const result = paragraphsFromTimings(
      spoken([
        { text: "She opened the door." },
        { text: "The hall was dark.", gapBefore: 0.3 },
        { text: "Morning came late.", gapBefore: 2 },
      ]),
    );
    expect(result).toEqual([
      "She opened the door. The hall was dark.",
      "Morning came late.",
    ]);
  });

  it("does not open with an empty paragraph when the recording starts late", () => {
    const result = paragraphsFromTimings(
      spoken([{ text: "Chapter One.", gapBefore: 8 }]),
    );
    expect(result).toEqual(["Chapter One."]);
  });

  it("drops a wordless segment without leaving an empty paragraph", () => {
    const result = paragraphsFromTimings(
      spoken([
        { text: "One." },
        // Brief, so the run through it stays under the paragraph threshold.
        { text: "   ", gapBefore: 0.2, length: 0.1 },
        { text: "Two.", gapBefore: 0.2 },
      ]),
    );
    expect(result).toEqual(["One. Two."]);
  });

  it("still breaks when the wordless stretch is a real pause", () => {
    // A segment carrying no words is silence, and long silence ends a
    // paragraph — the span counts even though the text is dropped.
    const result = paragraphsFromTimings(
      spoken([
        { text: "One." },
        { text: "   ", gapBefore: 0.2, length: 2 },
        { text: "Two.", gapBefore: 0.2 },
      ]),
    );
    expect(result).toEqual(["One.", "Two."]);
  });
});

describe("paragraphsFromSentences", () => {
  it("groups sentences into paragraphs", () => {
    const text = "A. B. C. D. E. F.";
    expect(paragraphsFromSentences(text)).toEqual(["A. B. C. D.", "E. F."]);
  });

  it("keeps terminal punctuation with the sentence it ends", () => {
    const [first] = paragraphsFromSentences("Who is there? Nobody answered.");
    expect(first).toBe("Who is there? Nobody answered.");
  });

  it("collapses the runs of whitespace a transcript arrives with", () => {
    expect(paragraphsFromSentences("One.\n\n   Two.")).toEqual(["One. Two."]);
  });
});

describe("transcriptToProse", () => {
  it("separates paragraphs with a blank line, which is what parseText reads", () => {
    const prose = transcriptToProse(
      "",
      spoken([{ text: "One." }, { text: "Two.", gapBefore: 3 }]),
    );
    expect(prose).toBe("One.\n\nTwo.");
  });

  it("falls back to sentences when the model returned no timings", () => {
    expect(transcriptToProse("A. B. C. D. E.")).toBe("A. B. C. D.\n\nE.");
  });

  it("falls back when there is only one segment to go on", () => {
    const prose = transcriptToProse(
      "A. B. C. D. E.",
      spoken([{ text: "A. B. C. D. E." }]),
    );
    expect(prose).toBe("A. B. C. D.\n\nE.");
  });
});
