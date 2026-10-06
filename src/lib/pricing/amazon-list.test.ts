import { describe, it, expect } from "vitest";
import { mergeAmazon, parseAmazonBestSellers, parseAmazonDetails } from "./amazon-list";

/* Shapes copied from OpenWeb Ninja's real answers on 2026-10-06, cut down to
   the fields the parser reads. */

const list = {
  status: "OK",
  data: {
    best_sellers: [
      {
        rank: 1,
        asin: "B0HLQ6HDZ6",
        product_title: "Swamp Shoot (Miss Fortune Mysteries Book 31)",
        product_price: "$7.99",
        product_url: "https://www.amazon.com/dp/B0HLQ6HDZ6",
        product_photo: "https://images-na.ssl-images-amazon.com/images/I/91icfudWCDL._AC_UL900_SR900,600_.jpg",
      },
      {
        rank: 2,
        asin: "B0HKYHDZMG",
        product_title: "Sweet Ruin (Makov Bratva Book 1)",
        product_price: "$2.99",
        product_url: "https://www.amazon.com/dp/B0HKYHDZMG",
        product_photo: null,
      },
      { rank: 3, asin: "B000000000", product_title: "No price here", product_price: null },
    ],
  },
};

const details = {
  status: "OK",
  data: [
    {
      asin: "B0HKYHDZMG",
      product_price: "$2.99",
      product_byline: "by Nicole Fox (Author) Format: Kindle Edition",
      kindle_unlimited: true,
      book_formats: [
        { format: "Kindle", asin: "B0HKYHDZMG", price: "$0.00", current: true },
        { format: "Paperback", asin: "B0HL1RD1FX", price: "$23.74" },
      ],
      product_information: {
        "Publication date": "September 25, 2026",
        "File size": "1.6 MB",
        "Print length": "664 pages",
        "Book 1 of 2": "Makov Bratva",
      },
    },
    {
      asin: "B0HLQ6HDZ6",
      product_price: "$7.99",
      product_byline: "by Jana DeLeon (Author) Format: Kindle Edition",
      book_formats: [{ format: "Kindle", asin: "B0HLQ6HDZ6", price: "$7.99", current: true }],
      product_information: {
        Publisher: "J&R Publishing",
        "Publication date": "October 2, 2026",
        "File size": "579 KB",
        "Print length": "293 pages",
      },
    },
  ],
};

describe("parseAmazonBestSellers", () => {
  it("reads rank, price and link, and skips a book with no price", () => {
    const books = parseAmazonBestSellers(list);
    expect(books).toHaveLength(2);
    expect(books[0]).toMatchObject({
      asin: "B0HLQ6HDZ6",
      position: 1,
      price: 7.99,
      url: "https://www.amazon.com/dp/B0HLQ6HDZ6",
    });
    expect(books[1].cover).toBe(null);
  });

  it("returns nothing, rather than throwing, for a payload it does not recognise", () => {
    expect(parseAmazonBestSellers(null)).toEqual([]);
    expect(parseAmazonBestSellers({ data: {} })).toEqual([]);
  });
});

describe("parseAmazonDetails", () => {
  const found = parseAmazonDetails(details);

  it("reads Kindle Unlimited, pages, file size, series and the paperback price", () => {
    expect(found.get("B0HKYHDZMG")).toEqual({
      author: "Nicole Fox",
      publisher: null,
      released: "2026-09-25",
      kindleUnlimited: true,
      pages: 664,
      fileSizeMb: 1.6,
      series: { name: "Makov Bratva", number: 1, of: 2 },
      paperbackPrice: 23.74,
    });
  });

  it("reads a book with no Kindle Unlimited flag as not in it, and kilobytes as megabytes", () => {
    const book = found.get("B0HLQ6HDZ6")!;
    expect(book.kindleUnlimited).toBe(false);
    expect(book.publisher).toBe("J&R Publishing");
    expect(book.fileSizeMb).toBeCloseTo(0.579, 3);
    expect(book.series).toBe(null);
    expect(book.paperbackPrice).toBe(null);
  });

  it("reads one book sent as an object rather than a list", () => {
    expect(parseAmazonDetails({ data: details.data[0] }).size).toBe(1);
  });
});

describe("mergeAmazon", () => {
  it("joins the list and the details into the shape the screen draws", () => {
    const [swamp, sweet] = mergeAmazon(parseAmazonBestSellers(list), parseAmazonDetails(details));
    expect(sweet).toMatchObject({
      id: "B0HKYHDZMG",
      position: 2,
      author: "Nicole Fox",
      price: 2.99,
      currency: "USD",
      publisher: null,
      kindleUnlimited: true,
      pages: 664,
    });
    expect(swamp.publisher).toBe("J&R Publishing");
  });

  it("marks a book whose details never came as unknown, not as outside Kindle Unlimited", () => {
    const [swamp] = mergeAmazon(parseAmazonBestSellers(list), new Map());
    expect(swamp.kindleUnlimited).toBe(null);
    expect(swamp.author).toBe("Unknown author");
  });
});
