# Price check rebuild: real best-seller prices, and what the writer keeps — design note, 2026-10-05

**Status:**
- **The free Apple version** was built on 2026-10-05.
- **Amazon's list for Pro** (OpenWeb Ninja, weekly, server-checked) was built
  and tested on 2026-10-06. It goes live when the owner moves OpenWeb Ninja
  to pay-as-you-go and adds the key to production. `TODO.md` has the steps.

**What changed while building, on measurement:**
- **The series section was dropped.** Only 125 of 1,800 Apple listings name a
  series number, which is about 7 per list — too few for a middle price on
  either side.
- **The length section was dropped.** Apple gives no page counts.
- **The cover URLs are rewritten.** The feed's own `0x170bb.png` URLs answer
  400; the parser asks for `400x400bb.jpg`, which answers 200.
- **Six publishers moved to the traditional side**, after the first pass put
  them with the self-published: Entangled, Storytide, McElderry, Threshold,
  Gallery/13A and Thomas Dunne, plus a few established independents.

**The answers on 2026-10-05** (self-published middle / traditional middle):

| Genre | Self-published | Traditional |
|---|---|---|
| Cozy mystery | $4.99 (48 books) | $7.99 (52) |
| Contemporary romance | $4.99 (49) | $7.99 (51) |
| Romantic suspense | $5.99 (69) | $8.99 (31) |
| Paranormal romance | $4.99 (35) | $10.99 (65) |
| Historical romance | $4.49 (40) | $6.99 (60) |
| Urban fantasy | $4.99 (14) | $7.99 (86) |
| Science fiction | $5.99 (14) | $9.99 (86) |
| Horror | $4.99 (18) | $9.99 (82) |
| Police procedural | too few (5) | $9.99 (95) |
| Historical fiction | too few (2) | $9.99 (98) |
| Literary fiction | too few (4) | $12.99 (96) |
| Young adult | too few (4) | $8.49 (96) |

**Added on 2026-10-06** (self-published count / middle, then traditional count / middle):

| Genre | Apple id | Self-published | Traditional |
|---|---|---|---|
| Military romance | 11233 | 86 at $5.99 | 14 at $4.99 |
| Erotic romance | 10056 | 82 at $3.99 | 18 at $7.99 |
| Western romance | 10062 | 69 at $3.99 | 31 at $4.99 |
| Holiday romance | 11231 | 57 at $4.99 | 43 at $4.99 |
| Paranormal fantasy | 11004 | 57 at $4.99 | 43 at $9.99 |
| LGBTQIA+ romance | 11043 | 56 at $3.99 | 44 at $9.99 |
| New adult romance | 11040 | 55 at $4.99 | 45 at $8.99 |
| Women sleuths | 10055 | 35 at $4.99 | 65 at $9.99 |
| Hard-boiled mysteries | 10050 | 35 at $5.99 | 65 at $8.99 |
| Action & adventure | 10039 | 35 at $4.99 | 65 at $8.99 |
| Historical fantasy | 11003 | 33 at $4.99 | 67 at $9.99 |

On the same day, "your price" was split by side, the tiles were grouped into
four families, and a thin self-published side was given a button to Amazon's
own top 100.

Every decision below was taken with the owner on 2026-10-05.

## Context

The owner asked whether the price check really helps writers. Research found six things writers
want from a price checker:

1. What books like theirs sell for **on Amazon**. About 80% of indie earnings come from Amazon.
2. **Self-published prices kept apart from big publishers'** (indie ≈ $2.99–4.99, big ≈ $10+).
3. What the **best sellers** in their exact genre charge (the usual advice is "look at the top 100").
4. How many of those books are in **Kindle Unlimited**.
5. **What the writer keeps** from each sale.
6. Help with **series, book length and paperback** prices.

Today the tool works like this: a genre and two words go to Google Play's US ebook search, and
the screen shows one middle price, a range and a list. That fails in four ways:
- Google is only about 1–2% of ebook sales.
- The search returns books that match words, not books that sell.
- Often only a handful of the books it finds carry a price at all.
- $5 indie books and $12 big-publisher books are mixed into one number.

**Decided with the owner:**
- **No money is spent on data until there are paying users.** Start on Apple's free lists and
  switch the list to Amazon later. The screen is built so that switching does not mean a
  redesign.
