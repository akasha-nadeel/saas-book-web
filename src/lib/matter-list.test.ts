import { describe, expect, it } from "vitest";
import { MATTER_SECTIONS, matterSectionIndex } from "@/lib/matter";
import { matterRows, type MatterListPage } from "@/lib/matter-list";

const page = (title: string, id = title.toLowerCase()): MatterListPage => ({
  id,
  title,
});

/** The rows as a flat list of names, which is what the card draws. */
const names = (rows: ReturnType<typeof matterRows<MatterListPage>>) =>
  rows.map((row) => (row.kind === "offer" ? row.section.title : row.page.title));

/** Just the pages, in the order they come out. */
const kept = (rows: ReturnType<typeof matterRows<MatterListPage>>) =>
  rows.flatMap((row) => (row.kind === "page" ? [row.page.title] : []));

describe("matterRows", () => {
  it("offers the whole catalogue for a part with no pages", () => {
    for (const part of ["front", "back"] as const) {
      const rows = matterRows(part, []);
      expect(rows.every((row) => row.kind === "offer")).toBe(true);
      expect(names(rows)).toEqual(MATTER_SECTIONS[part].map((s) => s.title));
    }
  });

  it("switches on the sections the book has a page for", () => {
    const rows = matterRows("front", [page("Dedication"), page("Prologue")]);
    const on = rows.filter((row) => row.kind === "page");
    expect(on.map((row) => row.page.title)).toEqual(["Dedication", "Prologue"]);
    // Everything else in the part is still listed, switched off.
    expect(names(rows)).toEqual(MATTER_SECTIONS.front.map((s) => s.title));
  });

  it("names the section a page fills, and null for one the writer named", () => {
    const rows = matterRows("back", [page("Glossary"), page("Cast of ships")]);
    const own = rows.find(
      (row) => row.kind === "page" && row.page.title === "Cast of ships",
    );
    const standard = rows.find(
      (row) => row.kind === "page" && row.page.title === "Glossary",
    );
    expect(own?.kind === "page" && own.section).toBeNull();
    expect(standard?.kind === "page" && standard.section?.title).toBe(
      "Glossary",
    );
  });

  it("matches a title whatever its case and spacing", () => {
    // The store keeps whatever the writer or an importer typed; `matterSection`
    // trims and lowercases, and this list must not answer differently.
    const rows = matterRows("front", [page("  dedication  ")]);
    const row = rows.find(
      (r) => r.kind === "page" && r.page.title === "  dedication  ",
    );
    expect(row?.kind === "page" && row.section?.title).toBe("Dedication");
    // And the offer for it is gone, rather than sitting beside its own page.
    expect(
      rows.some((r) => r.kind === "offer" && r.section.title === "Dedication"),
    ).toBe(false);
  });

  it("keeps a second page of the same name as the writer's own", () => {
    // An import can land two Dedications. Both stay listed, but only the first
    // is the book's Dedication — or switching the row off would take whichever
    // one the loop happened to reach last.
    const rows = matterRows("front", [
      page("Dedication", "one"),
      page("Dedication", "two"),
    ]);
    const both = rows.filter(
      (row) => row.kind === "page" && row.page.title === "Dedication",
    );
    expect(both).toHaveLength(2);
    expect(both[0].kind === "page" && both[0].section?.title).toBe("Dedication");
    expect(both[1].kind === "page" && both[1].section).toBeNull();
  });

  /**
   * **These assert positions, and they are the ones not to "fix".**
   *
   * The rule is that a stored page never moves and an offer lands exactly
   * where its page would if it were switched on. Sorting the whole list into
   * catalogue order would make every one of these pass except the last two,
   * and would put the back matter on this card in an order the export does not
   * use — see the note at the top of `matter-list.ts`.
   */
  describe("placement", () => {
    it("never reorders the pages the book has", () => {
      // Deliberately out of catalogue order: this is what a restore from the
      // trash (which appends) or a `setChapterMatter` retag leaves behind.
      const stored = ["Glossary", "Epilogue", "Acknowledgements"];
      const rows = matterRows("back", stored.map((t) => page(t)));
      expect(kept(rows)).toEqual(stored);
    });

    it("puts an offer where switching it on would put the page", () => {
      // `createMatterPages` inserts before the first page of the part whose
      // section index is greater. An offer has to agree, or the row would jump
      // the moment it was pressed.
      const stored = [page("Half-title page"), page("Prologue")];
      const rows = matterRows("front", stored);
      const at = (title: string) => names(rows).indexOf(title);

      expect(at("Half-title page")).toBe(0);
      expect(at("Prologue")).toBe(names(rows).length - 1);
      for (const section of MATTER_SECTIONS.front) {
        if (section.title === "Half-title page") continue;
        if (section.title === "Prologue") continue;
        expect(at(section.title)).toBeGreaterThan(at("Half-title page"));
        expect(at(section.title)).toBeLessThan(at("Prologue"));
      }
    });

    it("flushes the offers before a page the writer named", () => {
      // A writer's own page ranks `Infinity`, so nothing standard sorts after
      // it — the same rule `bindBook` applies to the front matter.
      const rows = matterRows("back", [page("Cast of ships")]);
      expect(names(rows).at(-1)).toBe("Cast of ships");
      expect(matterSectionIndex("back", "Cast of ships")).toBe(
        Number.POSITIVE_INFINITY,
      );
    });

    it("lists every section exactly once, however the pages are stored", () => {
      // The real failure this guards: an offer drawn beside its own page, or a
      // section that quietly vanishes from the card.
      const rows = matterRows("front", [
        page("Table of contents"),
        page("Half-title page"),
        page("A note on the maps"),
      ]);
      for (const section of MATTER_SECTIONS.front) {
        const times = rows.filter((row) =>
          row.kind === "offer"
            ? row.section.title === section.title
            : row.section?.title === section.title,
        ).length;
        expect(times).toBe(1);
      }
      expect(rows).toHaveLength(MATTER_SECTIONS.front.length + 1);
    });
  });
});
