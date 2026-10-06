import { describe, it, expect } from "vitest";
import { publisherGroup } from "./publishers";

/* Every name here is one Apple's best-seller lists really carried on
   2026-10-05, except "Harper Sloan", which stands for the case the anchoring
   exists for: a writer whose own name starts with an imprint's. */

describe("publisherGroup", () => {
  it("puts the big houses and their imprints on the traditional side", () => {
    for (const name of [
      "Penguin Publishing Group",
      "Random House Worlds",
      "Tor Publishing Group",
      "Little, Brown and Company",
      "Grand Central Publishing",
      "Knopf Doubleday Publishing Group",
      "Orbit",
      "St. Martin's Publishing Group",
      "St. Martin’s Press",
      "Avon",
      "Harper Voyager",
      "William Morrow",
      "Harper",
      "HarperCollins e-books",
      "Scribner",
      "Gallery Books",
      "S&S/Saga Press",
      "Atria/Emily Bestler Books",
      "MIRA Books",
      "Harlequin",
      "Bookouture",
      "Kensington Books",
      "Sourcebooks",
      "Bloomsbury Publishing",
      "Disney Hyperion Digital",
      "W. W. Norton & Company",
      "Entangled Publishing, LLC",
      "Storytide",
      "Margaret K. McElderry Books",
      "Threshold Editions",
      "Gallery/13A",
      "Thomas Dunne Books",
      "Amulet Books",
      "CROOKED LANE BOOKS",
      "Soho Press",
    ]) {
      expect(publisherGroup(name), name).toBe("traditional");
    }
  });

  it("leaves writers' own imprints and small presses on the other side", () => {
    for (const name of [
      "Mari Carr Books LLC",
      "Juliette Banks",
      "Fiona Grace",
      "Boldwood Books",
      "Tule Publishing",
      "Bindery Books",
      "Indie House Publishing",
      "Stoker Aces Production, LLC",
      "Mira Lyn Kelly",
      "Harper Sloan",
      "Toni Anderson Inc.",
      "PublishDrive",
      // Brandon Sanderson's own company: self-published, however large.
      "Dragonsteel Entertainment, LLC",
      // Self-publishing services, even the one Simon & Schuster owns.
      "Archway Publishing",
      "BookBaby",
    ]) {
      expect(publisherGroup(name), name).toBe("independent");
    }
  });

  it("gives Amazon's own imprints a side of their own", () => {
    // Names Amazon's Kindle lists carried on 2026-10-06.
    for (const name of [
      "Thomas & Mercer",
      "Lake Union Publishing",
      "Montlake",
      "47North",
      "Amazon Original Stories",
      "AmazonCrossing",
    ]) {
      expect(publisherGroup(name), name).toBe("amazon");
    }
  });

  it("knows the imprints the Amazon check found on the wrong side", () => {
    for (const name of [
      "Poisoned Pen Press",
      "Pinnacle Books",
      "HarperVia",
      "Pamela Dorman Books",
    ]) {
      expect(publisherGroup(name), name).toBe("traditional");
    }
  });

  it("treats a missing publisher as independent rather than as a house", () => {
    expect(publisherGroup(null)).toBe("independent");
    expect(publisherGroup("")).toBe("independent");
  });
});
