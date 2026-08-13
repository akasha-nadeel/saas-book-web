import { describe, expect, it } from "vitest";
import { pushOwner, rank, worthRetrying } from "./sync";

/**
 * The two pure decisions in the push queue, and both of them were wrong.
 *
 * The rest of `sync.ts` is Supabase I/O and is not testable here. These are
 * the parts that decided what happened to a writer's prose when a push did not
 * land, and between them they cost a real library 268 chapter bodies: the
 * order sent a body before the chapter it hangs off, and the failure that
 * followed was logged and thrown away.
 */

describe("rank", () => {
  it("sends a book before its chapters and a chapter before its prose", () => {
    // `chapter_bodies` derives book_id and owner from the chapter row in a
    // trigger and raises foreign_key_violation when there is no chapter to
    // derive them from — so this order is the database's requirement, not a
    // preference.
    expect(rank("book:abc")).toBeLessThan(rank("chapter:abc"));
    expect(rank("chapter:abc")).toBeLessThan(rank("body:abc"));
  });

  it("puts a new chapter's prose behind its book, whatever order they queued in", () => {
    // The exact case that lost the words: `saveBody` writes the prose and
    // pushes it *before* the caller updates the word count that queues the
    // book, so a Map in insertion order hands the body over first.
    const queued = ["body:c1", "book:b1"];
    expect([...queued].sort((a, b) => rank(a) - rank(b))).toEqual([
      "book:b1",
      "body:c1",
    ]);
  });

  it("keeps notes and covers behind the chapter they belong to", () => {
    expect(rank("chapter:abc")).toBeLessThan(rank("notes:abc"));
    expect(rank("book:abc")).toBeLessThan(rank("cover:abc"));
  });

  it("gives an unknown key a place rather than a NaN", () => {
    // `indexOf` answers -1, and a -1 sorts in front of the books — which would
    // put a key nobody planned for ahead of the rows everything else needs.
    expect(rank("something:new")).toBeGreaterThanOrEqual(rank("prefs"));
    expect(Number.isFinite(rank("something:new"))).toBe(true);
  });
});

describe("worthRetrying", () => {
  it("tries again after a foreign key that has not landed yet", () => {
    expect(worthRetrying({ code: "23503" })).toBe(true);
  });

  it("tries again after a dropped connection", () => {
    expect(worthRetrying(new TypeError("Failed to fetch"))).toBe(true);
    expect(worthRetrying(null)).toBe(true);
  });

  it("does not keep asking once access has been taken away", () => {
    // The one failure that is about the writer rather than about the moment.
    // Four more attempts would be four more denials and four more lines in the
    // console saying so.
    expect(worthRetrying({ code: "42501" })).toBe(false);
    expect(worthRetrying({ code: "PGRST301" })).toBe(false);
  });
});

describe("pushOwner", () => {
  const me = "11111111-1111-1111-1111-111111111111";
  const them = "22222222-2222-2222-2222-222222222222";

  it("attributes a book this browser made to whoever is signed in", () => {
    expect(pushOwner({}, me)).toBe(me);
  });

  it("leaves somebody else's book attributed to them", () => {
    // The whole of not stealing a manuscript: a shared book keeps its owner,
    // and only its chapter rows go up.
    expect(pushOwner({ ownerId: them }, me)).toBe(them);
  });

  it("sends nothing at all when nobody is signed in", () => {
    // **The bug this exists for.** A book keeps the `ownerId` of the session
    // that made it, so after a sign-out the stored value is still there and
    // still looks like an answer — and `book.ownerId ?? me` handed it over.
    // The push was then well-formed, attributed to a real person, and sent
    // with no credentials, so only Postgres could tell it was wrong: 42501,
    // with a hint recommending we grant `anon` write access to `books`.
    expect(pushOwner({ ownerId: them }, null)).toBeNull();
    expect(pushOwner({}, null)).toBeNull();
  });
});
