/**
 * What a book costs, what it usually earns, and what to check before paying.
 *
 * The money pains are the loudest in the research and the least served by
 * software: *"I look at the massive amount of money I wasted, especially on the
 * first book"*, *"spent upwards of a grand on covers and even more on ads, only
 * to make next to nothing"*, *"I fell for the Olympia Publishers scam"*,
 * *"$1k plus for an 8 week course… slap in the face"*.
 *
 * None of that is a feature request. It is a request to be *told* something,
 * before the money leaves — and being told is cheap, which is why almost nobody
 * does it: everyone else in this market makes money when a writer spends.
 *
 * **The figures are attributed, and their weakness is stated.** The widely
 * repeated sales numbers come from industry summaries and from writers
 * describing their own results; they are directional rather than audited, and a
 * page that presents them as hard data would be doing the thing it warns
 * against. Better to be honest about a rough number than confident about a
 * false one.
 *
 * **No company is named as a scam**, however often one comes up in the
 * research. Naming a named business as fraudulent is a legal problem rather
 * than a feature, and it is unnecessary: the checks below identify the shape of
 * the thing without libelling anybody.
 */

export interface Reality {
  id: string;
  figure: string;
  claim: string;
  /** Where it comes from, and how much weight it can carry. */
  provenance: string;
}

export const REALITIES: Reality[] = [
  {
    id: "copies",
    figure: "Under 100",
    claim:
      "Copies most self-published books sell in their lifetime.",
    provenance:
      "Widely repeated across industry summaries and author surveys. Nobody publishes an audited figure, because the shops do not release one — treat it as the shape of the thing rather than a measurement.",
  },
  {
    id: "five-thousand",
    figure: "97%",
    claim: "Of all published books sell fewer than 5,000 copies.",
    provenance:
      "A much-quoted figure originating in industry sales data. Frequently repeated without a source, including by people selling courses — which is a reason to hold it loosely, not a reason to assume the opposite.",
  },
  {
    id: "book-three",
    figure: "Book three",
    claim:
      "Where writers who do go on to earn most often say the earning started.",
    provenance:
      "From authors describing their own sales. One writer's first month came to $189; their fourth book's month came to $2,067. A pattern reported often enough to plan around, not a law.",
  },
  {
    id: "break-even",
    figure: "Rare",
    claim: "Breaking even on a first book.",
    provenance:
      "Reported almost universally by writers discussing their first release. A first book is most usefully thought of as the cost of learning to publish one.",
  },
];

export interface Spend {
  id: string;
  what: string;
  /** Real ranges writers report. Ranges, because the spread is the point. */
  typical: string;
  /** What to establish *before* the money moves. */
  checks: string[];
  /** The thing that makes this specific purchase go wrong. */
  trap: string;
}

export const SPENDS: Spend[] = [
  {
    id: "cover",
    what: "A cover",
    typical: "£150–£1,000+ for a bespoke design; less for a premade",
    checks: [
      "Ask outright whether any part of it is AI-generated, and get the answer in writing.",
      "Check their portfolio has books in your genre — a beautiful cover in the wrong convention still fails.",
      "Agree the licence covers commercial use, every format, and advertising.",
      "Ask what you receive: the layered source file, or only a flat image?",
      "Ask them to send it at thumbnail size, and look at it there before you approve it.",
    ],
    trap: "Readers now assume an AI cover means an AI book, so a cheap cover can cost more than it saves. Stock sites are full of AI images sold as illustration, and a designer using one may not know either.",
  },
  {
    id: "editing",
    what: "Editing",
    typical: "£500–£3,000+ depending on the kind and the length",
    checks: [
      "Know which of the four you are buying: developmental, line, copy, or proofreading. They are different jobs at different prices.",
      "Ask for a sample edit of a thousand words. Paying for the sample is normal and worth it.",
      "Check they have edited in your genre.",
      "Ask whether any AI tool is used in their process.",
      "Agree what you get back: tracked changes, an editorial letter, or both.",
    ],
    trap: "Buying a copy-edit when the book needs a developmental one. The prose comes back clean and the story is still broken, and the money is gone.",
  },
  {
    id: "publisher",
    what: "A publisher",
    typical: "Nothing. A real publisher pays you.",
    checks: [
      "If they ask you for money, they are not a publisher. That is the whole test.",
      "Look them up on Writer Beware and Absolute Write's Bewares board before replying.",
      "Search their name with the word “complaints”.",
      "Ask which bookshops stock their titles, and then check one.",
      "Read the rights clause. Anything taking rights for the life of copyright is a bad deal at any price.",
    ],
    trap: "Vanity presses use the vocabulary of real publishing — “we would be delighted to accept your manuscript” — and then invoice. An acceptance that arrives with a price attached is a sale, not an acceptance.",
  },
  {
    id: "promotion",
    what: "Promotion and ads",
    typical: "£20 for a newsletter slot; ads spend whatever you let them",
    checks: [
      "Ask for the numbers from previous campaigns, not testimonials.",
      "Work out how many copies at your royalty would cover the spend, before you start.",
      "Set a hard cap on ad spend and hold it.",
      "Anyone guaranteeing reviews is offering to break the shop's terms with your account.",
    ],
    trap: "Ads amplify a book that already converts. Running them at a book with a weak cover or blurb spends money teaching you that, expensively.",
  },
  {
    id: "course",
    what: "A course or a coach",
    typical: "£100–£2,000+",
    checks: [
      "Find out what they have published themselves, and how it sold.",
      "Ask what is in it that is not free on their own channel.",
      "Look for a refund policy, and read it.",
      "Be wary of anything sold on a deadline or a disappearing discount.",
    ],
    trap: "The most confident teaching in this market comes from people whose income is the teaching. That is not automatically wrong, and it is always worth knowing.",
  },
];

/**
 * How many copies pay off a given spend.
 *
 * The arithmetic writers say nobody did with them before they spent. Royalty
 * per copy varies by shop, format and price, so it is an input rather than an
 * assumption — 70% of a £2.99 ebook is about £2, which is the default here and
 * says so on the screen.
 */
export function copiesToBreakEven(spend: number, royaltyPerCopy: number): number | null {
  if (spend <= 0 || royaltyPerCopy <= 0) return null;
  return Math.ceil(spend / royaltyPerCopy);
}
