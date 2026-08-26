"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  DEFAULT_GENRE,
  GENRES,
  suggestTarget,
  targetHint,
} from "@/lib/book-kinds";
import {
  COVER_MAX_BYTES,
  COVER_MAX_EDGE,
  importImage,
} from "@/lib/image-import";
import { saveCover } from "@/lib/cover-save";
import {
  booksAgainstPlan,
  createBook,
  createBookFromImport,
  createMatterPages,
  rememberMatterAsked,
} from "@/lib/library-store";
import { setupFromImport } from "@/lib/import";
import { importSummary, type ImportedBook } from "@/lib/import/split";
import { showImportBanner } from "@/components/editor/import-banner-host";
import {
  SourceStep,
  isSourceKind,
  type SourceKind,
} from "@/components/shelf/source-step";
import type { MatterPart } from "@/lib/matter";
import {
  countPicked,
  defaultPicked,
  pagesLabel,
  picksFrom,
} from "@/lib/matter-picks";
import { MatterPartRows } from "@/components/editor/matter-rows";
import { SwitchTrack } from "@/components/ui/switch";
import { BookCover } from "@/components/shelf/book-cover";
import { LAUNCH_LIMITS } from "@/lib/launch";
import {
  UpgradeDialog,
} from "@/components/upgrade/upgrade-dialog";
import { usePlan } from "@/lib/use-plan";
import { useShelf } from "@/lib/use-library";

/**
 * The three steps between "New book" and the blank page.
 *
 * It exists to put a goal on the book before the writing starts, because a
 * target set afterwards is a target set against work already done. Everything
 * here has a usable default, so the whole thing can be cleared with Enter.
 *
 * A page rather than a modal: this is the start of the writing rather than an
 * interruption of something else, and it gets a URL of its own.
 *
 * **The front and back matter question moved here on 2026-08-15**, out of the
 * modal that used to meet the writer in the editor
 * (`editor/matter-setup-dialog.tsx`). It was the right question in the wrong
 * place: a writer who has just pressed "Create book" is looking at their
 * manuscript for the first time, and the first thing that happened was a
 * sixteen-row dialog about printer's terms landing on top of it. As two steps
 * of the setup it is asked while the writer is still *setting the book up*,
 * which is when they are answering questions anyway, and the editor opens on
 * the thing they came for.
 *
 * Four things about the flow are deliberate:
 *
 * - **Nothing is created until the last press.** `createBook` runs at the end
 *   of step three, so Back is lossless and leaving at step two leaves no book
 *   behind. The whole of a writer's answers live in this component's state
 *   until then.
 * - **The pages are made in one commit.** `createMatterPages` takes the whole
 *   list, so a dozen pages is one shelf write, one fan-out and one push rather
 *   than a dozen of each.
 * - **`rememberMatterAsked` is called whatever the answer**, including
 *   "nothing ticked". That is what stops the editor's dialog asking a question
 *   this screen has already put — `shouldAskMatter` is false by the time the
 *   book is opened.
 * - **Ticking nothing is the skip.** The dialog needed a Skip button because a
 *   modal with no way out but the primary action is a trap; a step with Back
 *   behind it and Next in front does not, and "Next" over an empty list is the
 *   same answer said more quietly.
 */

/**
 * The way back one question — the action bar's left-hand control.
 *
 * **A bordered surface rather than bare text**: as a plain muted label it read
 * as a caption sitting near the button rather than as the other thing you
 * could press. It takes the app's own elevation logic, so it is right in both
 * themes without a `[data-theme]` rule: `panel` lifted off the `surface` the
 * page is drawn on, with a hairline, deepening to `raised` on hover. Full ink
 * rather than muted now it has a ground under it — muted type inside a border
 * is what a disabled control looks like.
 *
 * It is a constant rather than an inline class because Cancel wore it too
 * until the red one moved to the top of the page; it is kept as one so the
 * *next* thing at this level cannot drift from it.
 */
const SECONDARY_ACTION =
  "rounded-md border border-line bg-panel px-4 py-2.5 font-sans text-sm " +
  "text-fg outline-none transition-colors hover:bg-raised " +
  "focus-visible:ring-2 focus-visible:ring-accent/60";

/** Which question the screen is on. */
type Step = "source" | "details" | "front" | "back";

/**
 * What the wizard remembers across a reload.
 *
 * **A refresh on step two used to give back an empty step one.** Title,
 * subtitle, author, genre, target and every ticked page, gone — three screens
 * of answers for one stray Ctrl+R, on the form somebody fills in once and cares
 * about most.
 *
 * `sessionStorage` rather than the store: this is a form in progress, not a
 * book. It belongs to the tab, dies with it, and must never outlive a Cancel —
 * three properties `localStorage` would get wrong. The store is also the wrong
 * home on principle: nothing here is a book until Create is pressed.
 *
 * **The cover and a parsed import are deliberately left out.** A cover is a
 * data URL and an import is a whole manuscript; either would blow the quota for
 * a form that may be abandoned. So a reload keeps the words and asks for the
 * picture again — and the screen says so rather than letting somebody wonder
 * where it went.
 */
