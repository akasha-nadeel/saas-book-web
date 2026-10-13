import { describe, expect, it } from "vitest";
import {
  NOTICE_FROM,
  NOTICE_UNLIMITED_BOOKS,
  seenFromMetadata,
  shouldShowNotice,
} from "./whats-new";

const DAY = 24 * 60 * 60 * 1000;
const before = NOTICE_FROM - 30 * DAY;
const after = NOTICE_FROM + DAY;

const base = {
  id: NOTICE_UNLIMITED_BOOKS,
  seen: [] as string[],
  accountCreatedAt: null as number | null,
  books: [] as { lastOpenedAt: number }[],
  from: NOTICE_FROM,
};

describe("shouldShowNotice", () => {
  it("shows an account made before the change, signed in all along", () => {
    expect(shouldShowNotice({ ...base, accountCreatedAt: before })).toBe(true);
  });

  it("never shows an account made after it — unlimited is just how the app is for them", () => {
    expect(
      shouldShowNotice({ ...base, accountCreatedAt: after, books: [{ lastOpenedAt: before }] }),
    ).toBe(false);
  });

  it("never shows twice, whichever machine answered it", () => {
    expect(
      shouldShowNotice({ ...base, accountCreatedAt: before, seen: [NOTICE_UNLIMITED_BOOKS] }),
    ).toBe(false);
  });

  it("judges a reader with no account by their own books", () => {
    expect(shouldShowNotice({ ...base, books: [{ lastOpenedAt: before }] })).toBe(true);
    expect(shouldShowNotice({ ...base, books: [{ lastOpenedAt: after }] })).toBe(false);
    expect(shouldShowNotice({ ...base, books: [] })).toBe(false);
  });

  it("ignores a book with no usable date", () => {
    expect(shouldShowNotice({ ...base, books: [{ lastOpenedAt: Number.NaN }, { lastOpenedAt: 0 }] })).toBe(
      false,
    );
  });
});

describe("seenFromMetadata", () => {
  it("reads the ids an account has answered, and nothing else", () => {
    expect(seenFromMetadata({ notices_seen: ["a", 2, "b"] })).toEqual(["a", "b"]);
    expect(seenFromMetadata({})).toEqual([]);
    expect(seenFromMetadata(null)).toEqual([]);
    expect(seenFromMetadata({ notices_seen: "a" })).toEqual([]);
  });
});
