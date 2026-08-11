import { SLOTS, SLOT_MAX } from "@/lib/keywords";

/** The count in the guide's own prose, so it cannot disagree with the form. */
const GUIDE_SLOTS = SLOTS;

/**
 * How to fill the seven boxes by hand.
 *
 * **This exists because the model is the part most likely not to be there.**
 * A self-hosted copy has no API key and the route answers 501; a free account
 * runs out of suggestions and conversations; a gateway has a bad afternoon;
 * somebody is on a train. In every one of those the writer still has seven
 * empty boxes and a book to publish, and a screen whose only answer is a
 * button that is not working today has failed them. So the whole of what the
 * chat knows is also written down, free, offline, and readable by anybody
 * signed out.
 *
 * **Every fact in here was checked against the shop's own help pages**, not
 * against the folklore that surrounds this subject — see `SOURCES`. Where the
 * two disagree, and they often do, this follows the shop. Three claims in
 * particular are the ones people get wrong: that these are tags (they are
 * phrases), that quotation marks group a phrase (they are refused outright),
 * and that "single words work better" is general advice (it is a sentence
 * about quotation marks, quoted out of its own bullet for years).
 *
 * **No search volume, no competition score, no rank**, here or anywhere near
 * this feature. It is the figure a writer wants, no shop publishes it, and the
 * tools that quote one buy scraped data. A test asserts this file offers none:
 * a guide is exactly where an invented number would be most believable,
 * because it would be read as documentation rather than as a guess.
 */

export interface GuideEntry {
  q: string;
  /** Paragraphs. Kept as text so the guide can be read anywhere. */
  a: string[];
  /** A numbered method, where the answer is a thing to do rather than know. */
  steps?: string[];
}

export interface GuideTopic {
  id: string;
  title: string;
  /** One line under the heading, saying what this topic is for. */
  lead: string;
  entries: GuideEntry[];
}

