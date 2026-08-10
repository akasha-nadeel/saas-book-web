import { Children, isValidElement, type ReactNode } from "react";
import { TOOL_MARKS } from "@/components/shelf/tool-marks";
import { ALL_TOOLS, TOOL_GROUPS } from "@/lib/book-tools";

/**
 * The moving wall beside the hero headline — two columns of cards travelling
 * in opposite directions behind three perforated rails.
 *
 * **The mechanism, which is the part worth copying exactly.** Each column
 * holds its list of cards *twice* and translates from 0 to -50% (or -50% to 0
 * for the column going the other way) on a linear loop. Half the track is one
 * full copy, so the moment the animation restarts the pixels are identical and
 * the seam is invisible — no measuring, no JavaScript, no resize handling. The
 * column is `overflow-hidden` at a fixed height and the track is taller than
 * it, so what a reader sees is a window onto something continuous. Two
 * directions rather than one because a wall moving as a single sheet reads as
 * a page that is scrolling itself; opposed, it reads as depth.
 *
 * **What is on the cards is the sixteen tools, and that is the honest version
 * of this figure.** The layout this comes from shows the product's *output* —
 * finished websites — which for us would mean a wall of book covers. This app
 * does not make covers, refuses to generate them, and its own rule is that a
 * figure must not carry a picture of a book that does not exist. What it does
 * have sixteen of is tools, they are already the page's biggest counted claim,
 * and they come with marks designed to be recognised. So the wall is read
 * straight out of `ALL_TOOLS` with the marks the dashboard itself draws: it
 * cannot go stale, cannot flatter, and a tool leaving the product takes its
 * card with it.
 *
 * **It is decoration and says so.** `aria-hidden`, because every name on it is
 * also in the Tools section further down where it can be read at rest — a
 * screen reader announcing thirty-two cards it cannot stop moving is worse
 * than silence. It is hidden below `lg` for the same reason the reference
 * hides it: at those widths there is no room beside the headline, and a
 * moving wall *under* the one working control on the page competes with it.
 *
 * **And it stops for anyone who has asked for that.** `prefers-reduced-motion`
 * kills the animation in globals.css rather than the element, so the wall is
 * still there, still full of cards, simply still.
 */

/**
 * Split down the middle, in the order `book-tools.ts` groups them.
 *
 * Not interleaved and not shuffled: the groups are four coherent runs — find
 * your shelf, get it out, the writing, money and reviews — and cutting the
 * list in half keeps whole groups travelling together, so a reader who watches
 * one column for a few seconds sees a theme rather than a jumble.
 */
const HALF = Math.ceil(ALL_TOOLS.length / 2);
const COLUMNS = [ALL_TOOLS.slice(0, HALF), ALL_TOOLS.slice(HALF)];

/** Which group each tool belongs to, so a card can name its own shelf. */
const GROUP_OF = new Map(
  TOOL_GROUPS.flatMap((group) => group.tools.map((t) => [t.path, group.title])),
);

/* ---- Each card's colour, taken from its own mark -------------------------
 *
 * **Read out of the drawing rather than written down beside it.** Every card
 * is tinted with a pale version of its tool's own mark, which is what makes
 * sixteen cards sixteen different colours without anybody choosing sixteen
 * colours — and, more to the point, without a second table of hexes that goes
 * quietly out of step the first time a mark is redrawn. `TOOL_MARKS` are React
 * elements, so their fills can simply be walked.
 *
 * The rule is *the first fill that is not a highlight*. These marks are built
 * from a base shape plus lighter facets and white details, and the base is
 * almost always drawn first — so first-non-highlight lands on the mark's real
 * colour. The threshold has to be set with some care in both directions,
 * which is why it is a named constant with a number chosen against the actual
 * set rather than a round 0.5: too low and a genuinely light mark loses its
 * own colour (the ruler and the wallet are amber at 0.65, and excluding them
 * tints two cards in the dark brown of their shadow side), too high and a
 * pale top facet wins over the body beneath it (the trend mark opens on a
 * near-white blue). */