const DRAFT_KEY = "openchapter:new-book";

interface Draft {
  step?: Step;
  title?: string;
  subtitle?: string;
  author?: string;
  genre?: string;
  ownTarget?: string | null;
  bare?: boolean;
  picked?: string[];
}

function readDraft(): Draft {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return {};
    const held: unknown = JSON.parse(raw);
    return held && typeof held === "object" ? (held as Draft) : {};
  } catch {
    /* A draft that will not parse is one nobody misses. */
    return {};
  }
}

function writeDraft(draft: Draft) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* Out of room: the form still works, it just stops remembering. */
  }
}

function clearDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(DRAFT_KEY);
  } catch {
    /* Nothing to do, and nothing depends on it. */
  }
}


/** The name of each step, for the indicator under the heading. */
const STEP_NAMES: Record<Step, string> = {
  source: "Your manuscript",
  details: "Your book",
  front: "Before the story",
  back: "After the story",
};

/**
 * The road this particular book takes, which is not the same for all four ways
 * in.
 *
 * **`source` only when one was asked for.** A blank book has no manuscript to
 * bring in, and a step that exists to be skipped is a step.
 *
 * **The two matter steps drop out when the file already answered them.** Only
 * an EPUB says which of its pages are front and back matter, and `importFile`
 * keeps what it said. Asking a writer to tick a dedication for a book that
 * already contains one would either duplicate the page or quietly overwrite the
 * answer the file gave — so the questions are put to the formats that cannot
 * answer them (.txt, .md, .docx) and not to the one that can.
 */
function stepsFor(source: SourceKind | null, declaresMatter: boolean): Step[] {
  return [
    ...(source ? (["source"] as const) : []),
    "details" as const,
    ...(declaresMatter ? [] : (["front", "back"] as const)),
  ];
}

/**
 * The question at the top of a matter step.
 *
 * Split from the dialog's single "What goes before and after your story?",
 * which had to name both ends because it showed both at once. One end at a
 * time can ask about that end, which is a shorter question and a clearer one.
 */
const MATTER_HEADINGS: Record<MatterPart, string> = {
  front: "What goes before your story?",
  back: "What goes after your story?",
};

/**
 * The form, and the one-line shell that decides when it may read a draft.
 *
 * **The draft cannot be read on the server**, which has no session storage —
 * seeding the fields from it directly made the two renders disagree (step one
 * on the server, step two in the browser), so React threw the tree away and
 * rebuilt it, logging a hydration error every time the page opened. Caught
 * while testing this very fix.
 *
 * `useSyncExternalStore` with a server snapshot of `false` is how this codebase
 * already answers "has the browser taken over" (`useHydrated`). The `key` then
 * does the rest: the form mounts once with nothing, and again with the draft,
 * so every lazy initialiser inside it runs at a moment when reading storage is
 * safe. One extra mount of an unfilled form, against an error on every load.
 */
export function NewBookForm() {
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  return <NewBookFields key={mounted ? "draft" : "blank"} mounted={mounted} />;
}

