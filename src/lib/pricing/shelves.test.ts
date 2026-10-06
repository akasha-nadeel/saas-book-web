import { describe, it, expect } from "vitest";
import { GENRES } from "../book-kinds";
import {
  BESTSELLER_SHELVES,
  SHELF_FAMILIES,
  amazonLink,
  amazonSearchUrl,
  appleListUrl,
  shelfById,
  shelfForBookGenre,
} from "./shelves";

describe("BESTSELLER_SHELVES", () => {
  it("holds no duplicate ids, labels or Apple genres", () => {
    for (const key of ["id", "label", "appleGenre"] as const) {
      const values = BESTSELLER_SHELVES.map((shelf) => shelf[key]);
      expect(new Set(values).size, key).toBe(values.length);
    }
  });

  it("asks Apple for the top 100 paid ebooks in the US store", () => {
    expect(appleListUrl(shelfById("cozy-mystery")!)).toBe(
      "https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=11259/json",
    );
  });

  it("only links to Amazon's Kindle store, never reads it", () => {
    const url = amazonSearchUrl(shelfById("cozy-mystery")!);
    expect(url.startsWith("https://www.amazon.com/s?")).toBe(true);
    expect(url).toContain("i=digital-text");
    expect(url).toContain("k=cozy%20mystery");
  });

  it("answers null for an id it does not know", () => {
    expect(shelfById("nope")).toBe(null);
  });

  it("files every shelf under a family the tiles draw", () => {
    for (const shelf of BESTSELLER_SHELVES) {
      expect(SHELF_FAMILIES, shelf.id).toContain(shelf.family);
    }
    for (const family of SHELF_FAMILIES) {
      expect(
        BESTSELLER_SHELVES.some((shelf) => shelf.family === family),
        family,
      ).toBe(true);
    }
  });

  it("names Amazon's own best-seller lists by a node number and Amazon's own name", () => {
    for (const shelf of BESTSELLER_SHELVES) {
      if (!shelf.amazonBestsellers) continue;
      expect(shelf.amazonBestsellers.node, shelf.id).toMatch(/^\d+$/);
      expect(shelf.amazonBestsellers.name.trim(), shelf.id).not.toBe("");
    }
  });
});

describe("amazonLink", () => {
  it("opens Amazon's Kindle top 100, under Amazon's own name for the list", () => {
    const link = amazonLink(shelfById("cozy-mystery")!);
    expect(link.url).toBe("https://www.amazon.com/gp/bestsellers/digital-text/6190476011");
    expect(link.label).toBe("Amazon’s top 100 in Cozy Mystery");
  });

  it("falls back to a Kindle-store search, and says it is a search", () => {
    const shelf = { ...shelfById("cozy-mystery")!, amazonBestsellers: undefined };
    const link = amazonLink(shelf);
    expect(link.url).toBe(amazonSearchUrl(shelf));
    expect(link.label).toBe("Search this genre in Amazon’s Kindle store");
  });
});

describe("shelfForBookGenre", () => {
  it("maps every book genre but Other to a shelf that exists", () => {
    for (const genre of GENRES.filter((g) => g !== "Other")) {
      const shelf = shelfForBookGenre(genre);
      expect(shelf, genre).not.toBe(null);
      expect(BESTSELLER_SHELVES).toContain(shelf);
    }
  });

  it("leaves Other and unknown genres unset rather than guessing", () => {
    expect(shelfForBookGenre("Other")).toBe(null);
    expect(shelfForBookGenre(undefined)).toBe(null);
    expect(shelfForBookGenre("Westerns")).toBe(null);
  });
});