export const KEYWORD_GUIDE: GuideTopic[] = [
  {
    id: "what",
    title: "What the seven are",
    lead: "The part of a listing nobody explains, in plain words.",
    entries: [
      {
        q: "What are the seven keyword boxes?",
        a: [
          `Seven fields on the shop's listing form, ${SLOT_MAX} characters each. Readers never see them. The shop's search reads them and indexes your book under them, on top of the words already in your title, subtitle, author name, series and description.`,
          "That is the whole game: they are extra words, so they are worth spending on what your listing does not already say.",
        ],
      },
      {
        q: "Are they tags?",
        a: [
          "No, and this is the commonest mistake. A box holds a phrase, not one word — Amazon's own advice is two or three words. Seven boxes is not seven tags; it is 350 characters of extra indexing, and a box spent on one word is most of it thrown away.",
        ],
      },
      {
        q: "Do I have to fill all seven?",
        a: [
          "All seven are optional and there is no penalty for filling them. An empty box buys nothing, so there is no reason to leave one — but a box filled with something untrue of your book is worse than an empty one, because a shop asks that the keywords, the title and the description describe the same book.",
        ],
      },
      {
        q: "Does the order matter?",
        a: [
          "No. The order of the boxes makes no difference, and the words inside a box are matched in combinations — so there is nothing to gain from spending two boxes on rearrangements of the same words. Write each phrase in the order a person would say it.",
        ],
      },
      {
        q: "Do the other shops ask for seven boxes too?",
        a: [
          `No. ${GUIDE_SLOTS} boxes of ${SLOT_MAX} characters is Amazon's shape, not a standard, and this screen is built to it because it is the strictest — a set of phrases that fits here fits anywhere.`,
          "The others differ. Kobo has a keywords field but not seven of them. Draft2Digital, which files a book with several shops at once, takes one longer list. Apple Books has no equivalent at all — what it indexes is your title, description and categories. IngramSpark works from BISAC subject codes rather than keywords, and feeds shops that way.",
          "Categories differ as well: most of the trade uses BISAC codes, and Amazon left BISAC for a tree of its own in 2023, which is why a category path copied from one shop's form often will not be accepted by another's.",
          "None of that changes the work. What you write here is the set of phrases your book should be findable by; each shop takes them in its own shape, and the ones you cannot use are simply the ones that did not fit.",
        ],
      },
    ],
  },
  {
    id: "where",
    title: "Where they go",
    lead: "Not in the book. On the shop's form, and changeable afterwards.",
    entries: [
      {
        q: "Do keywords go in the book file?",
        a: [
          "No. They are typed into the listing form on the shop's website when you upload. Nothing about them belongs in the manuscript — a keyword list in the back of the book is junk in front of a reader, and it does not help the shop's search at all.",
          "This screen is a place to write and check them. When you upload, copy them across.",
        ],
      },
      {
        q: "Where exactly, on Amazon?",
        a: [
          "Sign in at kdp.amazon.com, go to your Bookshelf, and either start a new title or choose Edit book details on one you have. The Keywords section is on the first page, \"Kindle eBook Details\", under the description and beside the categories.",
        ],
      },
      {
        q: "Can I change them after publishing?",
        a: [
          "Yes, any time, and without re-uploading the manuscript. Bookshelf, then Edit book details, then the Keywords section, then Save and Continue and publish again. The file is untouched.",
          "Which is worth knowing before you agonise: these are the one part of a listing that costs nothing to get wrong the first time.",
        ],
      },
    ],
  },
  {
    id: "byhand",
    title: "Writing them by hand",
    lead: "The method, for when nothing is suggesting anything.",
    entries: [
      {
        q: "How do I work out seven on my own?",
        a: [
          "This takes about twenty minutes and does not need any tool, ours or anybody else's. The boxes on this screen check what you write as you type, and that half needs no account, no key and no connection.",
        ],
        steps: [
          "Write down what your listing already says: the title, the subtitle, the series name, your own name, and the three categories you chose. Every word there is already indexed, and spending a box on one buys nothing.",
          "Describe the book the way you would to a friend who reads your genre. Its subgenre, where it is set, what it feels like to read, who it is for, and what it is like in kind.",
          "Turn each of those into a phrase of two or three words. Aim at what somebody would type into a search box, not at what sounds impressive on a cover.",
          "Cross out anything from step 1 that crept in, and anything a shop refuses — the list is in the next topic. The findings under the boxes on this screen do this for you.",
          "Try each phrase in Amazon's own search box before you publish. If the results are nothing like your book, the phrase is not describing your book to the shop, whatever it means to you.",
          "Fill all seven. If you have five good ones and no sixth, leave it and come back — they can be changed after publishing.",
        ],
      },
      {
        q: "What kinds of words are worth a box?",
        a: [
          "Amazon names four kinds outright: the setting, the character types or roles, the plot themes, and the tone of the story. Two more are worth a box in practice — who the book is for, and what it is comparable to in kind rather than by name.",
          "\"Cornish fishing village mystery\" says four of those at once. \"Great read\" says none of them.",
        ],
      },
      {
        q: "Nothing is suggesting anything. Is this screen still useful?",
        a: [
          "Yes. The counting and the checking are arithmetic in your own browser: over the character limit, quotation marks, words your title or categories already own, the same word spent twice, and phrases the shops publish a rule against. None of that asks anything of a server, so it works with no account, no key, no plan and no connection.",
          "The suggestions and the conversation are the parts that need a model configured and an allowance left. The seven boxes are yours either way.",
        ],
      },
      {
        q: "How many words should a phrase be?",
        a: [
          "Two or three, per the shop's own recommendation. One word is usually too general to be worth a box and often already in your title; five or six is a sentence nobody types.",
          "You may see \"single words work better than phrases\" quoted as Amazon's advice. That sentence sits inside their bullet about quotation marks and is about not wrapping a phrase in quotes — not about writing one-word keywords.",
        ],
      },
    ],
  },
  {
    id: "refused",
    title: "What a shop refuses",
    lead: "Published rules, not guesses about what hurts ranking.",
    entries: [
      {
        q: "What will Amazon reject?",
        a: [
          "Their own list: anything already in your title, categories or contributor fields; claims about quality like \"best novel ever\"; anything that goes stale, such as \"new\", \"on sale\" or \"available now\"; generic words like \"book\"; misspellings; the names of authors or brands you are not connected to; their own programme names such as Kindle Unlimited or KDP Select; HTML tags; and quotation marks.",
          "They describe it as a zero tolerance policy for metadata meant to advertise, promote or mislead — so this is a rule about the listing being refused, not advice about ranking.",
        ],
      },
      {
        q: "Why are quotation marks refused?",
        a: [
          "Because a keyword field is not a search box. People wrap a phrase in quotes out of habit, expecting it to be matched as a unit; the shop reads the marks as part of the phrase and refuses the field. Type the words on their own, separated by spaces.",
          "Commas are the same idea from the other end: they are not needed and buy nothing.",
        ],
      },
      {
        q: "Is keyword stuffing still worth doing?",
        a: [
          "No, and less so every year. Since 2024 Amazon's search carries a semantic layer that reads a listing for what it means rather than matching strings, so covering the right ideas is what earns a book its place. Repeating the same word across boxes is explicitly less effective than it used to be, and it costs you the boxes.",
        ],
      },
    ],
  },
  {
    id: "categories",
    title: "Categories, and shelves only a keyword reaches",
    lead: "The three you pick, and the ones you cannot pick at all.",
    entries: [
      {
        q: "How do the seven relate to my three categories?",
        a: [
          "They are separate parts of the same form. You choose up to three categories at upload; the keywords are extra words on top. Because the shop already indexes your categories, a keyword repeating one of their names is spent twice — which is why this screen flags it.",
        ],
      },
      {
        q: "What is a keyword-gated subcategory?",
        a: [
          "A few subcategories cannot be reached through the category selector at all. A book appears in one only if a keyword carries the particular word that shelf is gated on.",
          "Amazon's own LGBT page is the plain example: to appear in its Bisexual Romance shelf, the keywords must include \"bisexual\". There are sibling pages for other genres, with their own words.",
          "So one of your seven can be worth a whole extra shelf rather than a handful of searches.",
        ],
      },
      {
        q: "Where is the list of gated words?",
        a: [
          "Amazon publishes it, genre by genre, on its own help pages — and changes it. We deliberately do not ship a copy: a stale list of somebody else's rules, printed as though it were ours, is worse than no list. Look up the page for your genre before you settle the seven.",
        ],
      },
    ],
  },
];

/**
 * Where every fact above came from.
 *
 * Printed in the guide rather than kept in a comment, and that is the point:
 * this is the subject with more confident wrong advice attached to it than any
 * other part of self-publishing, and the only honest answer to "says who?" is
 * a link to the shop.
 */
export const SOURCES: { label: string; href: string }[] = [
  {
    label: "Make your book more discoverable with keywords",
    href: "https://kdp.amazon.com/en_US/help/topic/G201298500",
  },
  {
    label: "How do I add or change my keywords?",
    href: "https://kdp.amazon.com/en_US/help/topic/G201743260",
  },
  {
    label: "KDP categories",
    href: "https://kdp.amazon.com/en_US/help/topic/G200652170",
  },
  {
    label: "Metadata guidelines for books",
    href: "https://kdp.amazon.com/en_US/help/topic/G201097560",
  },
];