- **Everything free at 3 checks a day**; Pro is unlimited, as today.
- **US store only to start.** UK and India come later.
- **One page, answer first.**

## The free data source: Apple Books' top 100 per genre

Apple publishes the top 100 paid ebooks for each Apple Books genre in the US store. The list is
free and needs no account:
`https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=<id>/json`.

**Measured on 2026-10-05:**

| genre (Apple id) | books returned | priced | what the list showed |
|---|---|---|---|
| Romance (10056) | 100 | 100 | mostly self-published and small presses; prices cluster at $2.99–$4.99 |
| Cozy Mysteries (11259) | 100 | 100 | top publishers Penguin (12), Kensington (6), Random House, Knopf Doubleday, William Morrow, St. Martin's, Harper; middle ≈ $5.99 |
| Mysteries & Thrillers (9032) | 100 | 100 | middle $7.99 |
| Sci-Fi & Fantasy (9020) | 100 | 100 | middle $9.99 |

- **Each entry carries:** title, author, price, publisher, release date, Apple's sub-genre, the
  cover, and a link to the book on Apple Books.
- **The lookup** (`https://itunes.apple.com/lookup?id=…`, up to many ids per call) adds every
  sub-genre a book is filed under.
- **What Apple does not give:**
  - page count. Open Library by ISBN found pages for only 2 of 40; Google by ISBN was not
    measurable here, because unkeyed calls hit the shared quota.
  - the Kindle Unlimited status of a book.
  - other books' paperback prices.
- **Terms:** Apple offers these feeds so sites can show and link to Apple Books titles, and every
  row links to the book on Apple Books.

**The gap, said on the screen.** Kindle Unlimited books are sold only on Amazon, so none of them
are on Apple. The Cozy Mysteries list shows what that does: it is mostly big publishers, because
many self-published cozies are Amazon-only. Every result therefore carries one plain line:
- that Kindle Unlimited books are missing, and why
- a one-tap link to **Amazon's own top 100 for the same genre**. That is only a link; nothing is
  fetched from Amazon.

## What the writer will see (one page, answer first)

1. **Pick a genre.** On first visit there are about 15 large genre tiles, then a picker at the
   top. Opening a genre uses one of the 3 free daily checks. Opening it again in the same tab is
   free. A line shows the source: "Apple Books US · top 100 · 5 Oct 2026".
2. **The answer card.** Two columns: **Big publishers** (the Big Five and their imprints) and
   **Self-published & smaller publishers** (everyone else).
   - Each column shows its middle price, how many books it holds, and the range the middle half
     sits in.
   - A group with fewer than 6 books says "too few for a middle price" and does not guess.
   - Under the columns sits the Kindle Unlimited line with the Amazon link.
3. **Your price.** A − / + price stepper over a price ruler.
   - The ruler shows every book on the list as a dot, coloured by group, with Amazon's 70% zone
     ($2.99–$12.99) shaded and your price marked.
   - Below it: "On Amazon you'd keep $3.39 a sale", with the sum shown.
   - Below $2.99 or above $12.99 it says plainly that Amazon pays 35% there.
   - Kindle Unlimited is explained in a single line: it pays per page read, the rate changes every
     month, and the book must be sold only on Amazon.
4. **The books.** Apple's order, #1 to #100.
   - Each row shows cover, title, author, publisher with its group, release year, and the price.
   - Filters: All / Big publishers / Self-published & smaller, plus a sort by Apple's order or
     cheapest first.
   - Each title links to Apple Books.
5. **Sections you can open**, each with a one-line summary while closed:
   - **Paperback (what you keep):** your page count (typed, or from your book) and a price give
     what you would keep on Amazon. That uses Amazon's print cost, and its 50% rate up to $9.98 or
     60% from $9.99. It also shows the lowest price Amazon will accept for that page count. This
     uses no list data, only Amazon's published rules.
   - **Series:** shown only if enough listings name their series ("Book 2" in the title or
     subtitle). It shows the middle price of book 1s against later books. Coverage is measured
     when this is built; below 6 on either side, it says so.
   - **Length:** your book's estimated page count only. The list's lengths come with Amazon later,
     unless a free source proves good enough when measured.