/** Perceived lightness, 0–1. Rec. 709 coefficients, which is enough to sort a
 *  base colour from a highlight and is not pretending to be a colour space. */
function lightness(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function fillsIn(node: ReactNode, found: string[] = []): string[] {
  Children.forEach(node, (child) => {
    if (!isValidElement(child)) return;
    const props = child.props as { fill?: unknown; children?: ReactNode };
    if (typeof props.fill === "string" && props.fill.startsWith("#")) {
      found.push(props.fill);
    }
    if (props.children) fillsIn(props.children, found);
  });
  return found;
}

/**
 * Above this, a fill is a highlight rather than the mark's own colour.
 *
 * Measured against the set as it stands: the lightest *base* is amber at 0.65
 * and the darkest *highlight* that opens a mark is a pale blue at 0.75. This
 * sits between them. Redraw a mark much lighter than the amber and it will
 * need moving.
 */
const HIGHLIGHT = 0.72;

function markColour(icon: string): string {
  const found = fillsIn(TOOL_MARKS[icon]);
  return (
    found.find((hex) => hex.length === 7 && lightness(hex) < HIGHLIGHT) ??
    /* Nothing dark enough — a mark drawn entirely in pale shapes. The page's
       own accent is the honest fallback: a wrong-looking tint is worse than a
       neutral one, and there is nothing to guess from. */
    "#6366f1"
  );
}

/**
 * The hue at a given strength, **mixed to an opaque colour** rather than laid
 * on as alpha.
 *
 * This started as alpha suffixes on the hex — `#2563eb14` and so on — which
 * was fine while a card was the only layer, and became the bug the moment
 * there was a layer *behind* one: a translucent card hides nothing, so the
 * offset shape meant to sit behind it showed straight through the card's own
 * body, and every card had a stray vertical and horizontal seam across it. A
 * card that is meant to occlude has to be opaque.
 *
 * Mixing against `--color-lp-ground` rather than picking pale hexes is what
 * keeps one table serving both themes: 7% of a blue into white is a wash, and
 * 7% of the same blue into #0b0b0e is a dark one — lighter than its ground in
 * daylight, lifted off its ground at night, which is the same intent both ways
 * round. A fixed pale hex would be a hole punched in the page after dark.
 *
 * It also brightens the cards, which is the reference's arrangement and better
 * than what came before: mixed with the page's card colour they sit *on* the
 * hero's tinted ground instead of dissolving into it.
 */
const mix = (hue: string, pct: number) =>
  `color-mix(in srgb, ${hue} ${pct}%, var(--color-lp-ground))`;

const CARD = 7; // the card itself
const PANEL = 16; // the panel the mark sits in

/**
 * The offset layer only, and the one place a *neutral* joins the hue.
 *
 * A pure tint of the hue reads as a second card; a little ink in it reads as a
 * second card *in shadow*, which is the thing this is standing in for. Small
 * on purpose — enough to weight the sliver, not enough to turn it grey.
 *
 * It mixes toward `--color-lp-ink` rather than toward black, which is what
 * makes one number work in both themes: the ink is near-black in daylight, so
 * this darkens, and near-white at night, so it lifts. Either way it moves the
 * layer *away* from the ground it sits on, which is the whole job.
 */
const BACK_INK = 14;

/**
 * How far the offset layer has to sit from the ground behind it, and why that
 * is not one mix percentage for all sixteen.
 *
 * **A fixed percentage does not buy a fixed amount of separation.** How far a
 * mix moves off the ground is roughly the percentage times how far the hue
 * itself is from that ground, so at one flat number the dark hues came out
 * about twice as distinct as the light ones — the two amber cards, whose mark
 * is `#f59e0b` at 0.65 lightness, had a layer behind them that was very nearly
 * the ground it sat on. That is not those two cards being wrong; it is the
 * flat number being wrong, and it would be wrong again for any pale mark added
 * later.
 *
 * So the percentage is solved for instead: `STEP` is the separation every card
 * should get, and each hue is given whatever mix reaches it. The dark hues are
 * unchanged — indigo still lands on the 12% that was settled on by eye — and
 * only the pale ones move, which is the whole of the fix.
 *
 * Two caveats worth knowing. It is solved for **daylight**, where the ground
 * is white and the distance is `1 − lightness`; after dark the ground is
 * near-black and the relationship inverts, so a pale hue gets more than it
 * strictly needs. That errs bright on a dark ground, which is the safe
 * direction — the layer still reads, and the alternative is a second table
 * keyed on a theme this can't see. And `MAX` is a stop, not a target: a mark
 * lighter than the amber would otherwise ask for a mix strong enough to
 * out-colour the card in front of it.
 */
const STEP = 6;
const MAX = 26;

const backPct = (hue: string) =>
  Math.min(MAX, Math.round(STEP / Math.max(0.3, 1 - lightness(hue))));

const backFill = (hue: string) =>
  `color-mix(in srgb, ${hue} ${backPct(hue)}%, color-mix(in srgb, var(--color-lp-ink) ${BACK_INK}%, var(--color-lp-ground)))`;

/** The hairline stays alpha: it is one pixel over an opaque card either way. */
const EDGE_TINT = "3d"; // ~24%

export function HeroWall() {
  return (
    /* `h-full`, not `h-dvh`: the caller sets the height by pinning this to the
       hero's own top and bottom, and a child claiming the viewport instead
       would stand taller than the section the moment the hero grows past one
       screen — which it does as soon as the headline wraps to four lines. */
    <div
      aria-hidden="true"
      className="flex h-full select-none items-start overflow-hidden"
    >
      <Rail top="5rem" />
      <Column tools={COLUMNS[0]} direction="up" />
      <Rail top="8rem" />
      <Column tools={COLUMNS[1]} direction="down" />
      <Rail top="4rem" />
    </div>
  );
}

/**
 * A column, and the doubled track inside it.
 *
 * The width is a clamp rather than a breakpoint ladder: this sits beside a
 * headline whose size is also fluid, and two things next to each other that
 * step at different widths is how a hero ends up looking broken at exactly one
 * window size.
 */
function Column({
  tools,
  direction,
}: {
  tools: typeof ALL_TOOLS;
  direction: "up" | "down";
}) {
  return (
    /* The clamp is a negotiation with the headline beside it, not a free
       choice: the wall is right-anchored and the text column is capped, and
       between them they have to leave a gap at every width from `lg` up.
       Widen this and the headline loses a line to wrapping.

       **`px-4` rather than `mx-2`, and that swap is what lets the cards cast
       separate shadows.** `overflow-hidden` clips at the padding box, so while
       the card was the full width of the column its shadow was sliced off flush
       at both edges — sixteen cards each contributing a vertical grey sliver,
       which joined up into one continuous smear down the sides of the column
       and read as a single shadow behind the whole stack. Moving the same
       space inside the clip gives each shadow somewhere to fall. The column
       is widened by what the padding takes so the cards themselves are the
       size they were. */
    <div className="relative h-full w-[clamp(214px,21vw,304px)] shrink-0 overflow-hidden px-4">
      {/* `gap-6`. The gap has to clear what each card throws, not merely
          separate the boxes: at the original `gap-3` the shadow landed squarely
          on the card below and the two merged into a band. What has to fit is
          the offset layer rising 12px off the card above plus its 3px blur,
          and the soft shadow falling below — about 20px between them, which is
          what makes 24px the floor rather than a preference. It stays uniform
          across the join between the two copies, which is what keeps the -50%
          loop seamless. */}
      <div
        className={`flex flex-col gap-6 ${
          direction === "up" ? "lp-scroll-up" : "lp-scroll-down"
        }`}
      >
        {/* Twice, deliberately — see the note at the top. `copy` is in the key
            because the same tool appears in both halves and React needs to
            tell the two apart. */}
        {[0, 1].map((copy) =>
          tools.map((tool) => (
            <Card key={`${copy}-${tool.path}`} tool={tool} />
          )),
        )}
      </div>
    </div>
  );
}

/**
 * One card: a tinted panel with the mark in it, then a chip, a title and the
 * description — the anatomy of the product card the reference uses.
 *
 * **The panel is the top two thirds and holds one thing.** That proportion is
 * what makes these read as *product* cards rather than as list rows with an
 * icon: the picture leads and the words explain it. Here the picture is the
 * tool's own mark, drawn large enough to be recognised at a glance, which is
 * the job those marks were designed for in the first place.
 *
 * **The chip names the group, and it is the one place a claim could creep
 * in.** It reads from `TOOL_GROUPS`, so it says what the dashboard says. The
 * reference's chips carry specifications; ours carries the only short fact
 * about a tool that is already written down.
 *
 * There is no grey second title line, which the reference has and this does
 * not. There is nothing honest to put in it: a subtitle for each of sixteen
 * tools would be sixteen new product claims invented for a decoration, and
 * these descriptions are held to the same rule as the landing page's own copy.
 * The description below carries that weight instead.
 */
function Card({ tool }: { tool: (typeof ALL_TOOLS)[number] }) {
  const hue = markColour(tool.icon);

  return (
    /*
     * **The depth here is a second card, not a shadow.**
     *
     * Three goes at a blur got closer and closer to the wrong thing. What the
     * reference actually shows is a *crisp* layer sitting behind the card and
     * offset from it — the shape you get from two sheets of paper on a desk,
     * with a hard edge and its own corners, rather than the shape you get from
     * a light source. A blur says "this is floating"; an offset duplicate says
     * "there is more than one of these", which is the truer thing to say about
     * a wall of sixteen tools.
     *
     * It is drawn in the tool's own hue at a step up from the card's fill, so
     * it reads as the same object twice rather than as grey furniture behind a
     * coloured card — and so it survives the dark theme, where a shadow does
     * nothing at all.
     *
     * The soft shadow stays underneath it, very light. Its job is no longer to
     * carry the depth, only to keep the pair from looking pasted onto the
     * page: the offset layer supplies the direction, the blur supplies the
     * contact.
     */
    <div className="relative h-[clamp(17rem,23vw,20rem)] shrink-0">
      <div
        aria-hidden="true"
        style={{ backgroundColor: backFill(hue) }}
        /* Up and to the left, which is where the reference throws it and the
           direction the earlier blur was already going. Twelve pixels against
           the column's sixteen of padding, so the edge never meets the clip —
           an edge cut off square is the one thing worse here than no edge.

           **`blur-[3px]`: softened, not blurred.** Three pixels is enough to
           take the printed-decal look off the sliver and not enough to lose
           its corners, which is what it is here for — this still has to read
           as a second card rather than as a light source. The number is
           bounded by the same padding: the blur spreads a few pixels past the
           translate, so a much larger one would put the tail into the clip and
           reintroduce the hard vertical line the offset was drawn to avoid. */
        className="absolute inset-0 -translate-x-3 -translate-y-3 rounded-xl blur-[3px]"
      />
      <div
        style={{
          backgroundColor: mix(hue, CARD),
          borderColor: hue + EDGE_TINT,
        }}
        /* **Two layers, no spread at all, and thrown to the left.**
         The first version was a single `0 14px 36px -20px` at 45% — a shape
         that looks strong written down and is invisible on the page, because
         a spread of -20px pulls the blur back inside a card only 12px wider
         than it. What reads as depth is the opposite arrangement: a wide,
         weak ambient layer that spills past the edges, plus a tight, weaker
         contact layer under the card to anchor it. Low opacity is what keeps
         that from becoming a grey halo.

         **The spread has to be exactly zero, and that is a shape rule rather
         than a taste one.** A negative spread shrinks the shadow's box *and
         its corner radius by the same amount* — at `-6px` against this card's
         `rounded-xl`, the shadow was drawn at a 6px radius behind a 12px one.
         The offset then pushed those squarer corners out past the card's
         rounder ones, so every card wore a hard-cornered rectangle a few
         pixels outside itself. Any spread here reintroduces it; strength has
         to come from the blur and the alpha instead.

         The horizontal offset is the part that makes sixteen shadows read as
         sixteen. Thrown straight down, each one falls into the gap above the
         next card and the column reads as one stack on one shadow; thrown to
         one side as well, each lands in open ground beside its own card,
         where nothing else is competing for the space. It is the same reason
         a single light source at an angle photographs a row of objects better
         than one directly overhead.

         It shows in daylight and does almost nothing at night, which is
         correct rather than a gap: a shadow on a near-black ground is
         invisible, so after dark the lift comes from the card's own tint and
         its hairline, exactly as the app's own elevation does. */
        className="relative flex h-full flex-col rounded-xl border p-2.5 shadow-[-6px_10px_20px_rgba(15,15,16,0.10),-2px_3px_6px_rgba(15,15,16,0.05)]"
      >
        <div
          style={{
            backgroundColor: mix(hue, PANEL),
            borderColor: hue + EDGE_TINT,
          }}
          /* One step tighter than the card's own, which is what keeps the two
           radii looking concentric rather than like two unrelated roundings. */
          className="flex min-h-0 flex-[1.6] items-center justify-center rounded-lg border"
        >
          {/* The real mark, imported. It is the thing a writer learns to find a
            tool by, and a lookalike drawn for marketing would be a second set
            to keep in step with the first. */}
          <svg
            viewBox="0 0 24 24"
            aria-hidden="true"
            className="h-[clamp(2.75rem,4.5vw,3.75rem)] w-[clamp(2.75rem,4.5vw,3.75rem)] drop-shadow-sm"
          >
            {TOOL_MARKS[tool.icon]}
          </svg>
        </div>

        <div className="flex flex-1 flex-col justify-center px-2.5 pt-3">
          <span
            style={{ borderColor: hue + EDGE_TINT }}
            className="w-fit rounded-full border bg-lp-ground/70 px-2 py-[3px] text-[0.625rem] font-medium text-lp-body"
          >
            {GROUP_OF.get(tool.path)}
          </span>
          <p className="mt-2 text-[1.0625rem] leading-tight font-bold tracking-tight text-lp-ink">
            {tool.name}
          </p>
          {/* **`lp-soft` and medium, not `lp-faint` at regular.** The caption
            ink the rest of the page uses for a line like this is tuned for the
            page's own flat ground; these sit on a colour wash, which lifts the
            ground toward the type and takes the contrast with it, and the card
            is moving besides. A line nobody can read in the two seconds it is
            on screen is a line not worth setting.

            Clamped rather than cut at a character count: these are the
            product's own descriptions and several run past two lines at this
            width, where a hard cut would leave a sentence ending mid-word on a
            card that is about to slide away. */}
          <p className="mt-1.5 line-clamp-2 text-[0.8125rem] leading-relaxed font-medium text-lp-soft">
            {tool.what}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The perforated rail between two columns.
 *
 * One element with a repeating gradient rather than sixty small `<div>`s,
 * which is what the reference does — same picture, one node, and nothing for
 * the browser to lay out sixty times.
 *
 * Each is dropped by a different amount so the three do not start on the same
 * line. Without the stagger they read as a printed grid; offset, they read as
 * three separate strips of film.
 */
function Rail({ top }: { top: string }) {
  return (
    <div
      style={{ marginTop: top }}
      className="h-full w-px shrink-0 [background-image:repeating-linear-gradient(to_bottom,var(--color-lp-edge)_0_2px,transparent_2px_12px)]"
    />
  );
}
