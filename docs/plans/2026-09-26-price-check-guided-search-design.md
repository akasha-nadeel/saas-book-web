# The price check's guided search — design note, 2026-09-26

Why the price check asks for a genre and two things rather than taking a
sentence, and what was measured to decide it. Every figure here is priced
records out of about a hundred Google Books records, swept five pages, US
store, on 2026-09-26. They are facts on a date and are meant to be re-run.

## The problem

The tool shipped with one empty text box. The first thing a writer typed into
it was their **book's title**, and a title is the one search that cannot work
here: Google knows prices for the books it *sells*, and a title mostly matches
the books it has merely *scanned*. A real search for `i love you` reported

> Only 3 of 53 books carried a price — too few to say what this shelf charges.

which is the screen being honest and useless at once.

## Three causes, and only one was the writer's words

### 1. The denominator counted books that were never candidates

"3 of 53" was the merged Google + Open Library result set. **Open Library
carries no prices, for any book, ever.** So about thirty of those fifty-three
could not have had one. The fix was `only=google` on `/api/comps`, which makes
the count honest and stops fetching five hundred Open Library records per
search only to throw them away.

That parameter needed a companion. `sources.openLibrary: false` already meant
*it failed*; letting it also mean *we never asked* would conflate two opposite
facts, so the response gained `asked`.

### 2. One page was too shallow, and its median was the wrong one

| query | priced, 1 page | 5 pages | median 1 → 5 |
|---|---|---|---|
| cozy mystery village murder | 10 | 35 | 4.99 → 4.99 |
| epic fantasy dragon kingdom war | 5 *thin* | 9 | 2.90 → 4.99 |
| thriller detective serial killer | 13 | 19 | 11.99 → 8.99 |
| small town contemporary romance | 5 *thin* | 12 | 9.99 → **5.99** |
| young adult dystopian rebellion | 4 *thin* | 9 | 16.79 → **9.99** |
| historical fiction world war two | 1 *thin* | 2 *thin* | 167 → 85.50 |
| space opera starship empire | 7 | 14 | 6.49 → 6.24 |
| psychological suspense unreliable narrator | 8 | 16 | 3.99 → 4.99 |
| paranormal romance vampire fated mates | 14 | 62 | 5.49 → 4.99 |
| literary fiction family secrets | 7 | 7 | 4.49 → 4.49 |

Thin searches fall from four in ten to one in ten. **The medians that move are
all small samples, and they move toward the commercial range**; the four that
already had seven or more prices do not move at all. So depth is not loosening
the figure — the shallow figure was being set by whichever academic or
reference edition Google ranked first.

An earlier note claimed depth could not help. That was measured on **two**
pages, where the count barely moves, and the conclusion survived into a comment
that then argued against the fix. The lesson is about the measurement, not
about Google.

### 3. `filter=paid-ebooks` is broken, and is the dead end to not retry

Google documents it and it would be exactly what this tool wants. Asked for
*paid* ebooks it returned `saleability: "FREE"` public-domain scans — *Catalog
of Copyright Entries*, *Principia Latina*. `filter=ebooks` and
`filter=free-ebooks` both returned **zero** priced records where the unfiltered
call returned three. `totalItems` is the same story: 300 for almost every
query.

## The form

A genre dropdown and two optional boxes. **No catch-all box** — removing it is
the point, because a labelled "where it happens" box does not invite a title.

### Why each shelf carries its own words

A bare genre is enough for a narrow shelf and hopeless for a broad one:

| genre alone | priced | with its measured extras |
|---|---|---|
| cozy mystery | 37 | 33 |
| young adult dystopian | 20 | 9 |
| paranormal romance | 18 | 62 |
| space opera | 11 | 14 |
| psychological suspense | 8 | 16 |
| epic fantasy | 6 | 9 |
| **thriller** | **4** | 19 |
| **contemporary romance** | **3** | 12 |
| **literary fiction** | **1** | 7 |

`literary fiction` found one price in a hundred books. A broad genre word
matches the whole scanned library; a narrow one matches a commercial shelf. So
`PRICE_SHELVES` is a table, not a list of genre names, and the three broad
shelves carry a qualifier in their `words`.

Three more candidates were measured for the gaps. `historical romance regency
duke` (30) and `horror haunted house` (12) and `memoir addiction recovery` (8)
went in; `historical fiction victorian london` (3, median $54.99) and `horror
supernatural small town` (1) and `historical fiction world war two` (2, median
$85.50) were refused. **The literary-historical shelf therefore has no row** —
that is a measurement, not an oversight.

### Why two boxes and not four

The same experiment gave opposite answers on two genres:

| search | records | priced |
|---|---|---|
| `cozy mystery village murder` | 98 | 33 |
| the same, plus five more words | 97 | **69** |
| `epic fantasy dragon kingdom war` | 99 | 8 |
| the same, plus four more words | **16** | 5 |

Nine words tripled one search and collapsed the other from 99 books to 16. So
the query is held to the shape that was measured — **a genre plus at most two
concrete words** — and a typed box *replaces* the shelf's extra words rather
than adding to them.

### The rule that keeps it honest

**The "Searching for" line prints exactly what the fetch sends.** Three shelves
search for more words than their own name, so showing the name alone would mean
searching for words the writer never saw.

### `subject:` is the trap in this cluster

Google answers a field-prefixed query out of its catalogue rather than its
store. `subject:"cozy mystery"` returned **0** priced records of 20, every one
`NOT_FOR_SALE`. Two consequences worth stating because both look like obvious
reuse:

- `buildQuery` in `comps.ts` **cannot** be used here — it appends
  `subject:"<Genre>"`.
- `BROWSE_SHELVES` **cannot** be the dropdown's list — the comps screen turns
  those into `subject:"…"`.

`PRICE_SHELVES` and `priceQuery` exist for that reason.

### A native `<select>` was written and replaced

Chrome changes a focused select's value on a mouse wheel. On the dashboard,
which scrolls, that meant scrolling past the card silently re-picked the genre
and the form then searched a shelf nobody chose — caught in the running app
within minutes. `ui/picker.tsx` is a menu of `menuitemradio` rows and does not
do it. Its own doc already argued against native selects on appearance grounds;
this is the behavioural half of the same case.

## What the result looks like, after a day's use

The chart that the early version drew — a number line with a dot per priced
book and the median marked — **came out the same day**. Its caption repeated
the headline figure, and the screen turned out to read as one number and its
evidence without it: a median, the range the middle half sits in, and the list
of books each price came from, each with its cover.

The middle-half range was the only fact the caption carried alone, so it moved
into the headline sentence. It prints only when the two ends differ, because on
a shelf where every book is $4.99 "half sit between $4.99 and $4.99" is true,
useless, and reads like a fault.

`price-strip.tsx` is kept whole and tested rather than deleted. The argument
for a chart is still good on its own terms — a genre's prices cluster in two
places and a chart is the only way to *see* that — so what its header carries
is the two objections that would have to be answered to bring it back.

## Standing obligations

- **Adding a shelf is a measurement, not a typing job.** Run the candidate
  against `/api/comps?sweep=1&only=google`, count the records carrying a price,
  and only then add the row — the rule `BROWSE_SHELVES` already follows.
- **The counts go stale slowly.** They are quoted nowhere on screen, so a drift
  costs accuracy in this file rather than a false claim to a writer.
- **The Google key is production-only on Vercel**, so a preview deploy shows no
  prices at all. That is the first thing to check when the tool looks broken.