6. **Optional "For which book?"** picker. It reuses the dashboard's `WorkingOn` and fills in
   genre, length and series from the writer's book. Nothing about the book leaves the browser.

**Rules kept:**
- Still **no recommended price**, no score and no verdict.
- Every figure says where it came from and how many books it rests on.
- A failed fetch never reads as a cheap shelf.

**Rules changed knowingly (the owner approves them with this design):**
- The store's own list position (#1–#100) is shown, labelled as Apple's, with its date. The old
  "no rank anywhere in this cluster" rule existed because a rank could not be had honestly from a
  keyword search.

**Given up:** the free-typed genre and the two word boxes. A top-100 list exists only for the
store's own genres.

**UI principles** (Apple HIG: clarity, deference, consistency, progressive disclosure; Google
Flights price insights: "honest, actionable, concise yet explorable"):
- The answer comes before the detail.
- One filled button per card, and neutral surfaces.
- Existing `ListGroup`, `Segmented`, `Picker`, `SectionHeader` and `ListFooter`.
- `tabular-nums` on every figure.
- 44px touch targets on a phone, and a single column below `@2xl`.
- The ruler carries a text description for screen readers.
- Skeletons while loading.

## How it is built — now (free)

**No database, no scheduled job, no migration.**
- `src/app/api/price-shelf/route.ts` fetches one genre's Apple list on the server.
  - It caches for a day, the same way `/api/comps` already does (`next: { revalidate: 86400 }`
    plus `s-maxage` / `stale-while-revalidate`). Apple is asked at most about 15 times a day
    whatever the traffic, and yesterday's copy is served if Apple fails.
  - It returns the books, the fetch date and the counts.
- **Pure, tested modules** under `src/lib/pricing/`. The existing tests in
  `src/lib/comps/price-check.test.ts` that ban recommendation, score and earnings keys stay green.
  - **`shelves.ts`:** about 15 genres. Each holds an Apple genre id, an Amazon best-seller link,
    and the date both were checked.
    - Candidates: Apple's sub-genres such as Cozy Mysteries 11259, Police Procedural 10052 and
      Contemporary Romance 10057, covering today's 12 shelves plus fantasy romance, urban fantasy
      and historical fiction.
    - Each one is fetched and counted before it goes in, the way `PRICE_SHELVES` is today.
    - `shelfForGenre` is reworked against it.
  - **`publisher-groups.ts`:** a named table of the Big Five and their imprints (Penguin, Random
    House, Knopf Doubleday, Harper, William Morrow, Harlequin, One More Chapter, St. Martin's,
    Macmillan, Hachette, Grand Central, Simon & Schuster, …). Everything else is "self-published
    & smaller".
    - The screen states the rule: "sorted by publisher name".
    - A test walks the table.
  - **`shelf-facts.ts`:** per-group middles and middle halves, reusing the median and quartile
    logic in `priceFacts`/`rank`, with the `MIN_PRICES = 6` threshold. Also the series split,
    where listings carry it.
  - **`kdp-terms.ts`:** Amazon's published US rules as dated constants, verified 2026-10-05 on
    KDP's help pages.
    - 70% between $2.99 and $12.99, with delivery $0.15/MB (minimum $0.01); 35% otherwise.
    - Paperback printing, black ink: 24–108 pages $2.30; 110–828 pages $1.00 + $0.012/page.
    - Paperback royalty: 50% at or below $9.98, 60% at or above $9.99, minus printing.
    - Functions: `ebookKeep(price, mb)`, `paperbackKeep(price, pages)`,
      `paperbackMinPrice(pages)`.
    - Tests reproduce KDP's worked example: $15 and 333 pages gives $4.00.
  - **A source boundary:** `ShelfSource` is one function, "give me the top 100 for this genre,
    with date". Apple is the first implementation, and Amazon later is a second implementation
    with no screen change.
- **Reused:**
  - `estimatePages` (`src/lib/paperback.ts`), `bookWordCount` (`library-store.ts`), `seriesOf`
    (`src/lib/series.ts`)
  - `useLimitGate({ action: "priceCheck" })`, `search-memory.ts` and the `priceCheckLayout` pref
  - `toolShell`, `toolMeasure`, `ToolHeader`, and `WorkingOn` in `bookshelf.tsx`
