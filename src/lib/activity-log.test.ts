import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  ACTIVITY_DETAILS,
  ACTIVITY_KINDS,
  allDetails,
  cleanBookId,
  importDetail,
  shouldSend,
} from "./activity-log";

/*
 * SQL cannot import TypeScript, so the test reads the migration — the browser
 * sending a kind Postgres then refuses is the drift this catches, and it would
 * be silent: `noteActivity` swallows its errors by design.
 */
const SQL = readFileSync(
  "supabase/migrations/20261005000000_admin_insights.sql",
  "utf8",
);

function quoted(block: string | undefined): string[] {
  return [...(block ?? "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

describe("the activity record's lists", () => {
  it("names the same kinds as the migration's CHECK", () => {
    const block = SQL.match(/kind\s+text not null check \(kind in \(([\s\S]*?)\)\)/)?.[1];
    expect(quoted(block)).toEqual([...ACTIVITY_KINDS]);
  });

  it("names the same details as the migration's CHECK", () => {
    const block = SQL.match(/detail\s+text check \(detail in \(([\s\S]*?)\)\)/)?.[1];
    expect(new Set(quoted(block))).toEqual(new Set(allDetails()));
  });

  it("gives a detail list only to kinds that exist", () => {
    for (const kind of Object.keys(ACTIVITY_DETAILS)) {
      expect(ACTIVITY_KINDS).toContain(kind);
    }
  });

  /*
   * The promise on /privacy is that the record never carries anything a
   * writer typed. A free-text column is how that would quietly stop being
   * true, so the table's columns are pinned.
   */
  it("has no column that could carry text", () => {
    const table = SQL.match(
      /create table if not exists public\.activity_events \(([\s\S]*?)\n\);/,
    )?.[1];
    const columns = (table ?? "")
      .split("\n")
      .map((line) => line.match(/^  ([a-z_]+)\s/)?.[1])
      .filter(Boolean);
    expect(columns).toEqual(["id", "owner", "kind", "detail", "book_id", "created_at"]);
  });
});

describe("shouldSend", () => {
  const t = 1_000_000_000;

  it("sends the first time", () => {
    expect(shouldSend("export_done", undefined, t)).toBe(true);
  });

  it("holds a presence kind for half an hour", () => {
    expect(shouldSend("app_open", t, t + 29 * 60_000)).toBe(false);
    expect(shouldSend("app_open", t, t + 30 * 60_000)).toBe(true);
    expect(shouldSend("writing", t, t + 10 * 60_000)).toBe(false);
  });

  it("holds anything else for ten seconds — a double click, not a second export", () => {
    expect(shouldSend("export_done", t, t + 9_000)).toBe(false);
    expect(shouldSend("export_done", t, t + 10_000)).toBe(true);
  });
});

describe("importDetail", () => {
  it("reads the format from every extension the picker accepts", () => {
    expect(importDetail("Draft 3.DOCX")).toBe("docx");
    expect(importDetail("book.epub")).toBe("epub");
    expect(importDetail("notes.markdown")).toBe("md");
    expect(importDetail("notes.md")).toBe("md");
    expect(importDetail("plain.txt")).toBe("txt");
    expect(importDetail("page.htm")).toBe("html");
  });

  it("answers null for anything else, and never returns the name", () => {
    expect(importDetail("manuscript.pdf")).toBeNull();
    expect(importDetail("no-extension")).toBeNull();
  });

  it("only ever answers a detail the database accepts", () => {
    for (const name of ["a.docx", "a.epub", "a.md", "a.markdown", "a.txt", "a.html", "a.htm"]) {
      expect(allDetails()).toContain(importDetail(name));
    }
  });
});

describe("cleanBookId", () => {
  it("keeps a uuid and the fallback id shape", () => {
    expect(cleanBookId("3f2b8c1e-0d4a-4c3b-9a51-7e2f0c9d1a22")).toBe(
      "3f2b8c1e-0d4a-4c3b-9a51-7e2f0c9d1a22",
    );
    expect(cleanBookId("lz9k2x-ab12cd34")).toBe("lz9k2x-ab12cd34");
  });

  it("drops anything that is not an id", () => {
    expect(cleanBookId("It was a dark and stormy night")).toBeNull();
    expect(cleanBookId("")).toBeNull();
    expect(cleanBookId(undefined)).toBeNull();
    expect(cleanBookId("x".repeat(65))).toBeNull();
  });
});