function NewBookFields({ mounted }: { mounted: boolean }) {
  const router = useRouter();
  const shelf = useShelf();
  const plan = usePlan();
  const storedBookCount = booksAgainstPlan(shelf).length;
  /* `!plan.loading` rather than `plan.loading ||`, which is the fix the
     dashboard's restore gate carries the long note on: `usePlan()` starts at
     UNKNOWN with `pro: false`, so gating while it loads refuses a Pro writer
     for the width of one request. Not knowing yet is not a reason to refuse,
     and the Postgres trigger is what actually enforces this. */
  const freeBookLimitReached =
    !plan.loading &&
    plan.billing &&
    !plan.pro &&
    storedBookCount >= LAUNCH_LIMITS.freeBooks;

  /* Which door the writer came through, from `?source=`. Read with
     `useSearchParams` for the reason the dashboard's `?area=` is: a lazy
     initialiser reading `window.location` sees the previous URL during a client
     navigation, and every one of these arrives by client navigation from the
     shelf's menu. Anything that is not one of the three is treated as a blank
     book rather than trusted — the same lookup-against-a-fixed-set that
     `areaLabel` and `safeNext` make. */
  const params = useSearchParams();
  const source: SourceKind | null = isSourceKind(params.get("source"))
    ? (params.get("source") as SourceKind)
    : null;
  /**
   * The saved draft, applied **after** the first paint rather than during it.
   *
   * **Seeding the state from `sessionStorage` directly was a hydration
   * mismatch**, and a real one: the server has no session storage, so it
   * rendered step one while the browser rendered step two, React threw the
   * whole tree away and rebuilt it, and the console carried an error on every
   * load. Caught while testing this very fix.
   *
   * So the form starts as the server drew it and the draft is put on in an
   * effect. The cost is one frame; the alternative is a page that logs an
   * error every time it opens.
   */
  /**
   * True once the browser has taken over from the server.
   *
   * **This is what keeps the draft off the first render.** The server has no
   * session storage, so seeding the fields from it directly made the two
   * renders disagree — step one on the server, step two in the browser — and
   * React threw the tree away and rebuilt it, logging an error every time the
   * page opened. Caught while testing this very fix.
   *
   * `useSyncExternalStore` with a server snapshot of `false` is the pattern
   * this codebase already uses for exactly this (`useHydrated`): the first
   * client render matches the server, and the second has the draft.
   */
  /* Safe to read now: this component only mounts with `mounted` true after the
     browser has taken over. See `NewBookForm` above. */
  const [restored] = useState<Draft>(() => (mounted ? readDraft() : {}));
  const draftRead = mounted;

  const [kind, setKind] = useState<SourceKind>(source ?? "file");

  /** The parsed manuscript, once a source step has read one. */
  const [imported, setImported] = useState<ImportedBook | null>(null);
  /** A refused write at the very last press — storage full, most likely. */
  const [saveError, setSaveError] = useState<string | null>(null);
  /* The plan running out is not one of those, and used to be printed as one:
     the same red line in the footer, next to a button that still looked
     pressable. It is a comparison now, and `saveError` is left to mean what it
     says — something went wrong. */
  const [showUpgrade, setShowUpgrade] = useState(false);

  /* Seeded from the draft, so a reload keeps the answers. Lazy initialisers:
     read once, on the first render, never on every keystroke after. */
  const [title, setTitle] = useState(() => restored.title ?? "");
  const [subtitle, setSubtitle] = useState(() => restored.subtitle ?? "");
  const [author, setAuthor] = useState(() => restored.author ?? "");
  const [cover, setCover] = useState<string | null>(null);
  /** The picked file, kept so the full-size copy can be stored once the book
   *  has an id — see the submit handler. */
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverError, setCoverError] = useState<string | null>(null);
  /* Whether the artwork carries its own words — see `bareCover`. Asked here
     because this is where the cover is first chosen: a writer bringing a
     designed jacket already knows it has its title on it, and making them
     save, find the book and open a dialog to say so is asking them to fix
     something we let them create wrong. */
  const [bare, setBare] = useState(() => restored.bare ?? false);
  const coverInput = useRef<HTMLInputElement>(null);
  const [genre, setGenre] = useState<string>(() => restored.genre ?? DEFAULT_GENRE);

  // The target follows the genre until the writer types their own, at which
  // point it stops moving. Overwriting a number somebody deliberately entered
  // because they then changed the genre is the kind of thing that makes a form
  // feel like it is arguing with you.
  const [ownTarget, setOwnTarget] = useState<string | null>(
    () => restored.ownTarget ?? null,
  );
  const suggested = suggestTarget(genre);
  const target = ownTarget ?? String(suggested);

  /* **The step comes back too — except on an import.** A parsed manuscript is
     far too big for a draft slot, so a reload has genuinely lost the file; the
     honest answer is to start at the step that asks for one again rather than
     drop somebody on "details" for a book with no source. */
  const [step, setStep] = useState<Step>(() =>
    source ? "source" : (restored.step ?? "details"),
  );

  /* Whether the file said which pages are its front and back matter. Only an
     EPUB does; everything else leaves this false and keeps both steps. */
  const declaresMatter = (imported?.chapters ?? []).some((c) => c.matter);
  const STEPS = stepsFor(source, declaresMatter);
  /* **Which way the writer just travelled**, so the incoming panel can slide
     in from the side it is arriving from. It is state rather than something
     derived from the old and new step because the *stepper* can also move the
     writer, and from step three its numbered 1 is a jump of two — the panel
     still has to come from the left, which comparing indices gets right and a
     bare `didGoBack` flag on the two buttons would not. */
  const [direction, setDirection] = useState<"next" | "back">("next");

  /* Both ways of changing step go through here so neither can forget the
     direction, and so the animation cannot end up describing the wrong move. */
  const goTo = (to: Step) => {
    setDirection(STEPS.indexOf(to) < STEPS.indexOf(step) ? "back" : "next");
    setStep(to);
  };

  /* The ticked pages, held across both matter steps in one set — keyed
     "part:title", so the two steps write into the same store without being
     able to collide. See `matter-picks.ts`. */
  const [picked, setPicked] = useState<Set<string>>(() =>
    /* `defaultPicked` is itself a lazy initialiser, so it is called rather
       than handed over once there is a draft to prefer. */
    /* Copied either way: `defaultPicked()` hands back a set this component
       then owns, and adopting it directly is what the immutability rule
       objects to. */
    new Set(restored.picked ?? defaultPicked()),
  );

  /* **Kept in step with the form rather than written at each control.** Nine
     fields set a draft from eleven places; an effect on the values is one
     place, and cannot be forgotten by whichever control is added next. */
  useEffect(() => {
    if (!draftRead) return;
    writeDraft({
      step,
      title,
      subtitle,
      author,
      genre,
      ownTarget,
      bare,
      picked: [...picked],
    });
  }, [draftRead, step, title, subtitle, author, genre, ownTarget, bare, picked]);

  const toggle = (key: string) =>
    setPicked((was) => {
      const next = new Set(was);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  /* **Focus moves to the new step's heading.** A wizard that swaps its own
     contents underneath a keyboard or a screen reader leaves both where the
     old step was — the reader announces nothing and Tab resumes from a control
     that no longer exists. The heading takes `tabIndex={-1}` so it can be
     focused without joining the tab order. The details step is skipped: it
     holds the autofocused title field, and stealing that on the way back would
     undo the one bit of focus the screen already gets right. */
  const headingRef = useRef<HTMLHeadingElement>(null);
  const scrollRef = useRef<HTMLElement>(null);
  useEffect(() => {
    if (step !== "details") headingRef.current?.focus();
    scrollRef.current?.scrollTo({ top: 0 });
  }, [step]);

  const create = () => {
    if (freeBookLimitReached) {
      setShowUpgrade(true);
      return;
    }

    const words = Number.parseInt(target.replace(/[^0-9]/g, ""), 10);

    /* **One set of answers, whichever door was used.** What the writer typed on
       the details step wins over what the file said — they have just been shown
       both and edited one — but everything the file knew and this form never
       asks for (the ISBN, the language, the description an EPUB carries) rides
       in underneath from `setupFromImport`. That is the whole point of routing
       imports through this screen: an imported book used to arrive with a title
       and nothing else, because the dialog that made it asked nothing else. */
    const setup = {
      ...(imported ? setupFromImport(imported) : {}),
      subtitle: subtitle.trim() || undefined,
      author: author.trim() || undefined,
      cover: cover ?? undefined,
      bareCover: bare,
      genre,
      // A cleared or nonsense field means no goal rather than a goal of zero.
      targetWords: Number.isFinite(words) && words > 0 ? words : undefined,
    };

    const made = imported
      ? createBookFromImport(
          title.trim() || imported.title || "Untitled Book",
          imported.chapters,
          setup,
        )
      : createBook(title.trim() || "Untitled Book", setup);

    if (!made) {
      setSaveError(
        "That book could not be saved — it may be too large for this browser's storage.",
      );
      return;
    }
    const { bookId, chapterId } = made;

    /* **The pages the last two steps asked for, in one commit.** Binding order
       comes from `picksFrom` rather than from the order they were ticked in,
       so a dedication ticked after a prologue still lands in front of it.

       **Only when those steps were actually shown.** `picked` starts at
       `defaultPicked()`, so a book whose matter steps were skipped — an EPUB,
       which already carries its own — would otherwise be given a dedication and
       two back pages nobody ticked, on top of the ones the file brought. Caught
       on a real import: seven pages came out of a file that had four. A
       question that was not asked has no answer to act on. */
    const picks = declaresMatter ? [] : picksFrom(picked);
    if (picks.length > 0) createMatterPages(bookId, picks);

    /* **Whatever they answered, the question has been put.** Without this the
       editor's own setup dialog opens over the manuscript a second later and
       asks it again — and for a writer who ticked nothing on purpose, that is
       the app refusing to take "none" for an answer. */
    rememberMatterAsked(bookId);

    /* **The full-size artwork, once there is a book to hang it on.**
       `createBook` takes the thumbnail because that is what the shelf needs
       synchronously; the copy the EPUB packages goes to IndexedDB and needs
       the id that only exists on this line. Deliberately not awaited — the
       writer is on their way to the editor, the thumbnail is already stored,
       and a failure here costs export resolution rather than a cover. */
    if (coverFile) void saveCover(bookId, coverFile);

    /* Chapter one, not the first matter page. The dialog lands on the page it
       just made because the writer was already in the book and asked for it;
       somebody who has just created a book came here to write it.

       **`?new=1` is the one-shot signal that this is an arrival**, and it
       exists because the editor's entrance animation is deliberately *not*
       mount-based: opening a chapter remounts the editor, so playing on mount
       meant a writer clicking down a list of forty chapters watched the panel
       reassemble forty times. `entering` is therefore false by default and set
       by the control that changes the panel's face. Creating a book is the
       other moment that earns it — the three matter cards are being seen for
       the first time, with the pages this screen just made in them — and a
       query parameter is how the rest of the app carries this kind of arrival
       state (`?area=`, `?from=`, `?open=`). The editor drops it from the URL
       once it has played. */
    /* **Only when a file was read.** A book started from scratch has nothing
       to report — its one chapter is not a guess. The count is what the
       *import* decided, which is what the banner claims; the pages `picks`
       just added are ones the writer ticked two steps ago and are not part of
       that answer. See `importSummary`. */
    if (imported) showImportBanner(bookId, importSummary(imported.chapters));

    /* The form's answers became a book, so the draft has nothing left to
       protect — and leaving it would greet the *next* new book with the last
       one's title. */
    clearDraft();

    router.push(`/book/${bookId}/chapter/${chapterId}?new=1`);
  };

  /* One handler for the form's submit, so Return does what the primary button
     does at every step rather than creating the book from step one.

     Driven off `STEPS` rather than a chain of named steps, because the road is
     no longer the same for every book: a blank one has three steps, an EPUB
     import has two, and a pasted manuscript has four. The last step creates,
     whichever step that turns out to be. */
  const at = STEPS.indexOf(step);
  const isLast = at === STEPS.length - 1;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    // The source step is left by reading a manuscript, not by pressing on.
    if (step === "source") return;
    if (isLast) create();
    else goTo(STEPS[at + 1]);
  };

  const back = () => goTo(STEPS[Math.max(0, at - 1)]);

  return (
    <main
      ref={scrollRef}
      className="scroll-slim h-[var(--oc-layout-height)] overflow-y-auto bg-surface px-4 pt-[max(1.5rem,var(--oc-safe-top))] pb-[max(2rem,var(--oc-safe-bottom))] sm:py-12"
    >
      {/* `pt-14` below `sm` is the room the absolute Cancel needs. The heading
          is centred and the button is out of the flow, so on a phone the two
          would otherwise occupy the same line and the title would run under
          it; from `sm` up there is width for both and they sit level. Padding
          rather than a margin on the heading, which would collapse through
          this box and take the button down with it. */}
      <div className="relative mx-auto w-full max-w-5xl pt-14 sm:pt-0">
        {/* **The way out of the whole flow, at every step.**
            Cancel used to sit in the action bar and only on step one, where
            Back replaced it afterwards — so from step two the only way to
            abandon a setup was to walk back through it. A wizard needs one
            escape that does not depend on which question you are on, and the
            top right is where every product this is measured against puts it.

            Red, and the `stop` family rather than a filled `bg-danger`: this
            is the one control here that throws work away, so it should not
            look like the greys around it — but a solid red slab is the shape
            an app uses for *confirming* a deletion, and nothing has been
            created yet for this to destroy. The tint is stated in both theme
            blocks (pale ground with dark red ink by day, near-black ground
            with saturated ink at night), so it is legible either way without
            a `[data-theme]` rule.

            Absolutely positioned so the heading stays optically centred on
            the page rather than being pushed off by a control in the flow
            beside it. */}
        <Link
          href="/"
          /* **Cancel means cancel.** A draft that survived it would put the
             abandoned title into the next new book, which is the one way this
             slot could do harm. */
          onClick={clearDraft}
          className="absolute top-0 right-0 z-10 rounded-md border border-stop-line
                     bg-stop-bg px-4 py-2 font-sans text-sm font-medium text-stop-fg
                     outline-none transition-colors hover:border-stop-fg
                     focus-visible:ring-2 focus-visible:ring-stop-fg/60"
        >
          Cancel
        </Link>

        {/* The title of the *task*, held still across all three steps. What
            changes is the question on the card below it — a heading that
            renamed itself every step would make three steps read as three
            screens the writer had been moved between. */}
        <h1 className="text-center font-serif text-3xl text-fg">
          Create a new book
        </h1>

        <Stepper step={step} steps={STEPS} onGo={goTo} />

        {/* **The source step stands alone, outside the two-column layout.**
            Everything after it is a question *about* a book, drawn beside the
            cover being built; this one is the step where there is not a book
            yet. Reading a manuscript moves the writer on by itself — there is
            nothing to press once a file has been chosen, and a Next button
            under a drop zone would be a second way to do the thing the drop
            already did. The title comes from the file and is editable on the
            very next step. */}
        {step === "source" ? (
          <div className="mt-8">
            <SourceStep
              kind={kind}
              onKind={setKind}
              onBook={(book) => {
                setImported(book);
                if (!title.trim()) setTitle(book.title);
                if (book.author && !author.trim()) setAuthor(book.author);
                if (book.cover && !cover) setCover(book.cover);
                goTo("details");
              }}
            />
          </div>
        ) : (
        <form onSubmit={submit} className="mt-8">
          {/* **Two boxes rather than one column**, at the owner's request: the
              cover on the left, everything a shop or a shelf reads on the
              right. The split is not arbitrary — the left box is the one
              thing on this form you *look* at, and the right is the one you
              *fill in*, so the preview stops being a thing you scroll past
              on the way to the fields and sits beside them while they are
              typed. The title, subtitle and author all print on that cover,
              and until now a writer could not see it happen without
              scrolling back up.

              It stacks below `lg`. Two 20rem columns on a phone would be
              two unreadable ones, and the order it stacks in is the order
              it reads in: the cover first, because that is the half that
              explains what the fields are for. */}
          {/* **Two columns at every step, and the cover is the constant one.**
              It was step one's alone, with the matter questions taking the
              whole width after it — which made the three steps read as two
              different screens, and threw away the thing this box is for. The
              preview is built from the title, subtitle and author typed on
              step one, so carrying it forward keeps the book being made in
              front of the writer while they answer questions *about* that
              book. It also holds the page still: the left edge of the
              questions, the gutter and the margins do not move between steps,
              so Next reads as the panel beside it changing rather than as a
              navigation. */}
          <div className="grid gap-5 lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start">
            <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
              <div className="mt-6">
                <p className="font-sans text-sm font-medium text-fg">
                  Cover
                  <span className="ml-2 text-xs font-normal text-muted">
                    optional
                  </span>
                </p>

                <div className="mt-1.5 flex items-start gap-4">
                  <div className="w-24 shrink-0">
                    <BookCover
                      title={title.trim() || "Untitled Book"}
                      subtitle={subtitle.trim() || undefined}
                      author={author.trim() || undefined}
                      words={0}
                      image={cover}
                      bare={bare}
                    />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap gap-2">
                      {/* Filled with `bg-fg`/`text-surface`, never a literal
                    black — the pair inverts *with* the palette, so this is
                    near-black carrying white by day and near-white carrying
                    black at night. The same control on the shelf's edit
                    dialog is drawn the same way. Not `bg-accent`: the accent
                    means "the way forward", and the way forward here is the
                    button at the foot of the form. */}
                      <button
                        type="button"
                        onClick={() => coverInput.current?.click()}
                        className="rounded-md bg-fg px-3 py-2 font-sans text-sm
                             font-medium text-surface outline-none
                             transition-opacity hover:opacity-90
                             focus-visible:ring-2 focus-visible:ring-accent/60"
                      >
                        {cover ? "Replace image" : "Choose image"}
                      </button>
                      {cover && (
                        <button
                          type="button"
                          onClick={() => {
                            setCover(null);
                            setCoverFile(null);
                            /* The words come back with the artwork's departure: a
                         typeset face *is* the title, so a book left "bare"
                         with no picture would be a blank cloth cover. */
                            setBare(false);
                            setCoverError(null);
                          }}
                          className="rounded-md px-3 py-2 font-sans text-sm
                               text-muted outline-none transition-colors
                               hover:bg-stop-bg hover:text-danger
                               focus-visible:ring-2 focus-visible:ring-accent/60"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <p className="mt-2 font-sans text-xs text-muted">
                      Resized and stored in this browser. Without one, the cover
                      is typeset from the title.
                    </p>

                    {coverError && (
                      <p
                        role="alert"
                        className="mt-2 font-sans text-xs text-danger"
                      >
                        {coverError}
                      </p>
                    )}
                  </div>
                </div>

                {/* **Only once there is artwork**, because `BookCover` ignores
              the flag without it: a typeset face *is* the title, so
              hiding the words there would leave a blank cloth cover.

              The hint is the load-bearing half. The fields above stay in
              the book and go on driving the EPUB's metadata, the title
              page and the shop listing — this changes the picture and
              nothing else — and a writer who reads "hide the title"
              without that has every reason to think they are deleting
              it. Same sentence as the shelf's edit dialog, so the two
              places this can be set say the same thing. */}
                {cover && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={bare}
                    onClick={() => setBare(!bare)}
                    className="mt-4 flex w-full items-start gap-3 rounded-md border
                         border-line px-3 py-3 text-left outline-none
                         transition-colors hover:bg-raised
                         focus-visible:ring-2 focus-visible:ring-accent/60"
                  >
                    <SwitchTrack on={bare} className="mt-0.5" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-sans text-sm font-medium text-fg">
                        The artwork already has the words on it
                      </span>
                      <span className="mt-0.5 block font-sans text-xs text-muted">
                        Show the picture as it is, with no title, subtitle or
                        author printed over it. The fields above are still used
                        for the shops and the exported book.
                      </span>
                    </span>
                  </button>
                )}

                <input
                  ref={coverInput}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Choose a cover image"
                  className="sr-only"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    // Reset, or choosing the same file twice fires nothing.
                    e.target.value = "";
                    if (!file) return;

                    setCoverError(null);
                    /* The book does not exist yet, so there is nowhere to put the
                 full-size artwork — `saveCover` needs an id. The thumbnail
                 is held in component state and the file with it; both are
                 handed to `saveCover` once the book has been created. */
                    const result = await importImage(file, {
                      maxEdge: COVER_MAX_EDGE,
                      maxBytes: COVER_MAX_BYTES,
                      encode: "jpeg",
                    });
                    if (result.ok) {
                      setCover(result.src);
                      setCoverFile(file);
                    } else setCoverError(result.error);
                  }}
                />
              </div>
            </div>

            {/* The right column is whichever question the step is on.
                **`key={step}` is what replays the animation.** A CSS animation
                fires when the element mounts, so without a key React would
                reuse this div across the change, swap its children and run
                nothing. The key makes each step a fresh element, which is also
                why the class can be chosen per direction. */}
            <div
              key={step}
              className={`min-w-0 ${
                direction === "back" ? "oc-step-in-back" : "oc-step-in-next"
              }`}
            >
              {/* **`hidden` rather than a second branch of the ternary**, which
                is a readability choice rather than a state one: everything
                typed here lives in the parent, so this box is free to come and
                go, and the key above remounts it either way. One attribute
                takes it out of the layout *and* out of the accessibility tree,
                where wrapping a hundred and fifty lines of form in a second
                conditional would bury the matter card that follows it. */}
              <div
                hidden={step !== "details"}
                className="rounded-xl border border-line bg-panel p-5 sm:p-6"
              >
                <label className="block font-sans text-sm">
                  <span className="font-medium text-fg">Book title</span>
                  <input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Untitled Book"
                    autoFocus
                    className="mt-1.5 w-full rounded-md border border-line bg-panel
                       px-3 py-2.5 text-fg placeholder:text-muted
                       focus-visible:border-accent focus-visible:outline-none"
                  />
                </label>

                <label className="mt-6 block font-sans text-sm">
                  <span className="font-medium text-fg">Subtitle</span>
                  <span className="ml-2 text-xs text-muted">optional</span>
                  <input
                    value={subtitle}
                    onChange={(e) => setSubtitle(e.target.value)}
                    placeholder="A novel"
                    className="mt-1.5 w-full rounded-md border border-line bg-panel
                       px-3 py-2.5 text-fg placeholder:text-muted
                       focus-visible:border-accent focus-visible:outline-none"
                  />
                </label>

                <label className="mt-6 block font-sans text-sm">
                  <span className="font-medium text-fg">Author</span>
                  <span className="ml-2 text-xs text-muted">optional</span>
                  <input
                    value={author}
                    onChange={(e) => setAuthor(e.target.value)}
                    placeholder="Your name"
                    autoComplete="name"
                    className="mt-1.5 w-full rounded-md border border-line bg-panel
                       px-3 py-2.5 text-fg placeholder:text-muted
                       focus-visible:border-accent focus-visible:outline-none"
                  />
                </label>

                {/* **"What are you writing?" was here** — novel, novella or short
                  story as three cards — and came off on 2026-08-15. It scaled
                  the target below and nothing else, and that number is a box
                  the writer can type over; it was also the only field on this
                  form with nowhere to change it later. See the note at the top
                  of `book-kinds.ts`. */}
                <label className="mt-6 block font-sans text-sm">
                  <span className="font-medium text-fg">Genre</span>
                  <select
                    value={genre}
                    onChange={(e) => setGenre(e.target.value)}
                    className="mt-1.5 w-full rounded-md border border-line bg-panel
                       px-3 py-2.5 text-fg focus-visible:border-accent
                       focus-visible:outline-none"
                  >
                    {GENRES.map((g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="mt-6 block font-sans text-sm">
                  <span className="font-medium text-fg">Target word count</span>
                  <input
                    value={target}
                    onChange={(e) => setOwnTarget(e.target.value)}
                    inputMode="numeric"
                    className="mt-1.5 w-full rounded-md border border-line bg-panel
                       px-3 py-2.5 tabular-nums text-fg
                       focus-visible:border-accent focus-visible:outline-none"
                  />
                </label>
                <p className="mt-1.5 font-sans text-xs text-muted">
                  {ownTarget === null
                    ? targetHint(genre)
                    : `Suggested for this is ${suggested.toLocaleString()}.`}
                </p>
              </div>

              {/* The matter questions take the same slot the fields do, so the
                two panels are the same box with a different question in it. */}
              {step !== "details" && (
                <div className="rounded-xl border border-line bg-panel p-5 sm:p-6">
                  <h2
                    ref={headingRef}
                    tabIndex={-1}
                    className="font-serif text-xl text-fg outline-none"
                  >
                    {MATTER_HEADINGS[step]}
                  </h2>
                  {/* The dialog's own words, and they carry the same weight here:
                  "tick the ones this book needs" over eight identical rows
                  reads as a list to complete, and a writer who completes it
                  ships an empty epigraph — which is worse for them at a shop
                  than having neither, since Kobo refuses listings that look
                  unfinished. */}
                  <p className="mt-1.5 max-w-prose font-sans text-sm leading-relaxed text-muted">
                    No shop requires any of these, so tick only what you will
                    actually write — a page left empty is left out of your
                    exports.
                  </p>

                  <fieldset className="mt-5">
                    <legend className="sr-only">{MATTER_HEADINGS[step]}</legend>
                    <MatterPartRows
                      part={step}
                      picked={picked}
                      onToggle={toggle}
                    />
                  </fieldset>
                </div>
              )}
            </div>
          </div>

          {/* **The action bar is one row at every step**, so the way forward
              never moves — same width, same place, whichever question is
              above it. It carries movement *within* the flow only: Back on the
              left, the single filled control on the right. Leaving the flow
              altogether is the red Cancel at the top of the page, which is
              there at every step — it used to be this bar's left-hand control
              on step one, and two Cancels would be two controls for one
              action. Step one therefore has nothing on the left, which is
              correct rather than empty: there is no previous question. */}
          <div className="sticky bottom-0 z-10 mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-line bg-surface/95 py-3 pb-[max(0.75rem,var(--oc-safe-bottom))] backdrop-blur sm:static sm:border-0 sm:bg-transparent sm:py-0 sm:backdrop-blur-none">
            {/* `gap-3`, not the `gap-1` a bare text button wanted: the control
                has an edge now, and a caption tucked against it reads as part
                of the button. */}
            <div className="flex min-w-0 items-center gap-3">
              {at > 0 && (
                <button
                  type="button"
                  onClick={back}
                  className={SECONDARY_ACTION}
                >
                  Back
                </button>
              )}
              {/* **What is ticked, and that none of it is permanent.** The
                  count is here rather than on the button because the button
                  says "Next" at both steps and a control that changes width as
                  you tick is a control that moves under the pointer. Hidden on
                  a narrow screen, where the two controls need the room. */}
              {(step === "front" || step === "back") && (
                <p className="hidden font-sans text-xs text-muted sm:block">
                  {pagesLabel(countPicked(picked, step))} selected. You can add
                  or delete any of these later.
                </p>
              )}
              {saveError && (
                <p
                  role="alert"
                  className="font-sans text-xs"
                  style={{ color: "var(--color-danger)" }}
                >
                  {saveError}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="rounded-md bg-accent px-5 py-2.5 font-sans text-sm
                         font-semibold text-accent-ink outline-none
                         transition-colors hover:bg-accent-strong
                         focus-visible:ring-2 focus-visible:ring-accent/60"
            >
              {isLast ? "Create book" : "Next"}
            </button>
          </div>
        </form>
        )}
      </div>

      {showUpgrade && (
        <UpgradeDialog reason="books" onClose={() => setShowUpgrade(false)} />
      )}
    </main>
  );
}

/**
 * Where the writer is, and how much is left.
 *
 * **A wizard with no indicator is a wizard with no end**, which is the whole
 * job here: pressing "Next" on a screen that gave no sign it was the first of
 * three is how a two-minute setup starts feeling open-ended. Few enough to name
 * each one rather than counting them, and the names are the questions —
 * "Before the story" says what is coming in a way "Step 2" cannot.
 *
 * **The list is passed in, because it is no longer always the same three.** A
 * blank book answers three questions, a pasted manuscript four, and an EPUB two
 * — the file having already said which of its pages are front and back matter.
 * Numbering off a fixed array would have drawn a fourth step nobody was going
 * to be shown.
 *
 * **A step already answered is a button; one not reached yet is not.** Going
 * back to change the title should not mean pressing Back twice, and the
 * forward steps stay inert rather than being drawn as disabled controls,
 * because a control that cannot be pressed is the dead UI the house rules
 * forbid. Nothing is validated, so there is nothing to jump *over* — Next is
 * the only way forward and the numbers are a map rather than a shortcut.
 */
function Stepper({
  step,
  steps,
  onGo,
}: {
  step: Step;
  steps: readonly Step[];
  onGo: (step: Step) => void;
}) {
  const at = steps.indexOf(step);

  return (
    <ol className="mt-5 flex items-center justify-center gap-2 sm:gap-3">
      {steps.map((name, i) => {
        const done = i < at;
        const here = i === at;

        /* The marker carries the state, and the three are told apart by fill
           rather than by hue: filled and inked for where you are, a hairline
           and muted for everywhere else. `text-accent-ink` on the fill and not
           a literal white — the accent is near-black by day and white at
           night, so a fixed colour is invisible in exactly one theme. */
        const marker = (
          <span
            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                        font-sans text-xs font-semibold transition-colors ${
                          here
                            ? "bg-accent text-accent-ink"
                            : done
                              ? "border border-accent text-fg"
                              : "border border-line text-muted"
                        }`}
          >
            {i + 1}
          </span>
        );

        const label = (
          <span
            className={`font-sans text-sm ${
              here ? "font-medium text-fg" : "text-muted"
            }`}
          >
            {STEP_NAMES[name]}
          </span>
        );

        return (
          <li key={name} className="flex items-center gap-2 sm:gap-3">
            {i > 0 && (
              <span
                aria-hidden="true"
                className={`h-px w-4 sm:w-8 ${done || here ? "bg-accent" : "bg-line"}`}
              />
            )}
            {done ? (
              <button
                type="button"
                onClick={() => onGo(name)}
                aria-label={`Back to ${STEP_NAMES[name]}`}
                className="flex items-center gap-2 rounded-md px-1 py-1 outline-none
                           transition-colors hover:bg-raised focus-visible:ring-2
                           focus-visible:ring-accent/60"
              >
                {marker}
                {/* The names of the steps behind you are the ones worth losing
                    first on a narrow screen: the marker still numbers them, and
                    the step you are *on* keeps its name at every width. */}
                <span className="hidden sm:block">{label}</span>
              </button>
            ) : (
              <span
                className="flex items-center gap-2 px-1 py-1"
                aria-current={here ? "step" : undefined}
              >
                {marker}
                <span className={here ? "" : "hidden sm:block"}>{label}</span>
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}