- **The screen:** rebuild `src/components/price-check/price-check-page.tsx` to the layout above,
  and rework `price-strip.tsx` into the ruler.
  - Google is no longer called by the price check; `/api/comps` stays for the title check.
- **Words made true again** (CLAUDE.md "no claim the code can't back"):
  - Add a price check entry to `src/app/privacy/page.tsx`. It is missing even today, and must say
    that the genre goes to our server, that our server reads Apple's public list, and that covers
    load from Apple's servers in the writer's browser.
  - Update the wording in:
    - `mvp-landing-page.tsx:499–507`
    - `help-dialog.tsx:125`
    - `book-tools.ts:84`
    - `tool-guide.ts:51–69` (its chart line is already stale)
    - the dashboard banner (`bookshelf.tsx:5031`)
    - the comment at `free-limits.ts:133`
  - Re-shoot `public/shot-price-check.webp`.
  - Update CLAUDE.md's catalogue-search section and `docs/architecture/dashboard-and-tools.md`.
  - Add "Amazon data when funded" and "UK and India stores" to `TODO.md`.

## Later — Amazon, once there are paying users

This is a second `ShelfSource` and nothing on the screen changes, except that three things
appear: the Kindle Unlimited count, the list's lengths, and other books' paperback prices.

- **A pay-as-you-go data company.**
  - DataForSEO needs a $50 top-up that never expires. Apify charges per result and gives $5 of
    free use a month.
  - It fetches each genre's Amazon top 100 once a day, and a book's details at most once a week.
  - It is stored in Supabase (snapshot and book tables, RLS on with no policies, an **explicit
    `service_role` grant**, **migration applied and checked before the code**). A daily Vercel
    cron writes it, guarded by `CRON_SECRET` and a daily request cap.
  - ~~Estimated $15–60 a month for 15 genres.~~ **Corrected on 2026-10-06
    from the tool's own price list.** The only tool that reports Kindle
    Unlimited charges $0.005 per complete book, plus $0.10 per GB of memory
    at each start (run it at 1 GB, not its default 4).
    - All 27 genres once: about **$13.50**.
    - Weekly: about $55 a month.
    - Daily: about $400 a month.
    - The free $5 covers roughly one 9-genre refresh a month.
    - Refresh only what writers open, weekly, before anything bigger.
