import { describe, it, expect } from "vitest";
import { ebookPay, paperbackPay, printCost } from "./kdp-terms";

describe("ebookPay", () => {
  it("pays 70% after delivery between $2.99 and $12.99", () => {
    expect(ebookPay(4.99)).toEqual({ allowed: true, rate: 0.7, delivery: 0.15, pay: 3.39 });
    expect(ebookPay(2.99).pay).toBe(1.99);
    expect(ebookPay(9.99).pay).toBe(6.89);
    expect(ebookPay(12.99).pay).toBe(8.99);
  });

  it("uses the $12.99 ceiling of 2026-07-07, not the old $9.99", () => {
    expect(ebookPay(11.99).rate).toBe(0.7);
    expect(ebookPay(13.99)).toEqual({ allowed: true, rate: 0.35, delivery: 0, pay: 4.9 });
  });

  it("pays 35% below $2.99 with no delivery charge", () => {
    expect(ebookPay(0.99)).toEqual({ allowed: true, rate: 0.35, delivery: 0, pay: 0.35 });
    expect(ebookPay(1.99).pay).toBe(0.7);
  });

  it("refuses a price Amazon does not accept", () => {
    expect(ebookPay(0.5)).toEqual({ allowed: false, rate: 0.35, delivery: 0, pay: 0 });
    expect(ebookPay(250).allowed).toBe(false);
  });

  it("charges delivery by the megabyte, with a one-cent floor", () => {
    expect(ebookPay(4.99, 3).delivery).toBe(0.45);
    expect(ebookPay(4.99, 0.01).delivery).toBe(0.01);
  });
});

describe("printCost", () => {
  it("charges a flat $2.30 from 24 to 108 pages", () => {
    expect(printCost(24)).toBe(2.3);
    expect(printCost(108)).toBe(2.3);
  });

  it("charges $1.00 plus 1.2 cents a page from 110", () => {
    expect(printCost(110)).toBe(2.32);
    expect(printCost(300)).toBe(4.6);
  });

  it("has no price outside 24 to 828 pages", () => {
    expect(printCost(20)).toBe(null);
    expect(printCost(900)).toBe(null);
  });
});

describe("paperbackPay", () => {
  it("reproduces KDP's own worked example", () => {
    // KDP help A1OYGQ0E1L4WBS: $15, 333 pages, black ink — (0.60 × $15) − $5.00 = $4.00.
    const pay = paperbackPay(15, 333);
    expect(pay?.printing).toBe(5);
    expect(pay?.rate).toBe(0.6);
    expect(pay?.pay).toBe(4);
  });

  it("pays 50% at $9.98 and under, 60% from $9.99", () => {
    expect(paperbackPay(9.98, 300)?.rate).toBe(0.5);
    expect(paperbackPay(9.99, 300)?.rate).toBe(0.6);
  });

  it("names the lowest list price Amazon accepts", () => {
    expect(paperbackPay(12, 300)?.lowest).toBe(9.2); // $4.60 ÷ 50%
    expect(paperbackPay(15, 333)?.lowest).toBe(9.99); // $5.00 ÷ 50% is $10, a 60% price
    expect(paperbackPay(20, 500)?.lowest).toBe(11.67); // $7.00 ÷ 60%
  });

  it("has nothing to say about a page count Amazon will not print", () => {
    expect(paperbackPay(10, 10)).toBe(null);
  });
});