- **First a 3-day test, which can run on Apify's free $5 a month.** It must confirm that Kindle
  Unlimited status, page counts, series and paperback prices are really there, and what a day
  really costs.

  **Apify tools checked on 2026-10-05.** Only `getascraper/kdp-book-niche-analyzer` has a real
  track record, and it returns no Kindle Unlimited status; the tool that does is unproven.

  | tool | fields | price | track record |
  |---|---|---|---|
  | `getascraper/kdp-book-niche-analyzer` | price, best-seller rank, pages, publisher, date — **no KU** | from $1 / 1,000 books | 72 users, 97% runs succeed |
  | `conceivable_extension/kdp-market-intel-scraper` | price, **KU**, category rank; pages and date only by book lookup — no publisher | from $5 / 1,000 | 1 user, unproven |
  | `junglee/amazon-bestsellers` (Apify's own) | position, name, price — no book fields | from $3.20 / 1,000 | 5,058 users, 93% |
  | `junglee/amazon-crawler` (Apify's own) | general product fields — no book fields | from $3 / 1,000 | 24,635 users, 89% |
- **The risk, said plainly:** these companies copy Amazon's public pages, which Amazon's rules do
  not allow, though well-known author tools do it daily.
- **The free test was run on 2026-10-06** with `scripts/apify-amazon-test.cjs`,
  on Cozy Mystery and Contemporary Romance. **It cost $0.40 of the free $5.**
  - **Amazon's list, rank and price: yes.**
    `conceivable_extension/kdp-market-intel-scraper` returned real Amazon
    Kindle best sellers in about 50 seconds: *Swamp Shoot* at #1 in cozy, and
    *Verity* at #1 in contemporary romance, with prices.
    - Only **30 per genre**, not the 50 asked for. It reads the first page of
      Amazon's list, which shows 30.
  - **Kindle Unlimited: no — the field is there and it is wrong.** It said
    "not in Kindle Unlimited" for all 60 books. Amazon's own pages show *Sweet
    Ruin* (Nicole Fox) and *Hats off to Boo* (Sara Bourgeois), both on the
    list, **in** Kindle Unlimited. It cannot be used.
  - **Publisher, pages and date: no.** `getascraper/kdp-book-niche-analyzer`
    was stopped by Amazon's CAPTCHA on every book page, ran 6½ minutes and
    returned nothing.
    - It was charged almost nothing.
    - Without a publisher, Amazon's list cannot be split into self-published
      and traditional, which is the screen's whole answer.
  - **Same book, same price: yes, five for five.** Every book found on both
    Amazon's and Apple's lists cost the same in both: *We Chase Shadows*
    $13.99, *We Solve Murders* $12.99, *Magpie Murders* $2.99, *The Pumpkin
    Spice Café* $11.99, *Ugly Love* $12.99. That supports reading Apple's
    prices as Amazon's for books sold in both shops.
  - **Verdict:** what Apify's free tools give is Amazon's top 30 with prices,
    and nothing that tells self-published from traditional or says which books
    are in Kindle Unlimited. **Not worth building on.** Keep the Apple version.
    Revisit only with a source that reads Amazon's book pages reliably, which
    means residential proxies and a paid tool, and test it the same way first.
- **OpenWeb Ninja passed the same test on 2026-10-06**, on its free Basic plan
  (100 requests a month, hard limit, no card).
  - It is the Real-Time Amazon Data API at
    `api.openwebninja.com/realtime-amazon-data`, with an `x-api-key` header
    and the key in `.env.local` as `OPENWEBNINJA_API_KEY`.
  - **`/product-details?asin=A,B,C`** takes up to 10 books in one request and
    returns:
    - the Kindle price
    - **`kindle_unlimited: true`** for *Sweet Ruin* and *Hats off to Boo*,
      which matches Amazon; the field is absent for *We Chase Shadows*, which
      is correct
    - `product_information`, holding:
      - `Publisher` — "Pamela Dorman Books" on the Penguin title, and **absent
        on both self-published titles**, which is how Amazon lists KDP books
      - `Print length`
      - `File size` — enough for the exact delivery charge
      - the series ("Book 1 of 2": "Makov Bratva")
    - **`book_formats`**: paperback and hardcover prices and ASINs. A Kindle
      Unlimited book's Kindle price shows here as $0.00; `product_price`
      keeps the list price.
  - **`/best-sellers?category=digital-text/<node>&type=BEST_SELLERS&page=N`**
    returns 50 books a page with rank, ASIN, title and price. Cozy Mystery
    page 1 matched Amazon: *Swamp Shoot* #1, *We Chase Shadows* #5. So a
    genre's top 100 is 2 requests, and its details are 10.
  - **The 100-book check (2026-10-06, Cozy Mystery, about 13 of the 100 free
    requests)** — 2 best-seller pages and 10 detail requests of 10 books each.
    - ~~A 10-book request counts as one request.~~ **Wrong, corrected the same
      day: each book almost certainly counts.**
      - The two tests together asked about roughly 105 books plus 3 list
        pages, and every call succeeded. That was read as proof of batching.
      - The very next calls — eight one-page list requests — all answered
        `429 Too Many Requests`, from Amazon API Gateway's usage-plan limiter.
      - A plan that "stops hard at 100", counting per book, which settles a
        little late, explains both.
      - Confirm on the OpenWeb Ninja dashboard before relying on either
        reading.
    - **Coverage:**
      - price 100, page count 100, file size 100
      - series 83
      - paperback price 83 (the rest are ebook-only)
      - publisher named 73 (27 show none)
    - **Kindle Unlimited: 80 of 100**, and the flag held up against the one
      free check that exists. A self-published Kindle Unlimited book must be
      sold only on Amazon, and none of the self-published books flagged in
      it (26 with no publisher, plus the writers' own imprints) was found on
      Apple Books.
      - The 10 flagged books that Apple *does* sell are all from traditional
        houses: Harper, William Morrow, Kensington, Pinnacle, Poisoned Pen,
        HarperVia, and Amazon's Thomas & Mercer. Those houses put chosen
        titles into Kindle Unlimited by agreement while selling them
        elsewhere, so this is not an error.
      - All 20 not-flagged books were on Apple, which is consistent.
    - **Self-published vs traditional needs three changes before it is used
      on Amazon data:**
      - a missing publisher means self-published (26 of 27 such books are in
        Kindle Unlimited)
      - Amazon's own imprints get a side of their own: Thomas & Mercer, Lake
        Union, Amazon Original Stories
      - these join `publishers.ts`: Poisoned Pen Press (Sourcebooks), Pinnacle
        (Kensington), HarperVia (HarperCollins), Pamela Dorman Books (Viking)
      - Writers' own imprints ("J&R Publishing", "Tonya Kappes Books") are
        correctly left self-published.
  - **Cost, counted per book (the likely reading):** a genre's top 100 with full
    details is 102 requests — 2 list pages and 100 books.
    - All 27 genres once: about 2,750 requests, $8.25 at $0.003 each.
    - Weekly, caching each book's details for 30 days so only new books are
      looked up (roughly 15 per genre per week): about 2,000 requests a month,
      **about $6**, or $10 at $0.005.
    - Daily: about $17 a month.
    - **The free 100 requests cannot fill even one genre**, so the Amazon view
      needs a pay-as-you-go plan before it can serve anyone.
    - The figures under this heading that said 12 requests a genre ($1.50 a
      month weekly) assumed batching.
    - Batched as 1: weekly about $2 a month, daily about $10, at $0.005 per
      request.
    - Counted per book: weekly about $10, daily about $25–28.
    - Both assume a guessed 15% of each list being new books each week.
  - **What it would change in the code:**
    - Treat a missing `Publisher` as self-published.
    - Add more imprints to `publishers.ts` — "Pamela Dorman Books" (Viking,
      PRH) would land on the wrong side today.
- **Facts recorded that day:** Amazon's Product Advertising API was retired in 2026. Its
  replacement, the Creators API, needs an Associates account with recent qualifying sales, so it
  is not an option yet.

## Verification (now)

- `npx vitest run src/lib/pricing src/lib/comps`, then the full suite on its own. Read the
  `Test Files N passed` line, not the exit code. Run `npx tsc --noEmit` separately, and
  `npm run lint` (baseline 7 errors / 11 warnings).
- Fetch every shelf once and record its count in `shelves.ts`. A shelf under about 50 books
  does not go in.
- `npx next dev`, then drive the screen in Chrome at desktop width and at 375px:
  - check that the 3-a-day limit fires on the 4th new genre
  - check that the stepper matches KDP's calculator at $0.99, $2.99, $4.99, $9.99, $12.99 and
    $13.99
  - check that the paperback figures match KDP's worked example
  - check the filters, the Amazon link, keyboard use, and the ruler's screen-reader text
  - with Apple unreachable, the screen says it could not fetch rather than showing an empty or
    cheap shelf
- `npm run build` to check the new Tailwind classes made it into the CSS.

## Sources checked on 2026-10-05

- Apple top-paid ebooks by genre (live fetch):
  `https://itunes.apple.com/us/rss/toppaidebooks/limit=100/genre=11259/json`
- Apple genre tree: `https://itunes.apple.com/WebObjects/MZStoreServices.woa/ws/genres?id=9032`
- KDP ebook list prices (70% from $2.99 to $12.99):
  https://kdp.amazon.com/en_US/help/topic/G200634560
- KDP delivery cost ($0.15/MB, minimum $0.01): https://kdp.amazon.com/en_US/help/topic/G200634500
- KDP paperback printing cost: https://kdp.amazon.com/en_US/help/topic/G201834340
- KDP paperback royalty (50% at or below $9.98, 60% from $9.99):
  https://kdp.amazon.com/en_US/help/topic/A1OYGQ0E1L4WBS
- KDP Select (Kindle Unlimited requires Amazon exclusivity):
  https://kdp.amazon.com/en_US/help/topic/G200798990
- PA-API retirement: https://affiliate-program.amazon.com/creatorsapi/docs/en-us/paapiv5-deprecation
- DataForSEO Amazon pricing: https://dataforseo.com/pricing/merchant/amazon-api
- Apify free plan ($5 a month): https://use-apify.com/docs/what-is-apify/apify-free-plan
